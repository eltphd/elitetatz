import { createAdminClient } from '@/lib/supabase/admin'
import { artistForInbound } from '@/lib/channels'
import { cronGate } from '@/lib/cron'
import { runDigest } from '@/lib/digest'

// The 7 PM digest to Lacey (vercel.json crons: 23:00 and 00:00 UTC; the tick
// that lands on 7 PM Eastern sends, the other returns `skipped`). Guarded by
// CRON_SECRET like /api/cron/holds. `?force=1` with the bearer sends now,
// whatever the hour, for a check after a deploy.
//
//   GET /api/cron/digest → { sent, skipped, newToday, unanswered, probe }

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const refused = cronGate(req, 'The daily digest')
  if (refused) return refused
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const artist = await artistForInbound(db)
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 503 })
  const force = new URL(req.url).searchParams.get('force') === '1'
  try {
    const result = await runDigest(db, artist.id, { force })
    console.log(`digest: ${result.sent ? 'sent' : 'not sent'}${result.skipped ? ` (${result.skipped})` : ''}, new ${result.newToday}, waiting ${result.unanswered}, probe ${result.probe}`)
    return Response.json(result)
  } catch (err) {
    console.error('digest:', err)
    return Response.json({ error: 'Digest run failed' }, { status: 500 })
  }
}
