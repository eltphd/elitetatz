import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// The private tables (artists, matches, conversations, clients, messages) are
// deny-all under RLS: neither the browser key nor a signed-in user's session
// can read them. Artist pages and routes prove who is signed in with the
// session, then read and write through the service role, always filtered to
// that artist's own rows. Isolation is enforced here, on the server.
export type ArtistContext<A> =
  | { ok: true; user: User; artist: A; db: SupabaseClient }
  | { ok: false; status: 401 | 403 | 503; error: string }

export async function artistContext<A extends { id: string } = { id: string; name: string | null }>(
  columns = 'id, name',
): Promise<ArtistContext<A>> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }

  const db = createAdminClient()
  if (!db) return { ok: false, status: 503, error: 'Storage is not configured' }

  const { data: artist } = await db.from('artists').select(columns).eq('user_id', user.id).maybeSingle()
  if (!artist) return { ok: false, status: 403, error: 'Not an artist account' }

  return { ok: true, user, artist: artist as unknown as A, db }
}
