import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyClient } from '@/lib/notify'
import { inquiryUrl, depositUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// The artist's three buttons: Accept (quote + dates), Need more info, Pass.
// Auth is the artist's session; match reads/updates go through RLS. Thread
// and notification inserts try the session first and fall back to the
// service role so a missing policy never swallows the record.
//
// Body: { matchId, action: 'accept' | 'more_info' | 'decline',
//         price_cents?, proposed_dates?, message? }

type Action = 'accept' | 'more_info' | 'decline'
const ACTIONS: Action[] = ['accept', 'more_info', 'decline']

// Statuses the artist may still act on. Everything else is a 409.
const OPEN: Record<string, Action[]> = {
  pending: ['accept', 'more_info', 'decline'],
  info_requested: ['accept', 'more_info', 'decline'],
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const firstName = ARTIST_CONFIG.name.split(' ')[0]
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(body.matchId)
  const action = str(body.action) as Action
  const message = str(body.message).slice(0, 4000)
  const proposedDates = str(body.proposed_dates).slice(0, 500)
  const priceCents = Number(body.price_cents)

  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!ACTIONS.includes(action)) return Response.json({ error: 'Unknown action' }, { status: 400 })
  if (action === 'accept' && (!Number.isFinite(priceCents) || priceCents <= 0)) {
    return Response.json({ error: 'A quote is required to accept' }, { status: 400 })
  }
  if (action === 'more_info' && !message) {
    return Response.json({ error: 'Write the question you want to ask' }, { status: 400 })
  }

  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) return Response.json({ error: 'Not an artist account' }, { status: 403 })

  const { data: match } = await supabase
    .from('matches')
    .select('id, status, client_name, client_email, client_phone, ai_summary, client_brief')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })

  const allowed = OPEN[match.status] ?? []
  if (!allowed.includes(action)) {
    return Response.json({ error: `Already ${match.status}`, status: match.status }, { status: 409 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { artist_responded_at: now, updated_at: now }
  let nextStatus: string
  let threadBody: string
  let notifType: string

  if (action === 'accept') {
    nextStatus = 'accepted'
    notifType = 'accepted'
    updates.offered_price_cents = Math.round(priceCents)
    updates.proposed_dates = proposedDates || null
    updates.artist_response = message || null
    threadBody = [
      `Accepted — quote ${money(priceCents)}.`,
      proposedDates ? `Proposed dates: ${proposedDates}` : null,
      message || null,
    ].filter(Boolean).join('\n')
  } else if (action === 'more_info') {
    nextStatus = 'info_requested'
    notifType = 'info_requested'
    updates.artist_response = message
    threadBody = message
  } else {
    nextStatus = 'rejected'
    notifType = 'rejected'
    updates.artist_response = message || null
    threadBody = message || 'Passed on this one.'
  }
  updates.status = nextStatus

  const { error: updErr } = await supabase.from('matches').update(updates).eq('id', matchId)
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 })

  const admin = createAdminClient()
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { error } = await supabase.from(table).insert(row)
    if (error && admin) {
      const { error: adminErr } = await admin.from(table).insert(row)
      if (adminErr) console.error(`${table} insert (admin):`, adminErr)
    } else if (error) {
      console.error(`${table} insert:`, error)
    }
  }

  await insert('match_messages', { match_id: matchId, sender: 'artist', body: threadBody })
  await insert('artist_notifications', {
    artist_id: artist.id,
    match_id: matchId,
    type: notifType,
    message: threadBody,
    read: true, // her own action; the record is for history, not a badge
  })

  // Tell the client. Best-effort: a mail outage must not undo her decision.
  const name = match.client_name || 'there'
  const concept = str(match.ai_summary) || 'your piece'
  const inquiry = inquiryUrl(matchId)
  try {
    if (action === 'accept') {
      const deposit = (process.env.STRIPE_SECRET_KEY ? depositUrl(matchId) : null)
      const quote = money(priceCents)
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `${firstName} accepted your piece — ${quote}`,
        text: `Hey ${name},

${firstName} reviewed your idea (${concept}) and wants to do it.

Quote: ${quote}
${proposedDates ? `Proposed dates: ${proposedDates}\n` : ''}${message ? `\nHer note: "${message}"\n` : ''}
${deposit ? `Hold your spot with the ${money(ARTIST_CONFIG.depositCents)} deposit:\n${deposit}` : `${firstName} will send your ${money(ARTIST_CONFIG.depositCents)} deposit link separately to hold the spot.`}

${ARTIST_CONFIG.depositPolicy}

Questions, or want a different date? Reply on your inquiry page:
${inquiry}

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: ${firstName} accepted your piece at ${quote}${proposedDates ? ` (${proposedDates})` : ''}. ${deposit ? `Pay the ${money(ARTIST_CONFIG.depositCents)} deposit to hold it: ${deposit}` : `Deposit link coming separately.`}`,
      })
    } else if (action === 'more_info') {
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `${firstName} has a question about your piece`,
        text: `Hey ${name},

${firstName} looked at your idea (${concept}) and has a quick question before she quotes it:

"${message}"

Reply on your inquiry page and she'll see it right away:
${inquiry}

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: ${firstName} has a question about your piece. Reply on your inquiry page: ${inquiry}`,
      })
    } else {
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `About your inquiry with ${firstName}`,
        text: `Hey ${name},

Thank you for thinking of ${firstName} for ${concept}. She isn't able to take this one on right now.
${message ? `\nHer note: "${message}"\n` : ''}
If you'd like to run a different idea past her, you're always welcome to start a new inquiry.

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: ${firstName} isn't able to take this piece on right now.${message ? ` Her note: ${message.slice(0, 120)}` : ''}`,
      })
    }
  } catch (err) {
    console.error('respond notify:', err)
  }

  return Response.json({ ok: true, status: nextStatus })
}
