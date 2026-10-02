'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Shield, CheckCircle, Loader2, CalendarDays } from 'lucide-react'
import Link from 'next/link'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

type Quote = {
  amount: number
  concept: string
  proposedDates: string | null
  offeredPriceCents: number | null
  clientName: string | null
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function DepositForm({ matchId, t, amount }: { matchId: string; t: string; amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confirmedUrl = `/deposit/${matchId}/confirmed?t=${encodeURIComponent(t)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError('')
    setLoading(true)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${confirmedUrl}` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setLoading(false)
      setError(stripeError.message ?? 'Payment failed')
      return
    }
    // Card paid without a redirect: the webhook records it; the confirmed
    // page reads the match and shows the date (or where to find it).
    router.push(confirmedUrl)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <PaymentElement />

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-[#c9a84c] text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Pay {dollars(amount)} deposit
      </button>
    </form>
  )
}

export function DepositClient({ matchId, t }: { matchId: string; t: string }) {
  const [clientSecret, setClientSecret] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const inquiryHref = `/inquiry/${matchId}?t=${encodeURIComponent(t)}`
  const confirmedHref = `/deposit/${matchId}/confirmed?t=${encodeURIComponent(t)}`

  useEffect(() => {
    let cancelled = false
    fetch('/api/stripe/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, t }),
    })
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (data.amount) {
          setQuote({
            amount: data.amount,
            concept: data.concept ?? 'your tattoo',
            proposedDates: data.proposedDates ?? null,
            offeredPriceCents: data.offeredPriceCents ?? null,
            clientName: data.clientName ?? null,
          })
        }
        if (data.alreadyPaid) { setAlreadyPaid(true); return }
        if (!ok || data.error) { setError(data.error ?? 'Could not load this deposit'); return }
        setClientSecret(data.clientSecret)
      })
      .catch(() => { if (!cancelled) setError('Could not load the payment form. Refresh to try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId, t])

  const amount = quote?.amount ?? 10000

  return (
    <main className="max-w-lg mx-auto px-4 pt-6 pb-12">
      {/* The quote and what the deposit does */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold">Booking deposit</p>
          <p className="text-xl font-bold text-[#c9a84c]">{dollars(amount)}</p>
        </div>
        {quote && (
          <p className="text-xs text-[#9b9b9b] mb-3">
            For <span className="text-white">{quote.concept}</span>
            {quote.offeredPriceCents ? (
              <> · Lacey&apos;s quote: <span className="text-white">{dollars(quote.offeredPriceCents)}</span></>
            ) : null}
          </p>
        )}

        {quote?.proposedDates && (
          <div className="flex items-start gap-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 mb-3">
            <CalendarDays className="w-4 h-4 text-[#c9a84c] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Proposed dates</p>
              <p className="text-xs text-white whitespace-pre-wrap">{quote.proposedDates}</p>
            </div>
          </div>
        )}

        <ul className="space-y-1.5">
          {[
            'Holds your appointment time with Lacey',
            `The ${dollars(amount)} deposit comes off your final price`,
            'The balance is paid at the studio when you come in',
            'Non-refundable for no-shows or last-minute cancels',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-[#9b9b9b]">
              <span className="text-[#c9a84c] mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
        {quote?.offeredPriceCents ? (
          <p className="text-[11px] text-[#6b6b6b] mt-3">
            Pay {dollars(amount)} now, {dollars(Math.max(quote.offeredPriceCents - amount, 0))} at the studio.
          </p>
        ) : null}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
        </div>
      )}

      {alreadyPaid && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-800/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">This deposit is already paid</h2>
          <p className="text-sm text-[#9b9b9b] mb-6">Nothing more to pay online. The balance is settled at the studio.</p>
          <Link href={confirmedHref} className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
            See your booking
          </Link>
        </div>
      )}

      {error && !alreadyPaid && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
          <p className="mt-2 text-xs text-red-300/80">
            <Link href={inquiryHref} className="underline">Back to your inquiry</Link>
          </p>
        </div>
      )}

      {clientSecret && !alreadyPaid && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#c9a84c',
                colorBackground: '#1e1e1e',
                colorText: '#ffffff',
                colorTextSecondary: '#6b6b6b',
                borderRadius: '12px',
              },
            },
          }}
        >
          <DepositForm matchId={matchId} t={t} amount={amount} />
        </Elements>
      )}

      <div className="flex items-center justify-center gap-2 mt-6">
        <Shield className="w-3.5 h-3.5 text-[#6b6b6b]" />
        <p className="text-[11px] text-[#6b6b6b]">Paid to TatzAI · secured by Stripe · card details never touch our servers</p>
      </div>
    </main>
  )
}
