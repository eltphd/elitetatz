/**
 * @jest-environment node
 */
import { signStamp, verifyStamp, hashIp } from '@/lib/tokens'

const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV } })

describe('form stamp', () => {
  beforeEach(() => { process.env.MATCH_TOKEN_SECRET = 'test-secret' })
  const t0 = Date.UTC(2026, 9, 16, 12, 0, 0)

  it('accepts a stamp between 3 seconds and 24 hours old', () => {
    const t = signStamp(t0)
    expect(verifyStamp(t, t0 + 3_000)).toBe('ok')
    expect(verifyStamp(t, t0 + 23 * 3_600_000)).toBe('ok')
  })
  it('calls a post made in under 3 seconds fast', () => {
    expect(verifyStamp(signStamp(t0), t0 + 1_500)).toBe('fast')
  })
  it('calls a stamp older than a day stale', () => {
    expect(verifyStamp(signStamp(t0), t0 + 25 * 3_600_000)).toBe('stale')
  })
  it('rejects a missing, edited or foreign stamp', () => {
    expect(verifyStamp(undefined, t0)).toBe('missing')
    expect(verifyStamp('', t0)).toBe('missing')
    const [issued, sig] = signStamp(t0).split('.')
    expect(verifyStamp(`${(parseInt(issued!, 36) - 10_000).toString(36)}.${sig}`, t0 + 5_000)).toBe('forged')
    process.env.MATCH_TOKEN_SECRET = 'other-secret'
    expect(verifyStamp(`${issued}.${sig}`, t0 + 5_000)).toBe('forged')
  })
  it('hashes an address to a short keyed token', () => {
    expect(hashIp('203.0.113.9')).toHaveLength(16)
    expect(hashIp('203.0.113.9')).toBe(hashIp('203.0.113.9'))
    expect(hashIp('203.0.113.9')).not.toBe(hashIp('203.0.113.10'))
  })
})
