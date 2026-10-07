/**
 * @jest-environment node
 */
import { randomBytes } from 'crypto'

describe('google token crypto', () => {
  const OLD = process.env
  beforeEach(() => { process.env = { ...OLD, GOOGLE_TOKEN_KEY: randomBytes(32).toString('base64') } })
  afterAll(() => { process.env = OLD })

  it('round-trips a refresh token and never stores plaintext', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/google/crypto')
    const enc = encryptToken('1//refresh-token-value')
    expect(enc.startsWith('v1.')).toBe(true)
    expect(enc).not.toContain('refresh-token-value')
    expect(decryptToken(enc)).toBe('1//refresh-token-value')
  })

  it('refuses a tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/google/crypto')
    const parts = encryptToken('secret').split('.')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptToken(parts.join('.'))).toThrow()
  })

  it('reports not configured for a missing or short key', async () => {
    const { tokenCryptoConfigured } = await import('@/lib/google/crypto')
    process.env.GOOGLE_TOKEN_KEY = ''
    expect(tokenCryptoConfigured()).toBe(false)
    process.env.GOOGLE_TOKEN_KEY = randomBytes(16).toString('base64')
    expect(tokenCryptoConfigured()).toBe(false)
  })
})

describe('google oauth state and scopes', () => {
  const OLD = process.env
  beforeEach(() => { process.env = { ...OLD, MATCH_TOKEN_SECRET: 'test-secret', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' } })
  afterAll(() => { process.env = OLD })

  it('accepts state only for the same artist and matching cookie', async () => {
    const { newState, verifyState } = await import('@/lib/google/oauth')
    const { nonce, state } = newState('artist-a')
    expect(verifyState(state, nonce, 'artist-a')).toBe(true)
    expect(verifyState(state, nonce, 'artist-b')).toBe(false)
    expect(verifyState(state, 'other-nonce', 'artist-a')).toBe(false)
    expect(verifyState(state, undefined, 'artist-a')).toBe(false)
    expect(verifyState(null, nonce, 'artist-a')).toBe(false)
  })

  it('asks Google for read-only Gmail and Calendar, offline, with a consent screen', async () => {
    const { authUrl } = await import('@/lib/google/oauth')
    const u = new URL(authUrl({ origin: 'https://elitetatz.vercel.app', state: 's', loginHint: 'lacey@rawsunart.com' }))
    const scope = u.searchParams.get('scope') ?? ''
    expect(scope).toContain('gmail.readonly')
    expect(scope).toContain('calendar.readonly')
    expect(scope).not.toMatch(/gmail\.(send|modify|compose)|auth\/calendar(\s|$)|calendar\.events(\s|$)/)
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
    expect(u.searchParams.get('redirect_uri')).toBe('https://elitetatz.vercel.app/api/artist/google/callback')
  })

  it('flags a consent where the artist unticked Gmail or Calendar', async () => {
    const { missingScopes } = await import('@/lib/google/oauth')
    expect(missingScopes('openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly')).toEqual([])
    expect(missingScopes('openid email https://www.googleapis.com/auth/gmail.readonly')).toEqual(['https://www.googleapis.com/auth/calendar.readonly'])
  })

  it('reads the account email from the id token', async () => {
    const { emailFromIdToken } = await import('@/lib/google/oauth')
    const payload = Buffer.from(JSON.stringify({ email: 'Lacey@RawSunArt.com' })).toString('base64url')
    expect(emailFromIdToken(`h.${payload}.s`)).toBe('lacey@rawsunart.com')
    expect(emailFromIdToken(undefined)).toBeNull()
    expect(emailFromIdToken('garbage')).toBeNull()
  })
})
