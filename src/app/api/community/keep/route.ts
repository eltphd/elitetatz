import { createAdminClient } from '@/lib/supabase/admin'
import { rsaPage, TOKEN_RE, UNKNOWN } from '@/lib/rsa-page'

export const dynamic = 'force-dynamic'

// "Keep me on the list" from the reconnect email: rsa_contacts.send_token is the
// only auth. Sets keep_clicked_at and consent_status = confirmed. Never
// un-unsubscribes: a goodbye already recorded stays recorded.

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') ?? ''
  if (!TOKEN_RE.test(t)) return rsaPage(UNKNOWN)
  const supabase = createAdminClient()
  if (!supabase) return rsaPage(UNKNOWN)
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('rsa_contacts')
    .update({ keep_clicked_at: now, consent_status: 'confirmed', updated_at: now })
    .eq('send_token', t)
    .is('unsubscribed_at', null)
    .select('id')
  if (!data?.length) return rsaPage(UNKNOWN)
  return rsaPage("You're in. Thanks for sticking around. — Lacey")
}
