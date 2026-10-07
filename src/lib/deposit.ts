import { depositUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Which deposit link a client gets. The platform path (Stripe, 80/20 payout)
// wins when it is configured. Otherwise the shop's own checkout is the live
// path and the artist marks the deposit received by hand in her inbox.
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function externalDepositUrl(): string | null {
  const env = process.env.ARTIST_EXTERNAL_DEPOSIT_URL?.trim()
  return env || ARTIST_CONFIG.externalDepositUrl || null
}

export function depositLinkFor(matchId: string): { url: string | null; external: boolean } {
  if (stripeConfigured()) return { url: depositUrl(matchId), external: false }
  const ext = externalDepositUrl()
  return { url: ext, external: Boolean(ext) }
}
