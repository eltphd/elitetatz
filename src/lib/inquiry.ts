import type { createAdminClient } from '@/lib/supabase/admin'

type Db = NonNullable<ReturnType<typeof createAdminClient>>

// One open inquiry per contact per artist per day. A repeat (a double submit,
// or someone replaying a request) is added to the existing thread and the
// artist hears about it, but it opens no second inquiry and returns no link,
// so it cannot be used to message a stranger twice or to read an existing
// inquiry. Returns the id of the inquiry it belongs to, or null.
export async function recentInquiry(db: Db, artistId: string, email: string, phone: string): Promise<string | null> {
  // Quoted, because phone numbers carry parentheses and commas that the
  // PostgREST or() grammar would otherwise read as syntax.
  const q = (v: string) => `"${v.replace(/["\\]/g, '')}"`
  const contactFilters = [
    email ? `client_email.eq.${q(email)}` : null,
    phone ? `client_phone.eq.${q(phone)}` : null,
  ].filter(Boolean)
  if (!contactFilters.length) return null

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await db
    .from('matches')
    .select('id')
    .eq('artist_id', artistId)
    .gte('created_at', since)
    .or(contactFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
  const row = Array.isArray(recent) ? recent[0] : recent
  return row && typeof row === 'object' && 'id' in row ? String((row as { id: string }).id) : null
}

export async function hasRecentInquiry(db: Db, artistId: string, email: string, phone: string): Promise<boolean> {
  return Boolean(await recentInquiry(db, artistId, email, phone))
}

// "$400–$700" → { min: 40000, max: 70000 }; "$1,200+" → { min: 120000 }.
export function parseBudget(label: string): { budget_min_cents?: number; budget_max_cents?: number } {
  const nums = (label.match(/\$?\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/[$,]/g, '')) * 100).filter((n) => n > 0)
  if (!nums.length) return {}
  if (nums.length === 1) return label.includes('+') ? { budget_min_cents: nums[0], budget_max_cents: nums[0] } : { budget_max_cents: nums[0] }
  return { budget_min_cents: Math.min(...nums), budget_max_cents: Math.max(...nums) }
}
