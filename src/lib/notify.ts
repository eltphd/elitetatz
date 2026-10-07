import { sendEmail } from '@/lib/resend'
import { sendSms, toE164 } from '@/lib/sms'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// One place for every pilot notification. Email is the record; SMS is the
// heads-up. Both best-effort; neither can fail the caller.

const html = (text: string) =>
  `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')}</div>`

// `kind` and `ref` label the operator copy, which never carries the client's
// name, contact details or words: the client belongs to the artist.
export async function notifyArtist(args: { subject: string; text: string; sms?: string; kind: string; ref: string }) {
  await sendEmail({
    from: ARTIST_CONFIG.fromEmail,
    to: process.env.ARTIST_NOTIFICATION_EMAIL ?? ARTIST_CONFIG.email,
    subject: args.subject,
    html: html(args.text),
    text: args.text,
  })
  // Optional second inbox (e.g. the operator) so a missed lead gets noticed.
  // It says that something arrived and nothing about who: the details went
  // to the artist and stay with her. Set ARTIST_NOTIFICATION_CC to enable.
  const cc = process.env.ARTIST_NOTIFICATION_CC
  if (cc) {
    const ref = args.ref.slice(0, 8)
    const text = `${args.kind} for ${ARTIST_CONFIG.name}, ref ${ref}.\n\nThe details went to her inbox and stay with her. This copy only confirms something arrived.`
    await sendEmail({ from: ARTIST_CONFIG.fromEmail, to: cc, subject: `[copy] ${args.kind} · ref ${ref}`, html: html(text), text })
  }
  const to = toE164(process.env.ARTIST_SMS_NUMBER ?? ARTIST_CONFIG.smsNumber)
  if (args.sms && to) await sendSms({ to, text: args.sms })
}

export async function notifyClient(args: {
  email?: string | null
  phone?: string | null
  subject: string
  text: string
  sms?: string
}) {
  if (args.email) {
    await sendEmail({
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
