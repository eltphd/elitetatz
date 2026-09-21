import Stripe from 'stripe'

// One Stripe client for the whole server. Constructed lazily: `new Stripe()`
// throws when the key is missing, and we don't want a module import to take
// down a build or an unrelated route. The SDK pins its own API version.
let cached: Stripe | undefined

export function getStripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    cached = new Stripe(key, { appInfo: { name: 'TatzAI' } })
  }
  return cached
}

// Same instance, reachable as a plain value: `stripe.paymentIntents.create(...)`.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const real = getStripe()
    const value = Reflect.get(real, prop)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

// Platform economics for the pilot: TatzAI keeps 20% of every deposit and
// forwards 80% to whichever connected account the artist chose.
export const PLATFORM_FEE_RATE = 0.2
export const ARTIST_SHARE_RATE = 0.8

export function artistShareCents(amountCents: number): number {
  return Math.floor(amountCents * ARTIST_SHARE_RATE)
}

// Display name for what a match is about, used in descriptions, receipts and
// notifications. The brief is JSON when the concierge produced it.
export function matchConcept(match: { client_brief?: string | null; ai_summary?: string | null }): string {
  try {
    const brief = JSON.parse(match.client_brief ?? '{}') as { concept?: unknown }
    if (typeof brief.concept === 'string' && brief.concept.trim()) return brief.concept.trim()
  } catch {}
  return match.ai_summary?.trim() || 'your tattoo'
}
