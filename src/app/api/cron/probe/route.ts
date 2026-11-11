import { createAdminClient } from '@/lib/supabase/admin'
import { cronGate } from '@/lib/cron'
import { runProbe } from '@/lib/probe'

// The morning synthetic inquiry (vercel.json crons: 13:00 and 14:00 UTC; the
// tick that lands on 9 AM Eastern runs, the other returns `skipped`). Guarded
// by CRON_SECRET like /api/cron/holds. `?force=1` with the bearer runs it now,
// which is how the first probe after a deploy is done by hand.
//
//   GET /api/cron/probe → { ok, checks: { posted, logged, match, source }, error, ref, skipped }

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const refused = cronGate(req, 'The daily probe')
  if (refused) return refused
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const force = new URL(req.url).searchParams.get('force') === '1'
  try {
    const result = await runProbe(db, { force })
    return Response.json(result, { status: result.skipped || result.ok ? 200 : 500 })
  } catch (err) {
    console.error('probe:', err)
    return Response.json({ error: 'Probe run failed' }, { status: 500 })
  }
}
