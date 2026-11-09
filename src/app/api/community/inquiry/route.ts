import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { checkAbuse, isBot } from '@/lib/rate-limit'
import { corsHeaders, preflight } from '@/lib/cors'
import { passesTurnstile } from '@/lib/turnstile'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { alertOperator } from '@/lib/alert'
import { inquiryUrl, appUrl, linksConfigured } from '@/lib/tokens'
import { recentInquiry, parseBudget } from '@/lib/inquiry'
import { cleanLabel } from '@/lib/labels'

// The inquiry form on rawsunart.com.
//
// The rule (Nov 9, 2026): every client message must reach Lacey's email,
// whether or not she ever opens the portal. So the order here is
//
//   1. validate; obvious bots (honeypot) get a fake success and nothing else
//   2. email Lacey the whole form, with the client's address as reply-to,
//      BEFORE anything is written: a database outage cannot lose the inquiry
//   3. record it in her portal inbox (a new match, or a note on the inquiry
//      this person already opened today) and count the source, server-side
//   4. send the client their inquiry-page link when there is a page to link
//
// A failed bot check no longer turns anyone away: the inquiry is accepted,
// tagged "possible bot" in her email and in the thread, and she decides.
// Rate limits still bound the worst case. If both her email and the portal
// copy fail, the response is a 500 and rawsunart.com opens the client's mail
// app addressed to her, so the inquiry still has a way through.
//
// Public and unauthenticated, so it is rate limited and honeypotted.

const str = (v: unknown, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max)

type ArtistRow = { id: string; payout_preference: string | null }

const WHERE: Record<string, string> = {
  columbus: `The studio (${ARTIST_CONFIG.studio})`,
  'future-convention': 'A future convention or guest spot',
  unsure: 'Not sure yet',
}

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  const limited = checkAbuse('form-inquiry', req, { max: 5, windowMs: 10 * 60_000, maxPerDay: 100 }, headers)
  if (limited) return limited

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers }) }

  // Report success to bots so they stop retrying and learn nothing.
  if (isBot(body)) return Response.json({ ok: true }, { headers })

  const clientName = str(body.name, 120)
  const clientEmail = str(body.email, 320).toLowerCase()
  const concept = str(body.concept, 2000)
  if (!clientName || !/^\S+@\S+\.\S+$/.test(clientEmail) || !concept) {
    return Response.json({ error: 'Name, a valid email and your idea are required' }, { status: 400, headers })
  }

  // The result travels with the inquiry instead of deciding it.
  const verified = await passesTurnstile(req, body.turnstileToken, 'inquiry')

  const placement = str(body.placement, 120)
  const size = str(body.size, 60)
  const style = str(body.style, 60)
  const budgetLabel = str(body.budget, 60)
  const where = WHERE[str(body.location, 40)] ?? ''
  const conventionCity = str(body.convention_city, 120)
  const reference = str(body.reference, 2000)
  const foundVia = cleanLabel(body.found_via, 'direct')
  const whereLine = [where, conventionCity].filter(Boolean).join(': ')

  // Who this belongs to, and whether it is a repeat. Reads only: if the
  // database is unreachable the email still goes.
  const db = createAdminClient()
  let artist: ArtistRow | null = null
  let priorMatchId: string | null = null
  let lookupError: string | null = db ? null : 'storage is not configured'
  if (db) {
    try {
      const { data, error } = await db.from('artists').select('id, payout_preference').eq('name', ARTIST_CONFIG.name).single()
      if (error || !data) lookupError = `artist lookup: ${error?.message ?? 'not found'}`
      artist = (data as ArtistRow | null) ?? null
      if (artist) priorMatchId = await recentInquiry(db, artist.id, clientEmail, '')
    } catch (err) {
      lookupError = `lookup threw: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  const repeat = Boolean(priorMatchId)
  const matchId = priorMatchId ?? randomUUID()
  const dashboard = `${appUrl()}/dashboard`
  const firstName = ARTIST_CONFIG.name.split(' ')[0]

  // ---- 2. Lacey's copy, first ---------------------------------------------
  const details = `From: ${clientName}
Email: ${clientEmail}
Idea: ${concept}
Placement: ${placement || 'not given'}
Size: ${size || 'not given'}
Style: ${style || 'not given'}
Budget: ${budgetLabel || 'not given'}
Where: ${whereLine || 'not given'}
Notes: ${reference || 'none'}
Found you via: ${foundVia}`

  const notice = await notifyArtist({
    kind: repeat ? 'Inquiry follow-up' : verified ? 'New inquiry' : 'New inquiry (unverified)',
    ref: matchId,
    replyTo: clientEmail,
    // A new match does not exist yet; the log row is attached once it does.
    matchId: repeat ? matchId : null,
    artistId: artist?.id ?? null,
    subject: `${verified ? '' : '[possible bot] '}${repeat ? 'Follow-up' : 'Inquiry'}: ${concept.slice(0, 60)}${placement ? ` (${placement})` : ''}`,
    text: `${repeat ? 'Another message from someone who sent an inquiry in the last 24 hours. It is added to that thread.' : 'New inquiry from the rawsunart.com form.'}
${verified ? '' : '\nThe bot check did not pass for this one. Most often that is a real person whose check expired; treat any links in it with care.\n'}
${details}

Reply to this email and it goes straight to ${clientName.split(' ')[0] || 'the client'} (${clientEmail}).
It is also in your inbox: ${dashboard}
Accept with a quote, ask for more info, or pass. Ref ${matchId.slice(0, 8)}.`,
    sms: `${verified ? '' : '[possible bot] '}${repeat ? 'Follow-up' : 'New inquiry'}: ${concept.slice(0, 60)}${placement ? ` on ${placement}` : ''}. ${dashboard}`,
  })

  // ---- 3. The portal copy --------------------------------------------------
  let portal = false
  let portalError: string | null = lookupError
  const now = new Date().toISOString()
  if (db && artist && repeat) {
    const { error } = await db.from('match_messages').insert({
      match_id: matchId,
      sender: 'client',
      body: `Sent the form again:\n${details}`,
    })
    if (error) portalError = `follow-up insert: ${error.message}`
    else {
      portal = true
      await db.from('matches').update({ updated_at: now, last_client_message_at: now }).eq('id', matchId)
    }
  } else if (db && artist) {
    const brief = {
      concept,
      placement,
      size,
      styles: style ? [style] : [],
      ...parseBudget(budgetLabel),
      budget_label: budgetLabel,
      where,
      convention_city: conventionCity,
      has_reference: Boolean(reference),
      client_name: clientName,
      client_email: clientEmail,
      source: 'rawsunart-form',
      // utm_source on the first page of the visit (rawsunart.com sets it), so a
      // Reconnect-driven inquiry reads "reconnect1" on the card as well as in the counts.
      found_via: foundVia,
      bot_check: verified ? 'passed' : 'failed',
    }
    const { error: matchErr } = await db
      .from('matches')
      .insert({
        id: matchId,
        artist_id: artist.id,
        status: 'pending',
        client_brief: JSON.stringify(brief),
        ai_summary: concept.slice(0, 200),
        offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
        placement: placement || null,
        client_name: clientName,
        client_email: clientEmail,
        payout_target: artist.payout_preference ?? 'artist',
        last_client_message_at: now,
      })
    if (matchErr) {
      portalError = `match insert: ${matchErr.message}`
      console.error('form inquiry: match insert', matchErr)
    } else {
      portal = true
      await db.from('match_messages').insert([
        {
          match_id: matchId,
          sender: 'system',
          body: `Inquiry sent from the rawsunart.com form.${whereLine ? ` Where: ${whereLine}.` : ''}${verified ? '' : ' The bot check did not pass; this may be a real person whose check expired, or spam.'}`,
        },
        ...(reference ? [{ match_id: matchId, sender: 'client', body: reference }] : []),
      ])
      if (notice.logId) await db.from('artist_notifications').update({ match_id: matchId }).eq('id', notice.logId)
    }

    // Count where the client found Lacey: here, in the same request, once.
    // No person in the row. The monthly scorecard reads these.
    const { error: srcErr } = await db.from('inquiry_sources').insert({ artist_handle: 'rawsunart', source: foundVia })
    if (srcErr) console.error('form inquiry: inquiry_sources insert', srcErr)
  }

  // ---- 4. The client's receipt --------------------------------------------
  // Only when there is an inquiry page to point at: a repeat already has its
  // link, and without the portal row or the link secret there is no page.
  if (portal && !repeat && linksConfigured()) {
    await notifyClient({
      email: clientEmail,
      subject: `Your inquiry with ${ARTIST_CONFIG.name} is in`,
      text: `Hey ${clientName.split(' ')[0] || 'there'},

Your idea is in front of ${firstName}. She reviews every inquiry herself and answers here:
${inquiryUrl(matchId)}

Keep that link — it is your inquiry page. When she accepts, the $${ARTIST_CONFIG.depositCents / 100} deposit link appears there, and the deposit comes off your final price.

— ${ARTIST_CONFIG.handle}`,
    })
  }

  // ---- Outcome -------------------------------------------------------------
  if (!portal && !notice.emailed) {
    // Both copies lost. notifyArtist already alerted on the email; say the
    // portal failed too, and let rawsunart.com hand it to the client's mail app.
    await alertOperator({
      subject: `Form inquiry LOST both ways (ref ${matchId.slice(0, 8)})`,
      text: `A rawsunart.com inquiry could not be emailed to Lacey (${notice.error ?? 'unknown'}) and could not be saved to the portal (${portalError ?? 'unknown'}). The site opened the client's mail app as a last resort. Ref ${matchId.slice(0, 8)}.`,
    })
    return Response.json({ error: 'Could not deliver the inquiry' }, { status: 500, headers })
  }
  if (!portal) {
    await alertOperator({
      subject: `Form inquiry reached Lacey by email only (ref ${matchId.slice(0, 8)})`,
      text: `The portal could not record a rawsunart.com inquiry: ${portalError ?? 'unknown'}. Lacey has the email copy and can answer from it. Nothing is lost, but the portal and the source count are missing this one. Ref ${matchId.slice(0, 8)}.`,
    })
  }

  return Response.json(
    {
      ok: true,
      portal,
      emailed: notice.emailed,
      ...(repeat ? { duplicate: true } : {}),
      ...(verified ? {} : { unverified: true }),
    },
    { headers }
  )
}
