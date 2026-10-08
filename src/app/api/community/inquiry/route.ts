import { createAdminClient } from '@/lib/supabase/admin'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { checkAbuse, isBot } from '@/lib/rate-limit'
import { corsHeaders, preflight } from '@/lib/cors'
import { passesTurnstile, failedCheck } from '@/lib/turnstile'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { inquiryUrl, appUrl, linksConfigured } from '@/lib/tokens'
import { hasRecentInquiry, parseBudget } from '@/lib/inquiry'
import { cleanLabel } from '@/lib/labels'

// The inquiry form on rawsunart.com. Replaces Formspree: the inquiry opens in
// Lacey's dashboard like a concierge brief, she is emailed, and the client
// gets their inquiry page link. The client belongs to the artist; nothing
// here is copied anywhere else.
//
// Public and unauthenticated, so it is rate limited, honeypotted and checked
// by Turnstile (lib/turnstile.ts) before anything is written or sent.

const str = (v: unknown, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max)

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
  if (!(await passesTurnstile(req, body.turnstileToken))) return failedCheck(headers)

  const clientName = str(body.name, 120)
  const clientEmail = str(body.email, 320).toLowerCase()
  const concept = str(body.concept, 2000)
  if (!clientName || !/^\S+@\S+\.\S+$/.test(clientEmail) || !concept) {
    return Response.json({ error: 'Name, a valid email and your idea are required' }, { status: 400, headers })
  }

  // Without the link secret the client could not get a working inquiry link;
  // say so, and the page falls back to email.
  if (!linksConfigured()) return Response.json({ error: 'Inquiries are paused' }, { status: 503, headers })
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Inquiries are paused' }, { status: 503, headers })

  const { data: artist, error: artistErr } = await db
    .from('artists')
    .select('id, payout_preference')
    .eq('name', ARTIST_CONFIG.name)
    .single()
  if (artistErr || !artist) {
    console.error('form inquiry: artist lookup', artistErr)
    return Response.json({ error: 'Artist not configured' }, { status: 500, headers })
  }

  if (await hasRecentInquiry(db, artist.id, clientEmail, '')) {
    return Response.json({ ok: true, duplicate: true }, { headers })
  }

  const placement = str(body.placement, 120)
  const size = str(body.size, 60)
  const style = str(body.style, 60)
  const budgetLabel = str(body.budget, 60)
  const where = WHERE[str(body.location, 40)] ?? ''
  const conventionCity = str(body.convention_city, 120)
  const reference = str(body.reference, 2000)
  const foundVia = cleanLabel(body.found_via, 'direct')

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
  }

  const { data: match, error: matchErr } = await db
    .from('matches')
    .insert({
      artist_id: artist.id,
      status: 'pending',
      client_brief: JSON.stringify(brief),
      ai_summary: concept.slice(0, 200),
      offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
      placement: placement || null,
      client_name: clientName,
      client_email: clientEmail,
      payout_target: artist.payout_preference ?? 'artist',
    })
    .select('id')
    .single()
  if (matchErr || !match) {
    console.error('form inquiry: match insert', matchErr)
    return Response.json({ error: 'Could not open inquiry' }, { status: 500, headers })
  }

  const whereLine = [where, conventionCity].filter(Boolean).join(': ')
  await db.from('match_messages').insert([
    { match_id: match.id, sender: 'system', body: `Inquiry sent from the rawsunart.com form.${whereLine ? ` Where: ${whereLine}.` : ''}` },
    ...(reference ? [{ match_id: match.id, sender: 'client', body: reference }] : []),
  ])

  // Count-only: where the client found Lacey, with no person in the row.
  await db.from('inquiry_sources').insert({ artist_handle: 'rawsunart', source: foundVia })

  const link = inquiryUrl(match.id)
  const dashboard = `${appUrl()}/dashboard`
  const firstName = ARTIST_CONFIG.name.split(' ')[0]

  // Sequential on purpose: Resend rate-limits bursts, and the artist's copy
  // is the one that must not be lost.
  await notifyArtist({
    kind: 'New inquiry',
    ref: match.id,
    subject: `Inquiry: ${concept.slice(0, 60)}${placement ? ` (${placement})` : ''}`,
    text: `New inquiry from the rawsunart.com form.

From: ${clientName}
Email: ${clientEmail}
Idea: ${concept}
Placement: ${placement || 'not given'}
Size: ${size || 'not given'}
Style: ${style || 'not given'}
Budget: ${budgetLabel || 'not given'}
Where: ${whereLine || 'not given'}
Notes: ${reference || 'none'}
Found you via: ${foundVia}

It is waiting in your inbox: ${dashboard}
Accept with a quote, ask for more info, or pass. Ref ${match.id.slice(0, 8)}.`,
    sms: `New inquiry: ${concept.slice(0, 60)}${placement ? ` on ${placement}` : ''}. Accept / more info / pass at ${dashboard}`,
  })
  await notifyClient({
    email: clientEmail,
    subject: `Your inquiry with ${ARTIST_CONFIG.name} is in`,
    text: `Hey ${clientName.split(' ')[0] || 'there'},

Your idea is in front of ${firstName}. She reviews every inquiry herself and answers here:
${link}

Keep that link — it is your inquiry page. When she accepts, the $${ARTIST_CONFIG.depositCents / 100} deposit link appears there, and the deposit comes off your final price.

— ${ARTIST_CONFIG.handle}`,
  })

  return Response.json({ ok: true }, { headers })
}
