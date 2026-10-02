/**
 * @jest-environment node
 */
import { signMatch, verifyMatch, signBrief, verifyBrief, linksConfigured } from '@/lib/tokens'

const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV } })

describe('inquiry and deposit links', () => {
  beforeEach(() => { process.env.MATCH_TOKEN_SECRET = 'test-secret' })

  it('accepts a fresh link for its own match only', () => {
    const t = signMatch('match-a')
    expect(verifyMatch('match-a', t)).toBe(true)
    expect(verifyMatch('match-b', t)).toBe(false)
  })

  it('stops opening after it expires', () => {
    const issued = Date.UTC(2026, 0, 1)
    const t = signMatch('match-a', issued)
    expect(verifyMatch('match-a', t, issued + 119 * 86_400_000)).toBe(true)
    expect(verifyMatch('match-a', t, issued + 121 * 86_400_000)).toBe(false)
  })

  it('rejects a link whose expiry was edited', () => {
    const [, sig] = signMatch('match-a').split('.')
    const later = Math.floor(Date.now() / 1000 + 10 * 365 * 86_400).toString(36)
    expect(verifyMatch('match-a', `${later}.${sig}`)).toBe(false)
  })

  it('rejects the old unsigned-expiry format and junk', () => {
    expect(verifyMatch('match-a', 'abc')).toBe(false)
    expect(verifyMatch('match-a', '')).toBe(false)
    expect(verifyMatch('match-a', null)).toBe(false)
  })
})

describe('without a secret in production', () => {
  it('issues and accepts nothing, rather than borrowing another key', () => {
    delete process.env.MATCH_TOKEN_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    expect(linksConfigured()).toBe(false)
    expect(() => signMatch('match-a')).toThrow()
    expect(verifyMatch('match-a', 'x.y')).toBe(false)
  })
})

describe('concierge briefs', () => {
  beforeEach(() => { process.env.MATCH_TOKEN_SECRET = 'test-secret' })
  const brief = { client_email: 'a@example.com', concept: 'peony', styles: ['watercolor'], budget_max_cents: 50000 }

  it('verifies the exact brief regardless of key order', () => {
    const t = signBrief(brief)
    const reordered = { styles: ['watercolor'], budget_max_cents: 50000, concept: 'peony', client_email: 'a@example.com' }
    expect(verifyBrief(reordered, t)).toBe(true)
  })

  it('rejects a brief whose contact details were swapped', () => {
    const t = signBrief(brief)
    expect(verifyBrief({ ...brief, client_email: 'stranger@example.com' }, t)).toBe(false)
  })

  it('rejects a brief with no token or an old one', () => {
    const issued = Date.now() - 3 * 60 * 60 * 1000
    expect(verifyBrief(brief, undefined)).toBe(false)
    expect(verifyBrief(brief, signBrief(brief, issued))).toBe(false)
  })
})
