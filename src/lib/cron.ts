import { timingSafeEqual } from 'crypto'

// One gate for every /api/cron/* route. Vercel calls a cron with
// `Authorization: Bearer $CRON_SECRET`; with no secret set the route does not
// exist (503), so a deployment without the variable can never message anyone.
// Same rule as /api/cron/holds, shared so the digest and the probe cannot
// drift from it.

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** The refusal to return, or null when the request may run. */
export function cronGate(req: Request, what: string): Response | null {
  if (!process.env.CRON_SECRET?.trim()) return Response.json({ error: `${what} is off (CRON_SECRET)` }, { status: 503 })
  if (!cronAuthorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}
