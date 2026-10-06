import { sendEmail } from '@/lib/resend'
import { sendSms, toE164 } from '@/lib/sms'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// One place for every pilot notification. Email is the record; SMS is the
// heads-up. Both best-effort; neither can fail the caller.

const html = (text: string) =>
  `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')}</div>`

export async function notifyArtist(args: { subject: string; text: string; sms?: string }) {
  const delivered = await sendEmail({
    from: ARTIST_CONFIG.fromEmail,
    to: process.env.ARTIST_NOTIFICATION_EMAIL ?? ARTIST_CONFIG.email,
    subject: args.subject,
    html: html(args.text),
    text: args.text,
  })
  // Optional second inbox (e.g. the operator) so a lead is never lost to one
  // mailbox's filtering. Set ARTIST_NOTIFICATION_CC to enable.
  const cc = process.env.ARTIST_NOTIFICATION_CC
  if (cc) {
    await sendEmail({ from: ARTIST_CONFIG.fromEmail, to: cc, subject: `[copy] ${args.subject}`, html: html(args.text), text: args.text })
  }
  const to = toE164(process.env.ARTIST_SMS_NUMBER ?? ARTIST_CONFIG.smsNumber)
  if (args.sms && to) await sendSms({ to, text: args.sms })
  await pingOwner(args.subject, delivered)
}

// The operator's heads-up in Slack (SLACK_WEBHOOK_URL, optional): every new
// inquiry, client reply and deposit, so a lead is visible even when nobody is
// watching the inbox. The subject line only, never the client's name or
// contact details. A failed email to the artist is called out, because then
// nobody else knows the lead exists.
async function pingOwner(subject: string, delivered: boolean) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!url || !/^https:\/\/hooks\.slack\.com\//.test(url)) return
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://elitetatz.vercel.app').replace(/\/$/, '')
  const text = delivered
    ? `:art: ${ARTIST_CONFIG.handle}: ${esc(subject)} · <${app}/dashboard|Lacey's inbox>`
    : `:warning: ${ARTIST_CONFIG.handle}: ${esc(subject)}. *The email to ${ARTIST_CONFIG.name.split(' ')[0]} did not send*, so she may not know. <${app}/dashboard|Open the inbox>`
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, unfurl_links: false }) })
  } catch (err) {
    console.error('slack ping failed:', err instanceof Error ? err.message : err)
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
