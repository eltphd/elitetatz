import { createHmac, timingSafeEqual } from 'crypto'

// Signed links for anonymous clients: /inquiry/<matchId>?t=<token> and
// /deposit/<matchId>?t=<token>. No account required; the token is the proof.
function secret(): string {
  return process.env.MATCH_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-only-secret'
}

export function signMatch(matchId: string): string {
  return createHmac('sha256', secret()).update(matchId).digest('base64url').slice(0, 32)
}

export function verifyMatch(matchId: string, token: string | null | undefined): boolean {
  if (!matchId || !token) return false
  const expected = Buffer.from(signMatch(matchId))
  const given = Buffer.from(String(token))
  return expected.length === given.length && timingSafeEqual(expected, given)
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
