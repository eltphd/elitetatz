import { createAdminClient } from '@/lib/supabase/admin'
import { handleInboundEmail, verifyResendSignature } from '@/lib/inbound/email'

// Resend → inbox. Resend posts `email.received` for every message to the
// inbound address; the body is verified against RESEND_WEBHOOK_SECRET, the
// message is fetched back from Resend, and it lands on a lead. Nothing is
// sent to the sender from here.
//
// Set the endpoint in Resend to <app>/api/inbound/email with the event
// `email.received`. A 200 is returned once the signature checks out, even
// when the message is ignored, so Resend does not retry forever.

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Inbound email is not configured' }, { status: 503 })

  const raw = await req.text()
  if (!verifyResendSignature(req.headers, raw, secret)) {
    return Response.json({ error: 'Bad signature' }, { status: 401 })
  }

  let event: { type?: string; data?: { email_id?: string; id?: string } }
  try { event = JSON.parse(raw) } catch { return Response.json({ ok: true, ignored: 'not json' }) }
  if (event.type !== 'email.received') return Response.json({ ok: true, ignored: event.type ?? 'no type' })

  const emailId = event.data?.email_id ?? event.data?.id
  if (!emailId) return Response.json({ ok: true, ignored: 'no email id' })

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })

  try {
    const result = await handleInboundEmail(db, emailId)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('inbound email:', err)
    // A transient failure fetching from Resend is worth a retry on their side.
    return Response.json({ error: 'Could not read the message' }, { status: 500 })
  }
}
