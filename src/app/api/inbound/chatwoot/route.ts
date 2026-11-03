import { createAdminClient } from '@/lib/supabase/admin'
import { handleChatwootEvent, verifyWebhookKey } from '@/lib/inbound/chatwoot'

// Chatwoot → inbox. Chatwoot has no signed webhooks, so the URL carries a
// secret: <app>/api/inbound/chatwoot?key=<CHATWOOT_WEBHOOK_SECRET>. Subscribe
// the webhook to `message_created` only. Instagram and Messenger inboxes in
// Chatwoot both arrive here and are told apart by inbox type.

export async function POST(req: Request) {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Chatwoot inbound is not configured' }, { status: 503 })

  const key = new URL(req.url).searchParams.get('key') ?? req.headers.get('x-webhook-key')
  if (!verifyWebhookKey(key, secret)) return Response.json({ error: 'Bad key' }, { status: 401 })

  let payload: unknown
  try { payload = await req.json() } catch { return Response.json({ ok: true, ignored: 'not json' }) }

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })

  const result = await handleChatwootEvent(db, payload)
  return Response.json({ ok: true, ...result })
}
