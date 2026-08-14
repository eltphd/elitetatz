import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Service-role client for server API routes that write on behalf of
// unauthenticated visitors (community signups, artist leads).
// Never import this from client components.
// Returns null when the env is missing OR malformed — callers respond 503
// and front-ends fall back (e.g. to Formspree) instead of hard-failing.
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !/^https?:\/\/.+\..+/.test(url) || !serviceKey) return null
  try {
    return createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch {
    return null
  }
}
