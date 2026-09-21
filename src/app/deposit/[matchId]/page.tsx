import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'
import { verifyMatch } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { DepositClient } from './DepositClient'

// Anonymous client, signed link. The token travels with every request the
// page makes, so the deposit API can prove the visitor owns this inquiry.

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { matchId } = await params
  const t = first((await searchParams).t)
  const valid = verifyMatch(matchId, t)

  // Quote and dates render server-side so the client sees them even before
  // Stripe loads (or if payments are not configured yet).
  let quote: { price: number | null; dates: string | null; concept: string } | null = null
  if (valid) {
    const admin = createAdminClient()
    const { data } = admin
      ? await admin.from('matches').select('offered_price_cents, proposed_dates, ai_summary, status').eq('id', matchId).single()
      : { data: null }
    if (data) quote = { price: data.offered_price_cents ?? null, dates: data.proposed_dates ?? null, concept: data.ai_summary ?? '' }
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {valid ? (
            <Link
              href={`/inquiry/${matchId}?t=${encodeURIComponent(t as string)}`}
              className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors"
              aria-label="Back to your inquiry"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          ) : (
            <span className="p-2 -ml-2"><Lock className="w-5 h-5 text-[#6b6b6b]" /></span>
          )}
          <h1 className="text-base font-bold">Reserve your appointment</h1>
        </div>
      </header>

      {valid && t ? (
        <>
          {quote && (
            <section className="max-w-lg mx-auto px-4 pt-6">
              <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
                {quote.concept && <p className="text-sm text-[#9b9b9b] mb-1">{quote.concept}</p>}
                {quote.price != null && (
                  <p className="text-lg font-bold">
                    Quote: ${(quote.price / 100).toLocaleString()}
                    <span className="text-sm font-normal text-[#9b9b9b]"> · ${ARTIST_CONFIG.depositCents / 100} deposit today</span>
                  </p>
                )}
                {quote.dates && <p className="text-sm mt-2"><span className="text-[#9b9b9b]">Proposed dates:</span> {quote.dates}</p>}
                <p className="text-xs text-[#6b6b6b] mt-2">The deposit comes off your final price. The balance is paid at the studio.</p>
              </div>
            </section>
          )}
          <DepositClient matchId={matchId} t={t} />
        </>
      ) : (
        <main className="max-w-lg mx-auto px-4 pt-10 pb-12 text-center">
          <h2 className="text-lg font-bold mb-2">This deposit link isn&apos;t valid</h2>
          <p className="text-sm text-[#9b9b9b]">
            Open the link from the email or text Lacey sent you. If it keeps failing, reply to that
            email and she&apos;ll send a fresh one.
          </p>
        </main>
      )}
    </div>
  )
}
