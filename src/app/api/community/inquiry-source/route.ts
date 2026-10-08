import { createAdminClient } from '@/lib/supabase/admin'
import { checkAbuse } from '@/lib/rate-limit'
import { cleanLabel } from '@/lib/labels'
import { corsHeaders, preflight } from '@/lib/cors'

// Counts where rawsunart.com inquiries come from, with no person in them.
//
// Kept for older copies of rawsunart.com; new inquiries are counted by /api/community/inquiry. Body:
// { source: "instagram" }. Only the source label and a timestamp are stored:
// no name, email, IP or message. The monthly scorecard reads the counts, so
// nobody has to tally inquiry emails by hand.
//
// Public and unauthenticated like the other /api/community routes, so it is
// rate limited. It sends no mail, so the worst a bot can do is skew a count.

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)
  const limited = checkAbuse('inquiry-source', req, { max: 10, windowMs: 10 * 60_000, maxPerDay: 500 }, headers)
  if (limited) return limited

  let body: { source?: unknown; artistHandle?: unknown }
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers }) }

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Not configured' }, { status: 503, headers })

  const artistHandle = cleanLabel(body.artistHandle, 'rawsunart')
  const { error } = await db.from('inquiry_sources').insert({ artist_handle: artistHandle, source: cleanLabel(body.source, 'direct') })
  if (error) return Response.json({ error: 'Could not record' }, { status: 500, headers })
  return Response.json({ ok: true }, { headers })
}
