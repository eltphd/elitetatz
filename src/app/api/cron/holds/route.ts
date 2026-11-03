import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { artistForInbound } from '@/lib/channels'
import { runHolds } from '@/lib/holds'

// Hourly (vercel.json crons). Vercel calls it with `Authorization: Bearer
// $CRON_SECRET`; with no secret set the route does not exist (503), so a
// deployment without the variable can never message anyone.
//
//   GET /api/cron/holds → { checked, due, sent: [{ match_id, hold }], skipped }

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) return Response.json({ error: 'Hold timers are off (CRON_SECRET)' }, { status: 503 })
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const artist = await artistForInbound(db)
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 503 })
  try {
    const result = await runHolds(db, artist.id)
    console.log(`holds: checked ${result.checked}, due ${result.due}, sent ${result.sent.length}${result.skipped ? ` (${result.skipped})` : ''}`)
    return Response.json(result)
  } catch (err) {
    console.error('holds:', err)
    return Response.json({ error: 'Hold run failed' }, { status: 500 })
  }
}
