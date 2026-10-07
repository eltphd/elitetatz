import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMatch, appUrl } from '@/lib/tokens'
import { depositLinkFor } from '@/lib/deposit'
import { notifyArtist } from '@/lib/notify'
import { checkAbuse } from '@/lib/rate-limit'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Anonymous client side of the inquiry. No account: the signed token in
// the link is the proof, and it is verified before any read or write.
//
// GET  /api/inquiry?matchId=&t=   → inquiry state + thread
// POST /api/inquiry { matchId, t, body } → client message on the thread

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const PAID = ['paid', 'booked', 'completed']

const MATCH_COLUMNS =
  'id, status, offered_price_cents, proposed_dates, appointment_at, ai_summary, client_brief, client_name, stripe_payment_intent_id, artist_responded_at, created_at, design_fee_cents, date_request'

function invalid() {
  return Response.json({ error: 'This link isn\'t valid' }, { status: 404 })
}

export async function GET(req: Request) {
  const limited = checkAbuse('inquiry-read', req, { max: 60, windowMs: 10 * 60_000, maxPerDay: 3000 })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const matchId = str(searchParams.get('matchId'))
  const token = searchParams.get('t')
  if (!verifyMatch(matchId, token)) return invalid()

  const admin = createAdminClient()
  if (!admin) return Response.json({ error: 'Unavailable' }, { status: 503 })

  const { data: match } = await admin.from('matches').select(MATCH_COLUMNS).eq('id', matchId).single()
  if (!match) return invalid()

  const { data: messages } = await admin
    .from('match_messages')
    .select('id, sender, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(match.client_brief ?? '{}') } catch {}

  const depositPaid = PAID.includes(match.status) || Boolean(match.stripe_payment_intent_id)
  const quoted = ['accepted', ...PAID].includes(match.status)

  return Response.json({
    status: match.status,
    client_name: match.client_name,
    offered_price_cents: quoted ? match.offered_price_cents : null,
    proposed_dates: match.proposed_dates,
    appointment_at: match.appointment_at,
    design_fee_cents: match.design_fee_cents ?? null,
    date_request: match.date_request ?? null,
    deposit_cents: ARTIST_CONFIG.depositCents,
    deposit_paid: depositPaid,
    deposit_url: match.status === 'accepted' && !depositPaid ? depositLinkFor(matchId).url : null,
    deposit_external: match.status === 'accepted' && !depositPaid ? depositLinkFor(matchId).external : false,
    deposit_collected_by: ARTIST_CONFIG.depositCollectedBy,
    brief: {
      concept: str(brief.concept) || str(match.ai_summary),
      placement: str(brief.placement),
      size: str(brief.size),
    },
    messages: messages ?? [],
    created_at: match.created_at,
  })
}

export async function POST(req: Request) {
  const limited = checkAbuse('inquiry', req, { max: 10, windowMs: 10 * 60_000, maxPerDay: 300 })
  if (limited) return limited

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(payload.matchId)
  const token = str(payload.t)
  const body = str(payload.body).slice(0, 2000)
  if (!verifyMatch(matchId, token)) return invalid()
  if (!body) return Response.json({ error: 'Message is empty' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return Response.json({ error: 'Unavailable' }, { status: 503 })

  const { data: match } = await admin
    .from('matches')
    .select('id, status, client_name, ai_summary')
    .eq('id', matchId)
    .single()
  if (!match) return invalid()

  // kind: 'date_request' — the client names the date they want after the
  // deposit; it is recorded on the match and the artist confirms (final say).
  const kind = str(payload.kind)
  const isDateRequest = kind === 'date_request'
  const stored = isDateRequest ? `Date request: ${body}` : body

  const { data: inserted, error } = await admin
    .from('match_messages')
    .insert({ match_id: matchId, sender: 'client', body: stored })
    .select('id, sender, body, created_at')
    .single()
  if (error || !inserted) {
    console.error('client message insert:', error)
    return Response.json({ error: 'Could not send' }, { status: 500 })
  }

  // Status stays put: an info_requested reply surfaces in "Needs you" on the
  // dashboard because the client's message is newer than her last one.
  await admin
    .from('matches')
    .update({ updated_at: new Date().toISOString(), ...(isDateRequest ? { date_request: body } : {}) })
    .eq('id', matchId)

  const name = match.client_name || 'Client'
  const concept = str(match.ai_summary) || 'their piece'
  const dashboard = `${appUrl()}/dashboard`
  try {
    await notifyArtist(isDateRequest ? {
      subject: `${name} asked for a date — ${concept}`,
      text: `${name} wants to book ${concept} on:

"${body}"

Confirm or change it from your inbox (you have final say):
${dashboard}

(match ${matchId})`,
      sms: `${name} asked for a date for "${concept}": ${body.slice(0, 80)} — confirm at ${dashboard}`,
    } : {
      subject: `${name} replied — ${concept}`,
      text: `${name} wrote on their inquiry (${concept}, status: ${match.status}):

"${body}"

Answer from your dashboard:
${dashboard}

(match ${matchId})`,
      sms: `${name} replied on "${concept}": ${body.slice(0, 100)}${body.length > 100 ? '…' : ''} — ${dashboard}`,
    })
  } catch (err) {
    console.error('inquiry notify:', err)
  }

  return Response.json({ ok: true, message: inserted })
}
