import { sendEmailDetailed } from '@/lib/resend'
import { sendSms, toE164 } from '@/lib/sms'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { createAdminClient } from '@/lib/supabase/admin'
import { alertOperator } from '@/lib/alert'

// One place for every pilot notification. Email is the record; SMS is the
// heads-up. Neither can fail the caller.
//
// The artist's email is the copy that must not be lost: her inbox is where
// she works, and the portal is extra. So every attempt to reach her is
// written to artist_notifications with its outcome (migration 018), a failed
// attempt alerts the operator at once, and the client's address is the
// reply-to, so answering from her mail app reaches the client directly.

const html = (text: string) =>
  `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')}</div>`

export interface ArtistNotice {
  subject: string
  text: string
  sms?: string
  /** What this is, for the log and the operator copy: "New inquiry", "Client reply". */
  kind: string
  /** Reference for the operator copy and the log (a match id, or an approval id). */
  ref: string
  /** The client's address, so her reply from her mail app goes straight to them. */
  replyTo?: string | null
  /** The match this is about, once it exists in the database. Logged with the attempt. */
  matchId?: string | null
  artistId?: string | null
  /**
   * Why she must NOT be mailed about this, when there is a reason: she already
   * holds the message (she forwarded it herself, or it reached the portal by
   * way of her own mailbox). Nothing is sent to anyone; the attempt is logged
   * as 'skipped' with this reason, so the record shows a decision, not a gap.
   */
  skip?: string | null
}

export interface ArtistNoticeResult {
  emailed: boolean
  /** True when nothing was sent on purpose (see ArtistNotice.skip). */
  skipped?: boolean
  error?: string
  /** The log row, so a caller that creates the match afterwards can attach it. */
  logId: string | null
}

export function artistInbox(): string {
  return process.env.ARTIST_NOTIFICATION_EMAIL ?? ARTIST_CONFIG.email
}

/**
 * Where her Reply goes when she answers one of our emails from her mail app:
 * to the client first, and to the intake address beside it, so the portal
 * hears that she answered. Without that copy the portal would go on thinking
 * the client is waiting, nudge her about someone she already wrote back to,
 * and tell that client "still with Lacey" (src/lib/holds.ts).
 *
 * The intake address is only ever a copy: her reply reaches the client
 * directly whether or not the portal is up. Off when INBOUND_EMAIL_ADDRESS is
 * unset or REPLY_SYNC is "off"; then the reply goes to the client alone.
 */
export function artistReplyTo(client: string | null | undefined): string | string[] | undefined {
  const to = client?.trim()
  if (!to) return undefined
  const intake = process.env.INBOUND_EMAIL_ADDRESS?.trim()
  const off = /^(0|false|off|no)$/i.test((process.env.REPLY_SYNC ?? '').trim())
  if (!intake || off || intake.toLowerCase() === to.toLowerCase()) return to
  return [to, intake]
}

// `kind` and `ref` label the operator copy, which never carries the client's
// name, contact details or words: the client belongs to the artist.
//
// The rule (Erica, Nov 9 2026): she never gets two emails about the same
// thing. One email per event is the default; `skip` is for an event she
// already has in her own mailbox, where even one more would be the second.
export async function notifyArtist(args: ArtistNotice): Promise<ArtistNoticeResult> {
  const to = artistInbox()
  if (args.skip) {
    const logId = await logDelivery({
      artistId: args.artistId ?? null,
      matchId: args.matchId ?? null,
      kind: args.kind,
      ref: args.ref,
      recipient: to,
      subject: args.subject,
      result: { ok: false },
      skipped: args.skip,
    })
    return { emailed: false, skipped: true, logId }
  }
  const result = await sendEmailDetailed({
    from: ARTIST_CONFIG.fromEmail,
    to,
    replyTo: artistReplyTo(args.replyTo),
    subject: args.subject,
    html: html(args.text),
    text: args.text,
  })

  const logId = await logDelivery({
    artistId: args.artistId ?? null,
    matchId: args.matchId ?? null,
    kind: args.kind,
    ref: args.ref,
    recipient: to,
    subject: args.subject,
    result,
  })

  const ref = args.ref.slice(0, 8)
  if (!result.ok) {
    await alertOperator({
      subject: `Email to ${ARTIST_CONFIG.name.split(' ')[0]} failed: ${args.kind} (ref ${ref})`,
      text: `A "${args.kind}" email for ${ARTIST_CONFIG.name} did not go out.

Ref: ${ref}
To: ${maskEmail(to)}
Error: ${result.error ?? 'unknown'}
When: ${new Date().toISOString()}

The portal copy, if any, is in her inbox at ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard. Check Resend and the function logs, then resend by hand if needed.`,
    })
  }

  // Optional second inbox (e.g. the operator) so a missed lead gets noticed.
  // It says that something arrived and nothing about who: the details went
  // to the artist and stay with her. Set ARTIST_NOTIFICATION_CC to enable.
  const cc = process.env.ARTIST_NOTIFICATION_CC
  if (cc) {
    const text = `${args.kind} for ${ARTIST_CONFIG.name}, ref ${ref}.\n\n${result.ok ? 'The details went to her inbox and stay with her. This copy only confirms something arrived.' : `Her copy FAILED to send (${result.error}); an alert was raised.`}`
    await sendEmailDetailed({ from: ARTIST_CONFIG.fromEmail, to: cc, replyTo: null, subject: `[copy] ${args.kind} · ref ${ref}`, html: html(text), text })
  }
  const sms = toE164(process.env.ARTIST_SMS_NUMBER ?? ARTIST_CONFIG.smsNumber)
  if (args.sms && sms) await sendSms({ to: sms, text: args.sms })

  return { emailed: result.ok, error: result.error, logId }
}

// One row per attempt. Never throws: the log must not break the send.
async function logDelivery(a: {
  artistId: string | null
  matchId: string | null
  kind: string
  ref: string
  recipient: string
  subject: string
  result: { ok: boolean; id?: string; error?: string }
  /** The reason nothing was sent on purpose. Logged as status 'skipped'. */
  skipped?: string
}): Promise<string | null> {
  try {
    const db = createAdminClient()
    if (!db) return null
    const { data, error } = await db
      .from('artist_notifications')
      .insert({
        artist_id: a.artistId,
        match_id: a.matchId,
        type: 'artist_email',
        kind: a.kind,
        ref: a.ref,
        channel: 'email',
        status: a.skipped ? 'skipped' : a.result.ok ? 'sent' : 'failed',
        // For a skipped row this column holds the reason, not a fault.
        error: a.skipped ? a.skipped.slice(0, 500) : a.result.ok ? null : (a.result.error ?? 'unknown').slice(0, 500),
        provider_id: a.result.id ?? null,
        recipient: maskEmail(a.recipient),
        message: a.subject.slice(0, 200),
        read: true, // a delivery record, not a badge for her
      })
      .select('id')
      .single()
    if (error) { console.warn('artist_notifications log:', error.message); return null }
    return (data as { id?: string } | null)?.id ?? null
  } catch (err) {
    console.warn('artist_notifications log:', err)
    return null
  }
}

export async function notifyClient(args: {
  email?: string | null
  phone?: string | null
  subject: string
  text: string
  sms?: string
}) {
  if (args.email) {
    await sendEmailDetailed({
      from: ARTIST_CONFIG.fromEmail,
      to: args.email,
      replyTo: ARTIST_CONFIG.email,
      subject: args.subject,
      html: html(args.text),
      text: args.text,
    })
  }
  const to = toE164(args.phone)
  if (args.sms && to) await sendSms({ to, text: args.sms })
}

function maskEmail(to: string): string {
  return to.replace(/^(.).*(@.*)$/, '$1***$2')
}
