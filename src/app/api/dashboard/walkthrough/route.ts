import { artistContext } from '@/lib/artist-session'
import { setWalkthroughDismissed } from '@/lib/onboarding'

// The artist's "Got it" on the first-visit walkthrough, and the way back.
// Writes one timestamp on her own artist row (migration 017). Nothing is
// sent anywhere and no lead is touched.
//
// POST { dismissed: true }  → records now
// POST { dismissed: false } → clears it; the card shows again

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof payload.dismissed !== 'boolean') return Response.json({ error: 'dismissed must be true or false' }, { status: 400 })

  const result = await setWalkthroughDismissed(ctx.db, ctx.artist.id, payload.dismissed)
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ ok: true, dismissedAt: result.dismissedAt })
}
