import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

// Google OAuth for the artist's own Gmail and Calendar, read-only.
//
// This is deliberately a separate step from signing in. "Continue with
// Google" on the login page asks Google for identity only (name and email,
// handled by Supabase Auth). Letting the assistant read mail and calendar is
// a second, explicit consent on /dashboard/connections, with its own Google
// consent screen, and it can be withdrawn there at any time.

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const

export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
]

// Bump when the consent wording on /dashboard/connections changes. The log
// records which wording each artist agreed to.
export const CONSENT_VERSION = '2026-10-06'

export const STATE_COOKIE = 'gc_state'

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
}

export function redirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin
  return `${base.replace(/\/$/, '')}/api/artist/google/callback`
}

// State binds the Google round trip to the artist who started it. The random
// nonce goes in an httpOnly cookie; the URL carries nonce + HMAC(nonce, artist).
function stateSecret(): string {
  const s = process.env.MATCH_TOKEN_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!s) throw new Error('No secret available to sign OAuth state')
  return s
}

export function newState(artistId: string): { nonce: string; state: string } {
  const nonce = randomBytes(18).toString('base64url')
  const mac = createHmac('sha256', stateSecret()).update(`${nonce}.${artistId}`).digest('base64url')
  return { nonce, state: `${nonce}.${mac}` }
}

export function verifyState(state: string | null, cookieNonce: string | undefined, artistId: string): boolean {
  if (!state || !cookieNonce) return false
  const [nonce, mac] = state.split('.')
  if (!nonce || !mac || nonce !== cookieNonce) return false
  const expected = createHmac('sha256', stateSecret()).update(`${nonce}.${artistId}`).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function authUrl(opts: { origin: string; state: string; loginHint?: string | null }): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri(opts.origin),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    // Always show the consent screen so Google returns a refresh token and
    // the artist sees exactly what they are agreeing to.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: opts.state,
  })
  if (opts.loginHint) p.set('login_hint', opts.loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

export interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
  token_type: string
}

export class GoogleAuthError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
  }
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      ...body,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new GoogleAuthError(json.error_description || json.error || `Token request failed (${res.status})`, json.error)
  return json as TokenResponse
}

export function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(origin) })
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

export async function revokeToken(token: string): Promise<void> {
  // Best effort: a token Google already revoked returns 400, which is fine.
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

/** The Google account email, read from the id_token Google just returned over TLS. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null
  } catch {
    return null
  }
}

export function missingScopes(granted: string): string[] {
  const have = new Set(granted.split(/\s+/))
  return REQUIRED_SCOPES.filter((s) => !have.has(s))
}
