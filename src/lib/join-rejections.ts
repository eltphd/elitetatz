import type { SupabaseClient } from '@supabase/supabase-js'
import { clientIp } from '@/lib/rate-limit'
import { hashIp } from '@/lib/tokens'

// One row per sign-up the route turned away: reason, keyed IP hash, user agent.
// Best effort — a logging failure never changes the response.
export async function logRejection(
  supabase: SupabaseClient | null,
  artistHandle: string,
  reason: string,
  req: Request
): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('join_rejections').insert({
      artist_handle: artistHandle,
      reason: reason.slice(0, 40),
      ip_hash: hashIp(clientIp(req)),
      ua: (req.headers.get('user-agent') ?? '').slice(0, 200) || null,
    })
  } catch (err) {
    console.warn('join_rejections insert failed', err)
  }
}
