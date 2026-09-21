import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Message } from '@/lib/types'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { checkAbuse } from '@/lib/rate-limit'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { inquiryUrl, appUrl } from '@/lib/tokens'

// Called by AgentChat when BRIEF_READY fires.
// Persists the conversation + brief, opens a pending match for the artist,
// and notifies both sides. Clients are anonymous: writes go through the
// service role, and the client gets a signed inquiry link instead of a login.

interface BriefPayload {
  messages: Message[]
  brief: Record<string, unknown>
  mode?: string
  sessionId: string
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const limited = checkAbuse('brief', req, { max: 5, windowMs: 10 * 60_000, maxPerDay: 150 })
  if (limited) return limited

  try {
    const { messages, brief, mode, sessionId }: BriefPayload = await req.json()
    if (!brief || !Array.isArray(messages)) {
      return Response.json({ error: 'Missing brief' }, { status: 400 })
    }

    const admin = createAdminClient()
    const session = await createClient()
    const db = admin ?? session
    const { data: { user } } = await session.auth.getUser()

    const clientEmail = str(brief.client_email).toLowerCase() || (user?.email ?? '')
    const clientName = str(brief.client_name)
    const clientPhone = str(brief.client_phone)

    // Signed-in clients keep a clients row; anonymous ones live on the match.
    let clientId: string | null = null
    if (user) {
      const { data: existing } = await db.from('clients').select('id').eq('user_id', user.id).single()
      if (existing) clientId = existing.id
      else {
        const { data: created } = await db
          .from('clients')
          .insert({ user_id: user.id, email: user.email, name: clientName || null })
          .select('id')
          .single()
        clientId = created?.id ?? null
      }
    }

    const { data: conversation, error: convErr } = await db
      .from('conversations')
      .insert({
        client_id: clientId,
        messages,
        brief_extracted: brief,
        session_id: sessionId,
        mode: mode ?? 'marketplace',
      })
      .select('id')
      .single()

    if (convErr || !conversation) {
      console.error('conversation insert:', convErr)
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    if (mode !== 'lacey') {
      return Response.json({ conversationId: conversation.id })
    }

    const { data: artist, error: artistErr } = await db
      .from('artists')
      .select('id, payout_preference')
      .eq('name', ARTIST_CONFIG.name)
      .single()

    if (artistErr || !artist) {
      console.error('artist lookup:', artistErr)
      return Response.json({ error: 'Artist not configured' }, { status: 500 })
    }

    const { data: match, error: matchErr } = await db
      .from('matches')
      .insert({
        client_id: clientId,
        artist_id: artist.id,
        conversation_id: conversation.id,
        status: 'pending',
        client_brief: JSON.stringify(brief),
        ai_summary: str(brief.concept),
        offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
        placement: str(brief.placement),
        client_name: clientName || null,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        payout_target: artist.payout_preference ?? 'artist',
      })
      .select('id')
      .single()

    if (matchErr || !match) {
      console.error('match insert:', matchErr)
      return Response.json({ error: 'Could not open inquiry' }, { status: 500 })
    }

    await db.from('match_messages').insert({
      match_id: match.id,
      sender: 'system',
      body: 'Inquiry opened from the concierge. The brief is attached above.',
    })

    const link = inquiryUrl(match.id)
    // Sequential on purpose: Resend rate-limits bursts, and the artist's copy
    // is the one that must not be lost.
    await notifyLacey(brief, match.id, { clientName, clientEmail, clientPhone })
    await Promise.all([
      notifyClient({
        email: clientEmail || null,
        phone: clientPhone || null,
        subject: `Your inquiry with ${ARTIST_CONFIG.name} is in`,
        text: `Hey ${clientName || 'there'},

Your idea is in front of ${ARTIST_CONFIG.name.split(' ')[0]}. She reviews every inquiry herself and answers here:
${link}

Keep that link — it is your inquiry page. When she accepts, the $${ARTIST_CONFIG.depositCents / 100} deposit link appears there, and the deposit comes off your final price.

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: your inquiry is in front of ${ARTIST_CONFIG.name.split(' ')[0]}. Track it here: ${link}`,
      }),
    ])

    return Response.json({ conversationId: conversation.id, matchId: match.id, inquiryUrl: link })
  } catch (err) {
    console.error('brief route:', err)
    return Response.json({ error: 'Failed to save brief' }, { status: 500 })
  }
}

async function notifyLacey(
  brief: Record<string, unknown>,
  matchId: string,
  c: { clientName: string; clientEmail: string; clientPhone: string }
) {
  const concept = str(brief.concept) || 'a new piece'
  const style = Array.isArray(brief.styles) ? brief.styles.join(', ') : str(brief.styles) || 'TBD'
  const placement = str(brief.placement) || 'TBD'
  const size = str(brief.size) || 'TBD'
  const budget = brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : 'TBD'
  const flags = Array.isArray(brief.feasibility_flags) && brief.feasibility_flags.length
    ? brief.feasibility_flags.join('; ')
    : 'none'
  const dashboard = `${appUrl()}/dashboard`

  const text = `New inquiry via your concierge.

From: ${c.clientName || 'name not given'}
Email: ${c.clientEmail || 'not given'}
Phone: ${c.clientPhone || 'not given'}
Concept: ${concept}
Style: ${style}
Placement: ${placement}
Size: ${size}
Reference: ${brief.has_reference ? 'yes' : 'no'} · Creative freedom: ${brief.creative_freedom ? 'yes' : 'no'}
Budget: ${budget} · Deposit ready: ${brief.deposit_ready ? 'yes' : 'not yet'}
Flags: ${flags}
Readiness: ${brief.readiness_score ?? 0}/100

It is waiting in your inbox: ${dashboard}
Accept with a quote, ask for more info, or pass. Ref ${matchId.slice(0, 8)}.`

  await notifyArtist({
    subject: `Inquiry: ${concept} (${placement})`,
    text,
    sms: `New inquiry: ${concept} on ${placement}, ${budget}. Accept / more info / pass at ${dashboard}`,
  })
}
