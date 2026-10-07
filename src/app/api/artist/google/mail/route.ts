import { artistContext } from '@/lib/artist-session'
import { searchMail } from '@/lib/google/api'

// GET /api/artist/google/mail?q=<gmail query>&max=10
// Read-only search of the signed-in artist's own Gmail. Metadata and
// Google's snippet only; nothing is stored.
export async function GET(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').slice(0, 500)
  if (!q.trim()) return Response.json({ error: 'q is required' }, { status: 400 })
  const max = Number(url.searchParams.get('max') ?? 10) || 10
  const r = await searchMail(ctx.db, ctx.artist.id, q, max)
  return r.ok
    ? Response.json({ account: r.googleEmail, messages: r.data })
    : Response.json({ error: r.error }, { status: r.status })
}
