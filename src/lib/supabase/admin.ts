import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Service-role client for server API routes that write on behalf of
// unauthenticated visitors (community signups, artist leads).
// Never import this from client components.
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
