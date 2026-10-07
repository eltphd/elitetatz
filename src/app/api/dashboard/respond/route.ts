import { artistContext } from '@/lib/artist-session'
import { notifyClient } from '@/lib/notify'
import { inquiryUrl } from '@/lib/tokens'
import { depositLinkFor } from '@/lib/deposit'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// The artist's three buttons: Accept (quote + dates), Need more info, Pass.
// Auth is the artist's session; match reads/updates go through RLS. Thread
// and notification inserts try the session first and fall back to the
// service role so a missing policy never swallows the record.
//
// Body: { matchId, action: 'accept' | 'more_info' | 'decline' | 'deposit_received',
//         price_cents?, proposed_dates?, message? }
// deposit_received: the shop collected the deposit outside the platform
// (e.g. AION's Square checkout) and the artist confirms it by hand.

type Action = 'accept' | 'more_info' | 'decline' | 'deposit_received' | 'confirm_date'
const ACTIONS: Action[] = ['accept', 'more_info', 'decline', 'deposit_received', 'confirm_date']

// Statuses the artist may still act on. Everything else is a 409.
const OPEN: Record<string, Action[]> = {
  pending: ['accept', 'more_info', 'decline'],
  info_requested: ['accept', 'more_info', 'decline'],
  accepted: ['deposit_received'],
  paid: ['confirm_date'],
  booked: ['confirm_date'],
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const firstName = ARTIST_CONFIG.name.split(' ')[0]
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(body.matchId)
  const action = str(body.action) as Action
  const message = str(body.message).slice(0, 4000)
  const proposedDates = str(body.proposed_dates).slice(0, 500)
  const priceCents = Number(body.price_cents)
  const designFeeCents = body.design_fee_cents == null || body.design_fee_cents === '' ? null : Number(body.design_fee_cents)
  const appointmentAt = str(body.appointment_at)

  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!ACTIONS.includes(action)) return Response.json({ error: 'Unknown action' }, { status: 400 })
  if (action === 'accept' && (!Number.isFinite(priceCents) || priceCents <= 0)) {
    return Response.json({ error: 'A quote is required to accept' }, { status: 400 })
  }
  if (action === 'accept' && designFeeCents != null && (!Number.isFinite(designFeeCents) || designFeeCents < 0)) {
    return Response.json({ error: 'Design fee must be a number' }, { status: 400 })
  }
  if (action === 'confirm_date') {
    const t = Date.parse(appointmentAt)
    if (!Number.isFinite(t)) return Response.json({ error: 'Pick a date and time' }, { status: 400 })
    if (t < Date.now() - 60 * 60 * 1000) return Response.json({ error: 'That date is in the past' }, { status: 400 })
  }
  if (action === 'more_info' && !message) {
    return Response.json({ error: 'Write the question you want to ask' }, { status: 400 })
  }

  const { data: match } = await db
    .from('matches')
    .select('id, status, client_name, client_email, client_phone, ai_summary, client_brief, proposed_dates, date_request')
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
    if (designFeeCents != null) updates.design_fee_cents = Math.round(designFeeCents)
    threadBody = [
      `Accepted — quote ${money(priceCents)}.`,
      designFeeCents ? `Design drafts ahead of the session: ${money(designFeeCents)} (separate from the deposit).` : null,
      proposedDates ? `Proposed dates: ${proposedDates}` : null,
      message || null,
    ].filter(Boolean).join('\n')
  } else if (action === 'more_info') {
    nextStatus = 'info_requested'
    notifType = 'info_requested'
    updates.artist_response = message
    threadBody = message
  } else if (action === 'confirm_date') {
    nextStatus = 'booked'
    notifType = 'booked'
    updates.appointment_at = new Date(appointmentAt).toISOString()
    threadBody = `${match.status === 'booked' ? 'Rescheduled' : 'Appointment confirmed'}: ${fmtWhen(updates.appointment_at as string)}${message ? `\n${message}` : ''}`
  } else if (action === 'deposit_received') {
    nextStatus = 'paid'
    notifType = 'deposit_received'
    updates.booked_at = now // the per-booked-lead fee counts from here
    threadBody = `Deposit received — thank you. ${firstName} will confirm your date next.`
  } else {
    nextStatus = 'rejected'
    notifType = 'rejected'
    updates.artist_response = message || null
    threadBody = message || 'Passed on this one.'
  }
  updates.status = nextStatus

  // Scoped to her own match, and only from the status the check above read,
  // so two taps (or two tabs) cannot both move it.
  const { data: moved, error: updErr } = await db
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .eq('status', match.status)
    .select('id')
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 })
  if (!moved?.length) return Response.json({ error: 'This inquiry changed. Reload and try again.' }, { status: 409 })

  const insert = async (table: string, row: Record<string, unknown>) => {
    const { error } = await db.from(table).insert(row)
    if (error) console.error(`${table} insert:`, error)
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
      const { url: deposit, external } = depositLinkFor(matchId)
      const quote = money(priceCents)
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `${firstName} accepted your piece — ${quote}`,
        text: `Hey ${name},

${firstName} reviewed your idea (${concept}) and wants to do it.

Quote: ${quote}
${designFeeCents ? `Design drafts ahead of your session: ${money(designFeeCents)} (separate from the deposit; ${firstName} will send that payment link).\n` : ''}${proposedDates ? `Proposed dates: ${proposedDates}\n` : ''}${message ? `\nHer note: "${message}"\n` : ''}
${deposit ? (external ? `Hold your spot with the ${money(ARTIST_CONFIG.depositCents)} deposit through ${ARTIST_CONFIG.depositCollectedBy}'s secure checkout:\n${deposit}\nOnce it's in, ${firstName} marks it received and confirms your date on your inquiry page.` : `Hold your spot with the ${money(ARTIST_CONFIG.depositCents)} deposit:\n${deposit}`) : `${firstName} will send your ${money(ARTIST_CONFIG.depositCents)} deposit link separately to hold the spot.`}

${ARTIST_CONFIG.depositPolicy}

Questions, or want a different date? Reply on your inquiry page:
${inquiry}

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: ${firstName} accepted your piece at ${quote}${proposedDates ? ` (${proposedDates})` : ''}. ${deposit ? `Pay the ${money(ARTIST_CONFIG.depositCents)} deposit to hold it: ${deposit}` : `Deposit link coming separately.`}`,
      })
    } else if (action === 'confirm_date') {
      const when = fmtWhen(updates.appointment_at as string)
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `${match.status === 'booked' ? 'Rescheduled' : 'Confirmed'}: ${when} with ${firstName}`,
        text: `Hey ${name},

You're booked: ${when}.
Where: ${ARTIST_CONFIG.address}.
${message ? `\n${firstName}'s note: "${message}"\n` : ''}
Arrive 10 minutes early. We review the design together before anything touches skin. ${ARTIST_CONFIG.depositPolicy}

Your inquiry page: ${inquiry}

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: you're booked ${when} at ${ARTIST_CONFIG.studio}, ${ARTIST_CONFIG.address.split(',')[0]}. Details: ${inquiry}`,
      })
    } else if (action === 'deposit_received') {
      await notifyClient({
        email: match.client_email,
        phone: match.client_phone,
        subject: `Deposit received — ${concept}`,
        text: `Hey ${name},

Your ${money(ARTIST_CONFIG.depositCents)} deposit is in and your spot is held. Next: tell ${firstName} which date works for you on your inquiry page${match.proposed_dates ? ` (she offered: ${match.proposed_dates})` : ''}, and she confirms it from her side:
${inquiry}

The deposit comes off your final price. The balance is paid at the studio.

— ${ARTIST_CONFIG.handle}`,
        sms: `${ARTIST_CONFIG.handle}: deposit received, your spot is held. Pick your date here and ${firstName} confirms it: ${inquiry}`,
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
