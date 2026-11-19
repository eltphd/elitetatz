import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Message } from '@/lib/types'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { checkAbuse } from '@/lib/rate-limit'
import { track } from '@/lib/analytics'
import { notifyArtist, notifyClient, type ArtistNoticeResult } from '@/lib/notify'
import { alertOperator } from '@/lib/alert'
import { inquiryUrl, appUrl, linksConfigured, verifyBrief } from '@/lib/tokens'
import { recentInquiry } from '@/lib/inquiry'
import { briefFollowUps, followUpLines, referenceLine } from '@/lib/brief'

// Called by AgentChat when BRIEF_READY fires.
//
// The rule (Nov 9, 2026): every client message must reach Lacey's email,
// whether or not she ever opens the portal. So this route follows the same
// order as the rawsunart.com form (/api/community/inquiry):
//
//   1. validate and verify the brief; reads only after that
//   2. email Lacey the brief, with the client's address as reply-to,
//      BEFORE anything is written: a database outage cannot lose it
//   3. save the conversation, then open a pending match (or, when this
//      person already has an inquiry from the last 24 hours, add the new
//      brief to that thread as a follow-up instead of dropping it)
//   4. send the client their inquiry-page link when there is a new page
//
// If both her email and the portal copy fail, the response is a 500 and
// AgentChat shows the client her email address. Clients are anonymous:
// writes go through the service role, and the client gets a signed inquiry
// link instead of a login.

interface BriefPayload {
  messages: Message[]
  brief: Record<string, unknown>
  briefToken?: string
  sessionId: string
}

type ArtistRow = { id: string; payout_preference: string | null }
type Contact = { clientName: string; clientEmail: string; clientPhone: string }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const limited = checkAbuse('brief', req, { max: 5, windowMs: 10 * 60_000, maxPerDay: 150 })
  if (limited) return limited

  try {
    const { messages, brief, briefToken, sessionId }: BriefPayload = await req.json()
    if (!brief || !Array.isArray(messages)) {
      return Response.json({ error: 'Missing brief' }, { status: 400 })
    }
    // Fail closed before writing anything: without the link secret we could
    // not give the client a working inquiry link, nor verify the brief.
    if (!linksConfigured()) {
      console.error('brief route: MATCH_TOKEN_SECRET is not set; intake is off')
      return Response.json({ error: 'Inquiries are paused. Please email the studio.' }, { status: 503 })
    }
    // Only a brief our own concierge stream produced, unaltered, may open an
    // inquiry and send messages to the contact details inside it.
    if (!verifyBrief(brief, briefToken)) {
      return Response.json({ error: 'This brief could not be verified. Please start the chat again.' }, { status: 403 })
    }

    // A signed-in client is optional; failing to read the session must not
    // stop the brief.
    let user: { id: string; email?: string | null } | null = null
    try {
      const session = await createClient()
      user = (await session.auth.getUser()).data.user ?? null
    } catch (err) {
      console.warn('brief route: session read failed', err)
    }

    const c: Contact = {
      clientName: str(brief.client_name),
      clientEmail: str(brief.client_email).toLowerCase() || (user?.email ?? ''),
      clientPhone: str(brief.client_phone),
    }

    // ---- 1. Reads only: whose this is, and whether it is a repeat ----------
    // The private tables are deny-all; only the service role can read them.
    // If the database is unreachable the email still goes.
    const db = createAdminClient()
    let artist: ArtistRow | null = null
    let priorMatchId: string | null = null
    let portalError: string | null = db ? null : 'storage is not configured'
    if (db) {
      try {
        const { data, error } = await db.from('artists').select('id, payout_preference').eq('name', ARTIST_CONFIG.name).single()
        if (error || !data) portalError = `artist lookup: ${error?.message ?? 'not found'}`
        artist = (data as ArtistRow | null) ?? null
        if (artist) priorMatchId = await recentInquiry(db, artist.id, c.clientEmail, c.clientPhone)
      } catch (err) {
        portalError = `lookup threw: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    const repeat = Boolean(priorMatchId)
    const matchId = priorMatchId ?? randomUUID()

    // ---- 2. Lacey's copy, first ---------------------------------------------
    const notice = await notifyLacey(brief, matchId, repeat, c, artist?.id ?? null)

    // ---- 3. The portal copy ------------------------------------------------
    let conversationId: string | null = null
    let portal = false
    if (db) {
      try {
        // Signed-in clients keep a clients row; anonymous ones live on the match.
        let clientId: string | null = null
        if (user) {
          const { data: existing } = await db.from('clients').select('id').eq('user_id', user.id).single()
          if (existing) clientId = (existing as { id: string }).id
          else {
            const { data: created } = await db
              .from('clients')
              .insert({ user_id: user.id, email: user.email, name: c.clientName || null })
              .select('id')
              .single()
            clientId = (created as { id?: string } | null)?.id ?? null
          }
        }

        const { data: conversation, error: convErr } = await db
          .from('conversations')
          .insert({
            client_id: clientId,
            messages,
            brief_extracted: brief,
            session_id: sessionId,
            mode: 'lacey',
          })
          .select('id')
          .single()
        if (convErr || !conversation) console.error('conversation insert:', convErr)
        conversationId = (conversation as { id?: string } | null)?.id ?? null

        const now = new Date().toISOString()
        if (artist && repeat) {
          const { error } = await db.from('match_messages').insert({
            match_id: matchId,
            sender: 'client',
            body: `Sent a new brief from the concierge:\n${briefDetails(brief, c)}`,
          })
          if (error) portalError = `follow-up insert: ${error.message}`
          else {
            portal = true
            await db.from('matches').update({ updated_at: now, last_client_message_at: now }).eq('id', matchId)
          }
        } else if (artist) {
          const { error: matchErr } = await db
            .from('matches')
            .insert({
              id: matchId,
              client_id: clientId,
              artist_id: artist.id,
              conversation_id: conversationId,
              status: 'pending',
              client_brief: JSON.stringify(brief),
              ai_summary: str(brief.concept),
              offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
              placement: str(brief.placement),
              client_name: c.clientName || null,
              client_email: c.clientEmail || null,
              client_phone: c.clientPhone || null,
              payout_target: artist.payout_preference ?? 'artist',
            })
          if (matchErr) {
            portalError = `match insert: ${matchErr.message}`
            console.error('match insert:', matchErr)
          } else {
            portal = true
            await db.from('match_messages').insert({
              match_id: matchId,
              sender: 'system',
              body: 'Inquiry opened from the concierge. The brief is attached above.',
            })
            if (notice.logId) await db.from('artist_notifications').update({ match_id: matchId }).eq('id', notice.logId)
          }
        }
      } catch (err) {
        portal = false
        portalError = `portal write threw: ${err instanceof Error ? err.message : String(err)}`
        console.error('brief route: portal write', err)
      }
    }

    // ---- 4. The client's receipt ------------------------------------------
    // Only for a new inquiry with a page to link to. A repeat already has its
    // link from the first time.
    const link = portal && !repeat ? inquiryUrl(matchId) : null
    if (link) {
      await notifyClient({
        email: c.clientEmail || null,
        phone: c.clientPhone || null,
        subject: `Your inquiry with ${ARTIST_CONFIG.name} is in`,
        text: `Hey ${c.clientName || 'there'},

Your idea is in front of ${ARTIST_CONFIG.name.split(' ')[0]}. She reviews every inquiry herself and answers here:
${link}

Keep that link — it is your inquiry page. When she accepts, the $${ARTIST_CONFIG.depositCents / 100} deposit link appears there, and the deposit comes off your final price.

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: your inquiry is in front of ${ARTIST_CONFIG.name.split(' ')[0]}. Track it here: ${link}`,
      })
    }

    // ---- Outcome -----------------------------------------------------------
    const ref = matchId.slice(0, 8)
    if (!portal && !notice.emailed) {
      // Both copies lost. notifyArtist already alerted on the email; say the
      // portal failed too. AgentChat shows the client her address.
      await alertOperator({
        subject: `Concierge brief LOST both ways (ref ${ref})`,
        text: `A concierge brief could not be emailed to Lacey (${notice.error ?? 'unknown'}) and could not be saved to the portal (${portalError ?? 'unknown'}). The client was shown her email address. Ref ${ref}.`,
      })
      return Response.json({ error: 'Could not deliver the brief' }, { status: 500 })
    }
    if (!portal) {
      await alertOperator({
        subject: `Concierge brief reached Lacey by email only (ref ${ref})`,
        text: `The portal could not record a concierge brief: ${portalError ?? 'unknown'}. Lacey has the email copy and can answer from it. Nothing is lost, but the portal is missing this one. Ref ${ref}.`,
      })
    }

    // Counts only: how many briefs arrive with something still open, whether
    // the scale was confirmed in the chat, and whether the client spoke.
    const followUps = briefFollowUps(brief)
    await track('inquiry_sent', req, {
      open_questions: followUps.filter((f) => f.kind === 'open').length,
      scale_confirmed: brief.scale_confirmed === true,
      voice: messages.some((m) => m.input === 'voice'),
    })
    return Response.json({
      conversationId,
      portal,
      emailed: notice.emailed,
      ...(repeat ? { duplicate: true } : {}),
      ...(link ? { matchId, inquiryUrl: link } : {}),
    })
  } catch (err) {
    console.error('brief route:', err)
    return Response.json({ error: 'Failed to save brief' }, { status: 500 })
  }
}

// The brief as Lacey reads it: in her email, and in the thread on a follow-up.
function briefDetails(brief: Record<string, unknown>, c: Contact): string {
  const concept = str(brief.concept) || 'a new piece'
  const style = Array.isArray(brief.styles) ? brief.styles.join(', ') : str(brief.styles) || 'TBD'
  const placement = str(brief.placement) || 'TBD'
  const size = str(brief.size) || 'TBD'
  const budget = brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : 'TBD'
  const refs = referenceLine(brief)
  const scale = str(brief.scale_check)
  const scaleLine = scale
    ? `${scale} — ${brief.scale_confirmed === true ? 'client confirmed' : 'NOT confirmed'}`
    : brief.has_reference ? 'not run' : 'n/a (no reference)'
  return `From: ${c.clientName || 'name not given'}
Email: ${c.clientEmail || 'not given'}
Phone: ${c.clientPhone || 'not given'}
Concept: ${concept}
Style: ${style}
Placement: ${placement}
Size: ${size}
Reference: ${brief.has_reference ? 'yes' : 'no'} · Creative freedom: ${brief.creative_freedom ? 'yes' : 'no'}${refs ? `\nWhat the reference is for: ${refs}` : ''}
Scale check: ${scaleLine}
Budget: ${budget} · Deposit ready: ${brief.deposit_ready ? 'yes' : 'not yet'}
Readiness: ${brief.readiness_score ?? 0}/100`
}

async function notifyLacey(
  brief: Record<string, unknown>,
  matchId: string,
  repeat: boolean,
  c: Contact,
  artistId: string | null
): Promise<ArtistNoticeResult> {
  const concept = str(brief.concept) || 'a new piece'
  const placement = str(brief.placement) || 'TBD'
  const budget = brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : 'TBD'
  const followUps = followUpLines(brief)
  const dashboard = `${appUrl()}/dashboard`

  const text = `${repeat
    ? 'A new brief from your concierge, from someone who sent an inquiry in the last 24 hours. It is added to that thread.'
    : 'New inquiry via your concierge.'}

${briefDetails(brief, c)}
${followUps.length ? `\nStill to settle before you quote (the "More info" button is pre-filled with these):\n${followUps.map((l) => `- ${l}`).join('\n')}\n` : '\nNothing left open: the client confirmed the read. Quote from the brief.\n'}
${c.clientEmail ? `Reply to this email and it goes straight to ${c.clientName.split(' ')[0] || 'the client'} (${c.clientEmail}).\n` : ''}It is also in your inbox: ${dashboard}
Accept with a quote, ask for more info, or pass. Ref ${matchId.slice(0, 8)}.`

  return notifyArtist({
    kind: repeat ? 'Inquiry follow-up' : 'New inquiry',
    ref: matchId,
    replyTo: c.clientEmail || null,
    // A new match does not exist yet; the log row is attached once it does.
    matchId: repeat ? matchId : null,
    artistId,
    subject: `${repeat ? 'Follow-up' : 'Inquiry'}: ${concept} (${placement})`,
    text,
    sms: `${repeat ? 'Follow-up' : 'New inquiry'}: ${concept} on ${placement}, ${budget}. Accept / more info / pass at ${dashboard}`,
  })
}
