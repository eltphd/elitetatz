import { sendEmailDetailed } from '@/lib/resend'
import { postFollowup } from '@/lib/slack'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// A failure is never quiet. When a message meant for the artist does not go,
// or the portal could not record something a client sent, the operator hears
// within the same request: by email (OPERATOR_EMAIL, else ARTIST_NOTIFICATION_CC),
// in Slack when SLACK_FOLLOWUPS_WEBHOOK is set, and in the function log either
// way, which Vercel keeps even when both of those are down.
//
// The alert carries what broke and a reference, never the client's name,
// address or words: those stay between the client and the artist.

export interface Alert {
  subject: string
  text: string
}

export async function alertOperator(a: Alert): Promise<{ emailed: boolean; slacked: boolean }> {
  const subject = `[EliteTatz alert] ${a.subject}`
  console.error(subject, '\n', a.text)
  const to = process.env.OPERATOR_EMAIL?.trim() || process.env.ARTIST_NOTIFICATION_CC?.trim()
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const [mail, slack] = await Promise.allSettled([
    to
      ? sendEmailDetailed({
          from: ARTIST_CONFIG.fromEmail,
          to,
          replyTo: null,
          subject,
          text: a.text,
          html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(a.text)}</div>`,
        })
      : Promise.resolve({ ok: false, error: 'no OPERATOR_EMAIL or ARTIST_NOTIFICATION_CC' }),
    postFollowup(`:rotating_light: ${a.subject}\n${a.text}`),
  ])
  return {
    emailed: mail.status === 'fulfilled' && mail.value.ok,
    slacked: slack.status === 'fulfilled' && slack.value,
  }
}
