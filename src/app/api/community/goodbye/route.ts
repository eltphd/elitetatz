import { createAdminClient } from '@/lib/supabase/admin'
import { rsaPage, TOKEN_RE, UNKNOWN } from '@/lib/rsa-page'

export const dynamic = 'force-dynamic'

// One-click unsubscribe from the reconnect email. No confirm step, no login:
// the token in the link is the whole proof, and the change is instant.
// POST is the RFC 8058 one-click form Gmail and Yahoo send from the
// List-Unsubscribe header; GET is the link in the email body.

async function goodbye(t: string): Promise<boolean> {
  if (!TOKEN_RE.test(t)) return false
  const supabase = createAdminClient()
  if (!supabase) return false
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('rsa_contacts')
    .update({ unsubscribed_at: now, consent_status: 'unsubscribed', updated_at: now })
    .eq('send_token', t)
    .is('unsubscribed_at', null)
    .select('id')
  if (data?.length) return true
  // Already unsubscribed: still a success for the person clicking.
  const { data: seen } = await supabase.from('rsa_contacts').select('id').eq('send_token', t).limit(1)
  return Boolean(seen?.length)
}

const DONE = "Done. You won't hear from me again unless you reach out. — Lacey"

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  return rsaPage((await goodbye(t)) ? DONE : UNKNOWN)
}

export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  const ok = await goodbye(t)
  return new Response(ok ? 'unsubscribed' : 'unknown', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}
