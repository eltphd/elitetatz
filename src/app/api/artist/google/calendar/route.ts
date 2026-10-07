import { artistContext } from '@/lib/artist-session'
import { upcomingEvents } from '@/lib/google/api'

// GET /api/artist/google/calendar?days=14
// Read-only list of the signed-in artist's upcoming events (primary calendar).
export async function GET(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const days = Number(new URL(req.url).searchParams.get('days') ?? 14) || 14
  const r = await upcomingEvents(ctx.db, ctx.artist.id, days)
  return r.ok
    ? Response.json({ account: r.googleEmail, events: r.data })
    : Response.json({ error: r.error }, { status: r.status })
}
