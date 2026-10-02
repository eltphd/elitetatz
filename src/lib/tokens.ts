import { createHmac, timingSafeEqual } from 'crypto'

// Signed links for anonymous clients: /inquiry/<matchId>?t=<token> and
// /deposit/<matchId>?t=<token>. No account required; the token is the proof.
//
// A token is "<expiry, base36 seconds>.<signature>". Every message we send
// mints a fresh one, so an active thread keeps working while a link that has
// sat untouched for LINK_TTL_DAYS stops opening the brief, thread and deposit.
const LINK_TTL_DAYS = 120

// Fails closed: in production a missing MATCH_TOKEN_SECRET means no links at
// all, never links signed with a guessable or borrowed key.
function secret(): string | null {
  const s = process.env.MATCH_TOKEN_SECRET?.trim()
  if (s) return s
  return process.env.NODE_ENV === 'production' ? null : 'dev-only-secret'
}

export function linksConfigured(): boolean {
  return secret() !== null
}

function sign(payload: string): string {
  const key = secret()
  if (!key) throw new Error('MATCH_TOKEN_SECRET is not set')
  return createHmac('sha256', key).update(payload).digest('base64url').slice(0, 32)
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function signMatch(matchId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000 + LINK_TTL_DAYS * 86_400).toString(36)
  return `${exp}.${sign(`match.${matchId}.${exp}`)}`
}

export function verifyMatch(matchId: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!matchId || !token || !linksConfigured()) return false
  const [exp, sig] = String(token).split('.')
  if (!exp || !sig) return false
  const expSeconds = parseInt(exp, 36)
  if (!Number.isFinite(expSeconds) || expSeconds * 1000 < now) return false
  return safeEqual(sig, sign(`match.${matchId}.${exp}`))
}

// Proof that a brief came out of our own concierge stream. /api/agent signs the
// exact brief it parsed from the model; /api/brief refuses anything unsigned,
// altered, or older than BRIEF_TTL_MS. Without this, anyone could POST a brief
// and make us email or text any address from the rawsunart.com sender.
const BRIEF_TTL_MS = 2 * 60 * 60 * 1000

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function signBrief(brief: Record<string, unknown>, now = Date.now()): string {
  const issued = now.toString(36)
  return `${issued}.${sign(`brief.${issued}.${canonical(brief)}`)}`
}

export function verifyBrief(brief: Record<string, unknown>, token: string | null | undefined, now = Date.now()): boolean {
  if (!token || !linksConfigured()) return false
  const [issued, sig] = String(token).split('.')
  if (!issued || !sig) return false
  const issuedMs = parseInt(issued, 36)
  if (!Number.isFinite(issuedMs) || now - issuedMs > BRIEF_TTL_MS || issuedMs - now > 60_000) return false
  return safeEqual(sig, sign(`brief.${issued}.${canonical(brief)}`))
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://elitetatz.vercel.app').replace(/\/$/, '')
}

export function inquiryUrl(matchId: string): string {
  return `${appUrl()}/inquiry/${matchId}?t=${signMatch(matchId)}`
}

export function depositUrl(matchId: string): string {
  return `${appUrl()}/deposit/${matchId}?t=${signMatch(matchId)}`
}
