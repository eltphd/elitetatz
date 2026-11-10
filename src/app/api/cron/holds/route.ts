import { createAdminClient } from '@/lib/supabase/admin'
import { artistForInbound } from '@/lib/channels'
import { cronGate } from '@/lib/cron'
import { runHolds } from '@/lib/holds'
import { sweepReceipts, type ReceiptSweep } from '@/lib/delivery'

// Hourly (vercel.json crons). Vercel calls it with `Authorization: Bearer
// $CRON_SECRET`; with no secret set the route does not exist (503), so a
// deployment without the variable can never message anyone (src/lib/cron.ts).
//
// Two jobs on the one tick. The hold timers, which only send between 9 AM and
// 8 PM Eastern. And the receipt sweep, at every hour: an email to Lacey that
// Resend accepted but her mail server has not confirmed after 15 minutes is
// reported to the operator once (src/lib/delivery.ts). The sweep writes to
// the operator only, never to her or a client.
//
//   GET /api/cron/holds → { checked, due, sent: [{ match_id, hold }], skipped, receipts }

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const refused = cronGate(req, 'Hold timers')
  if (refused) return refused
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const artist = await artistForInbound(db)
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 503 })

  // Its own try: a sweep that fails must not stop the holds, or the reverse.
  let receipts: ReceiptSweep | { error: string }
  try {
    receipts = await sweepReceipts(db)
  } catch (err) {
    console.error('receipt sweep:', err)
    receipts = { error: 'Receipt sweep failed' }
  }

  try {
    const result = await runHolds(db, artist.id)
    console.log(`holds: checked ${result.checked}, due ${result.due}, sent ${result.sent.length}${result.skipped ? ` (${result.skipped})` : ''}; receipts ${JSON.stringify(receipts)}`)
    return Response.json({ ...result, receipts })
  } catch (err) {
    console.error('holds:', err)
    return Response.json({ error: 'Hold run failed' }, { status: 500 })
  }
}
