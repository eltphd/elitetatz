// Abuse controls for the public, unauthenticated endpoints.
//
// Why this exists: every public endpoint here can trigger an outbound email.
// CORS does NOT protect them — `Access-Control-Allow-Origin` is enforced by
// browsers, and a scripted bot using curl/fetch ignores it entirely. Without
// the limits below, one POST loop floods the artist's inbox indefinitely.
//
// Two independent layers, because they stop different attacks:
//   1. perIp()      — one noisy client hammering from a single address.
//   2. circuit()    — a distributed bot rotating IPs. Caps total sends per
//                     endpoint per day no matter where they come from, so the
//                     worst case is a bounded number of emails, not unlimited.
//
// State is in-memory, so it is per-instance and resets on cold start. On Fluid
// Compute instances are reused across many requests, so this is meaningfully
// effective. It is a mitigation, not a guarantee: for hard protection enable
// Vercel BotID on these routes, which verifies the caller before the function
// body ever runs.

interface Hit {
  count: number
  resetAt: number
}

const ipBuckets = new Map<string, Hit>()
const dayBuckets = new Map<string, Hit>()

// Bound memory: a flood of unique IPs must not grow the map without limit.
const MAX_TRACKED_IPS = 10_000

function sweep(map: Map<string, Hit>, now: number): void {
  for (const [key, hit] of map) {
    if (hit.resetAt <= now) map.delete(key)
  }
}

/** Best-effort client address. Vercel sets x-forwarded-for; first hop is the client. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

export interface LimitResult {
  ok: boolean
  retryAfterSeconds: number
}

/**
 * Sliding-ish window per IP per endpoint.
 * Defaults: 5 requests / 10 minutes — generous for a human filling a form once,
 * useless for a bot.
 */
export function perIp(
  endpoint: string,
  ip: string,
  { max = 5, windowMs = 10 * 60_000 } = {}
): LimitResult {
  const now = Date.now()
  if (ipBuckets.size > MAX_TRACKED_IPS) sweep(ipBuckets, now)

  const key = `${endpoint}:${ip}`
  const hit = ipBuckets.get(key)

  if (!hit || hit.resetAt <= now) {
    ipBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: 0 }
  }

  hit.count += 1
  if (hit.count > max) {
    return { ok: false, retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfterSeconds: 0 }
}

/**
 * Daily circuit breaker per endpoint, across all callers.
 * This is the layer that matters against an IP-rotating bot: it bounds how many
 * emails the artist can possibly receive in a day from a given endpoint.
 */
export function circuit(endpoint: string, { maxPerDay = 100 } = {}): LimitResult {
  const now = Date.now()
  sweep(dayBuckets, now)

  const hit = dayBuckets.get(endpoint)
  if (!hit || hit.resetAt <= now) {
    dayBuckets.set(endpoint, { count: 1, resetAt: now + 24 * 60 * 60_000 })
    return { ok: true, retryAfterSeconds: 0 }
  }

  hit.count += 1
  if (hit.count > maxPerDay) {
    return { ok: false, retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfterSeconds: 0 }
}

/**
 * Runs both layers. Returns a ready-to-send 429, or null to proceed.
 * Deliberately vague in the response body — a bot should not learn which
 * limit it tripped or how close it is to the cap.
 */
export function checkAbuse(
  endpoint: string,
  req: Request,
  opts: { max?: number; windowMs?: number; maxPerDay?: number } = {},
  headers: Record<string, string> = {}
): Response | null {
  const ip = perIp(endpoint, clientIp(req), opts)
  if (!ip.ok) return tooMany(ip.retryAfterSeconds, headers)

  const day = circuit(endpoint, opts)
  if (!day.ok) return tooMany(day.retryAfterSeconds, headers)

  return null
}

function tooMany(retryAfterSeconds: number, headers: Record<string, string>): Response {
  return Response.json(
    { error: 'Too many requests. Try again later.' },
    {
      status: 429,
      headers: { ...headers, 'Retry-After': String(retryAfterSeconds) },
    }
  )
}

/**
 * Honeypot: a field real users never see and never fill, but naive form bots do.
 * Render it visually hidden and off the tab order. A filled value means bot —
 * the caller should return a fake success so the bot does not learn it failed.
 */
export function isBot(body: Record<string, unknown>): boolean {
  const trap = body._gotcha ?? body.website ?? body.url_field
  return typeof trap === 'string' && trap.trim().length > 0
}
