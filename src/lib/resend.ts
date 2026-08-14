// Thin Resend wrapper — fetch-based, no SDK dependency.
// All sends are best-effort: a missing key or a Resend outage must never
// fail the request that triggered the email.

interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  from?: string
}

export async function sendEmail(args: SendEmailArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const from =
    args.from ??
    process.env.COMMUNITY_FROM_EMAIL ??
    'EliteTatz <noreply@elitetatz.com>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

interface WelcomeEmailArgs {
  artistName: string
  artistHandle: string
  instagramUrl: string
  siteUrl: string
  recipientName?: string
  eventTitle?: string
  giveawayEntry?: boolean
  unsubscribeUrl: string
}

// Dark/gold branded welcome email matching the artist presence sites.
export function buildWelcomeEmail(a: WelcomeEmailArgs): { subject: string; html: string; text: string } {
  const hi = a.recipientName ? `Hey ${a.recipientName}` : 'Hey'
  const eventLine = a.eventTitle
    ? `<p style="margin:0 0 16px;color:#a09070;">So glad you stopped by the booth at <strong style="color:#f0ebe0;">${a.eventTitle}</strong>.</p>`
    : ''
  const giveawayBlock = a.giveawayEntry
    ? `<div style="border:1px dashed rgba(201,160,80,0.5);border-radius:10px;background:rgba(201,160,80,0.08);padding:16px;margin:0 0 20px;color:#f0ebe0;">🎁 You're <strong>entered in the original art giveaway</strong> — the winner is announced by email, so watch this inbox.</div>`
    : ''

  const subject = a.eventTitle
    ? `You're in — welcome to the ${a.artistName} Collectors Club 🎨`
    : `Welcome to the ${a.artistName} Collectors Club 🎨`

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0805;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <p style="font-family:Georgia,serif;font-style:italic;font-size:20px;color:#c9a050;margin:0 0 28px;">${a.artistHandle}</p>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2;color:#f0ebe0;margin:0 0 18px;">You're <em style="color:#c9a050;">in.</em></h1>
  <p style="margin:0 0 16px;color:#a09070;">${hi} — this is ${a.artistName}. Thanks for joining my Collectors Club.</p>
  ${eventLine}
  ${giveawayBlock}
  <p style="margin:0 0 8px;color:#f0ebe0;font-weight:600;">Here's what being on this list actually gets you:</p>
  <table style="border-collapse:collapse;width:100%;margin:0 0 24px;">
    <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,160,80,0.15);color:#a09070;">🏺 <strong style="color:#f0ebe0;">24-hour early access</strong> to pottery &amp; original art drops — before Instagram sees them</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,160,80,0.15);color:#a09070;">🗺 <strong style="color:#f0ebe0;">Travel dates first</strong> — know when I'm coming to your city before books open</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,160,80,0.15);color:#a09070;">⚡ <strong style="color:#f0ebe0;">Flash &amp; print releases</strong> — the most affordable way to start collecting</td></tr>
    <tr><td style="padding:10px 0;color:#a09070;">💌 <strong style="color:#f0ebe0;">A monthly studio diary</strong> — process, works in progress, honest notes. No spam, ever.</td></tr>
  </table>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="${a.siteUrl}" style="display:inline-block;background:#c9a050;color:#0a0805;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 28px;border-radius:100px;">See the work</a>
    &nbsp;&nbsp;
    <a href="${a.instagramUrl}" style="display:inline-block;border:1px solid rgba(201,160,80,0.4);color:#c9a050;font-size:13px;font-weight:600;text-decoration:none;padding:13px 24px;border-radius:100px;">Follow along</a>
  </div>
  <p style="font-size:12px;color:#6a5f4a;margin:0;text-align:center;">You joined at ${a.siteUrl.replace('https://', '')}. Don't want these? <a href="${a.unsubscribeUrl}" style="color:#a09070;">Unsubscribe</a> anytime.</p>
</div>
</body></html>`

  const text = `${hi} — this is ${a.artistName}. Thanks for joining my Collectors Club.
${a.eventTitle ? `So glad you stopped by the booth at ${a.eventTitle}.\n` : ''}${a.giveawayEntry ? `You're entered in the original art giveaway — winner announced by email.\n` : ''}
What this list gets you:
- 24-hour early access to pottery & original art drops
- Travel dates before books open anywhere else
- Flash & print releases
- A monthly studio diary. No spam, ever.

See the work: ${a.siteUrl}
Follow along: ${a.instagramUrl}

Unsubscribe: ${a.unsubscribeUrl}`

  return { subject, html, text }
}
