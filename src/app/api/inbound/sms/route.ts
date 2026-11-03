import { createAdminClient } from '@/lib/supabase/admin'
import { handleInboundSms, verifyDialpadJwt } from '@/lib/inbound/sms'

// Dialpad → inbox. Create a webhook in Dialpad (POST /api/v2/webhooks with
// hook_url = <app>/api/inbound/sms and a `secret`), then an SMS event
// subscription on it (POST /api/v2/subscriptions/sms, direction "inbound",
// target the studio line). Each delivery is a JWT signed with that secret;
// its payload is the message.

export async function POST(req: Request) {
  const secret = process.env.DIALPAD_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Inbound SMS is not configured' }, { status: 503 })

  const raw = (await req.text()).trim()
  let payload: unknown
  if (raw.startsWith('{')) {
    // Some Dialpad deliveries wrap the token in JSON; a bare token is the norm.
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const token = typeof parsed.jwt === 'string' ? parsed.jwt : typeof parsed.token === 'string' ? parsed.token : null
      payload = token ? verifyDialpadJwt(token, secret) : null
    } catch { payload = null }
  } else {
    payload = verifyDialpadJwt(raw, secret)
  }
  if (!payload) return Response.json({ error: 'Bad signature' }, { status: 401 })

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })

  const result = await handleInboundSms(db, payload)
  return Response.json({ ok: true, ...result })
}
