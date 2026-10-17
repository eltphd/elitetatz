import { depositUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Which deposit link a client gets. Decided 2026-10-17: the pilot is lead
// generation, so deposits go to the shop's own checkout (AION) and the artist
// marks them received in her inbox. The platform path (Stripe, 80/20 payout)
// is opt-in: it takes PLATFORM_DEPOSITS=on as well as a Stripe key, so adding
// Stripe keys for anything else never moves a client's deposit.
export function platformDepositsOn(): boolean {
  const flag = (process.env.PLATFORM_DEPOSITS ?? '').trim()
  return /^(1|true|on|yes)$/i.test(flag) && Boolean(process.env.STRIPE_SECRET_KEY)
}

export function externalDepositUrl(): string | null {
  const env = process.env.ARTIST_EXTERNAL_DEPOSIT_URL?.trim()
  return env || ARTIST_CONFIG.externalDepositUrl || null
}

export function depositLinkFor(matchId: string): { url: string | null; external: boolean } {
  if (platformDepositsOn()) return { url: depositUrl(matchId), external: false }
  const ext = externalDepositUrl()
  return { url: ext, external: Boolean(ext) }
}
