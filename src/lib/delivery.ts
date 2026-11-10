import type { SupabaseClient } from '@supabase/supabase-js'
import { alertOperator } from '@/lib/alert'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Proof of delivery without one more email to Lacey (Nov 10 2026).
//
// A row in artist_notifications with status 'sent' only means Resend accepted
// the request. Whether her mail server took the message is something Resend
// learns afterwards and reports by webhook: email.delivered, email.bounced,
// email.delivery_delayed, email.complained. Each of those is written onto the
// row it belongs to, matched by Resend's message id (provider_id), as
// delivery_status and delivered_at (migration 020).
//
//   delivered    her mail server accepted it
//   delayed      a temporary failure; Resend is retrying
//   bounced      refused. The operator is alerted at once.
//   complained   marked as spam. The operator is alerted at once.
//   unconfirmed  sent more than 15 minutes ago with no receipt; set by the
//                hourly sweep, which alerts the operator once per row
//
// Nothing here writes to Lacey. The digest she already gets each evening is
// the daily proof: its own receipt, and the receipt of anything else she was
// sent, are what let its system line say "System checked OK".
//
// Accepted is not inbox: a receipt cannot say whether a message landed in
// spam. That is covered once, by her contact entry and filter, and by the
// domain's SPF, DKIM and DMARC.

export type DeliveryStatus = 'delivered' | 'delayed' | 'bounced' | 'complained' | 'unconfirmed'

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

// A later event never undoes a more final one: "delayed" arriving after
// "delivered" (webhooks are not ordered) changes nothing.
const RANK: Record<DeliveryStatus, number> = { unconfirmed: 0, delayed: 1, delivered: 2, bounced: 3, complained: 3 }

const MIN = 60_000
const HOUR = 60 * MIN
/** How long a sent email may go without a receipt before someone is told. */
export const RECEIPT_GRACE = 15 * MIN
/** How long a delivered receipt lets the digest say the whole system was checked. */
export const RECEIPT_FRESH = 26 * HOUR

export interface ResendEvent {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    id?: string
    bounce?: { message?: string; type?: string; subType?: string } | null
  }
}

export function isDeliveryEvent(type: string | undefined): boolean {
  return Boolean(type && type in EVENT_STATUS)
}

interface LogRow {
  id: string
  kind: string | null
  ref: string | null
  recipient: string | null
  delivery_status: DeliveryStatus | null
}

export type DeliveryOutcome =
  | { outcome: 'recorded'; status: DeliveryStatus }
  | { outcome: 'ignored'; reason: string }

export async function recordDeliveryEvent(db: SupabaseClient, event: ResendEvent, now = Date.now()): Promise<DeliveryOutcome> {
  const status = EVENT_STATUS[event.type ?? '']
  if (!status) return { outcome: 'ignored', reason: 'not a delivery event' }
  const emailId = event.data?.email_id ?? event.data?.id
  if (!emailId) return { outcome: 'ignored', reason: 'no email id' }

  const { data, error } = await db.from('artist_notifications').select('id, kind, ref, recipient, delivery_status').eq('provider_id', emailId).limit(1)
  if (error) throw new Error(`artist_notifications: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as LogRow | undefined
  // Client receipts, operator alerts and club mail are not in this log.
  if (!row) return { outcome: 'ignored', reason: 'not an email to the artist' }
  if (row.delivery_status && RANK[status] < RANK[row.delivery_status]) return { outcome: 'ignored', reason: `already ${row.delivery_status}` }

  const at = event.created_at && Number.isFinite(Date.parse(event.created_at)) ? new Date(event.created_at).toISOString() : new Date(now).toISOString()
  const { error: upErr } = await db
    .from('artist_notifications')
    .update({ delivery_status: status, ...(status === 'delivered' ? { delivered_at: at } : {}) })
    .eq('id', row.id)
  if (upErr) throw new Error(`artist_notifications update: ${upErr.message}`)

  if ((status === 'bounced' || status === 'complained') && row.delivery_status !== status) {
    const first = ARTIST_CONFIG.name.split(' ')[0]
    const ref = (row.ref ?? '').slice(0, 8)
    const bounce = event.data?.bounce
    await alertOperator({
      subject: `Email to ${first} ${status === 'bounced' ? 'BOUNCED' : 'was marked as spam'}: ${row.kind ?? 'email'} (ref ${ref})`,
      text: `${status === 'bounced' ? `Her mail server refused a "${row.kind ?? 'email'}" email. She did not get it.` : `A "${row.kind ?? 'email'}" email to her was reported as spam. Later mail may be filtered.`}

Ref: ${ref}
To: ${row.recipient ?? 'unknown'}
${bounce ? `Bounce: ${[bounce.type, bounce.subType].filter(Boolean).join(' / ') || 'unspecified'}${bounce.message ? `: ${bounce.message.slice(0, 300)}` : ''}\n` : ''}When: ${at}

Check the message in Resend, then reach her another way if a client is waiting on this one.`,
    })
  }
  return { outcome: 'recorded', status }
}

export interface ReceiptSweep {
  unconfirmed: number
  skipped: string | null
}

/**
 * Run hourly by /api/cron/holds. A 'sent' row older than 15 minutes with no
 * receipt (or still "delayed") is marked unconfirmed and reported once, in
 * one alert for the lot. Off until the webhook secret is set: without the
 * webhook no receipt can arrive, and every send would read as a miss.
 */
export async function sweepReceipts(db: SupabaseClient, now = Date.now()): Promise<ReceiptSweep> {
  if (!process.env.RESEND_WEBHOOK_SECRET?.trim()) return { unconfirmed: 0, skipped: 'receipts are off (RESEND_WEBHOOK_SECRET)' }
  const { data, error } = await db
    .from('artist_notifications')
    .select('id, kind, ref, created_at, delivery_status')
    .eq('status', 'sent')
    .not('provider_id', 'is', null)
    .or('delivery_status.is.null,delivery_status.eq.delayed')
    .lte('created_at', new Date(now - RECEIPT_GRACE).toISOString())
    .gte('created_at', new Date(now - 24 * HOUR).toISOString())
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw new Error(`artist_notifications: ${error.message}`)
  const rows = (data ?? []) as { id: string; kind: string | null; ref: string | null; created_at: string; delivery_status: DeliveryStatus | null }[]
  if (!rows.length) return { unconfirmed: 0, skipped: null }

  const { error: upErr } = await db.from('artist_notifications').update({ delivery_status: 'unconfirmed' }).in('id', rows.map((r) => r.id))
  if (upErr) throw new Error(`artist_notifications update: ${upErr.message}`)

  const first = ARTIST_CONFIG.name.split(' ')[0]
  await alertOperator({
    subject: `${rows.length} email${rows.length === 1 ? '' : 's'} to ${first} with no delivery receipt after 15 minutes`,
    text: `Resend accepted ${rows.length === 1 ? 'this email' : 'these emails'} but has not confirmed that her mail server took ${rows.length === 1 ? 'it' : 'them'}.

${rows.map((r) => `• ${r.kind ?? 'email'}, ref ${(r.ref ?? '').slice(0, 8)}, sent ${r.created_at}${r.delivery_status === 'delayed' ? ' (Resend reports it delayed and is retrying)' : ''}`).join('\n')}

Look each one up in Resend → Emails. If they show Delivered there, the webhook is not sending delivery events: add email.delivered, email.bounced, email.delivery_delayed and email.complained to the webhook that posts to /api/inbound/email. Each row is reported once; a receipt that arrives later still marks it delivered.`,
  })
  return { unconfirmed: rows.length, skipped: null }
}

/** When her mail server last confirmed taking an email from us, or null. */
export async function latestReceipt(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db
    .from('artist_notifications')
    .select('delivered_at')
    .eq('delivery_status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(1)
  if (error) { console.warn('latestReceipt:', error.message); return null }
  const row = (Array.isArray(data) ? data[0] : data) as { delivered_at?: string | null } | undefined
  return row?.delivered_at ?? null
}
