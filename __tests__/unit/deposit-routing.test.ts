/**
 * @jest-environment node
 */
import { depositLinkFor, platformDepositsOn } from '@/lib/deposit'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Decided 2026-10-17: the pilot is lead generation and deposits go to AION's
// own checkout. A Stripe key added for any other reason must not move them.

const ENV = { ...process.env }
const MATCH = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  process.env = { ...ENV, MATCH_TOKEN_SECRET: 'test-secret' }
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.PLATFORM_DEPOSITS
  delete process.env.ARTIST_EXTERNAL_DEPOSIT_URL
})
afterAll(() => { process.env = ENV })

describe('deposit routing', () => {
  it('sends clients to the shop checkout by default', () => {
    expect(depositLinkFor(MATCH)).toEqual({ url: ARTIST_CONFIG.externalDepositUrl, external: true })
  })

  it('keeps the shop checkout when only a Stripe key is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    expect(platformDepositsOn()).toBe(false)
    expect(depositLinkFor(MATCH)).toEqual({ url: ARTIST_CONFIG.externalDepositUrl, external: true })
  })

  it('keeps the shop checkout when the flag is on but there is no key', () => {
    process.env.PLATFORM_DEPOSITS = 'on'
    expect(depositLinkFor(MATCH).external).toBe(true)
  })

  it('uses the platform deposit page only with the flag and a key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.PLATFORM_DEPOSITS = 'on'
    const link = depositLinkFor(MATCH)
    expect(link.external).toBe(false)
    expect(link.url).toContain(`/deposit/${MATCH}?t=`)
  })

  it('honours an override for the shop checkout', () => {
    process.env.ARTIST_EXTERNAL_DEPOSIT_URL = 'https://square.example/checkout'
    expect(depositLinkFor(MATCH).url).toBe('https://square.example/checkout')
  })
})
