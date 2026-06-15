'use client'

import { useState, useEffect, use } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { ArrowLeft, Shield, CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function DepositForm({ matchId, depositDollars }: { matchId: string; depositDollars: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setError('')
    setLoading(true)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/deposit/${matchId}/confirmed`,
      },
      redirect: 'if_required',
    })

    setLoading(false)
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-800/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">Deposit paid!</h2>
        <p className="text-sm text-[#9b9b9b] mb-1">Your ${depositDollars} deposit is confirmed.</p>
        <p className="text-sm text-[#9b9b9b] mb-6">Lacey will reach out to confirm your appointment date.</p>
        <Link href="/matches" className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
          View your project
        </Link>
      </div>
    )
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
        Pay ${depositDollars} Deposit
      </button>
    </form>
  )
}

export default function DepositPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params)
  const [clientSecret, setClientSecret] = useState('')
  const [depositDollars, setDepositDollars] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/stripe/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return }
        setClientSecret(data.clientSecret)
        setDepositDollars(data.depositDollars)
      })
      .catch(() => setError('Failed to load payment'))
      .finally(() => setLoading(false))
  }, [matchId])

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/matches" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">Reserve Your Appointment</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 pb-12">
        {/* What you're paying for */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Booking deposit</p>
            <p className="text-xl font-bold text-[#c9a84c]">${depositDollars}</p>
          </div>
          <ul className="space-y-1.5">
            {[
              'Holds your appointment time with Lacey',
              'Credited toward your final tattoo price',
              'Non-refundable for no-shows or last-minute cancels',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[#9b9b9b]">
                <span className="text-[#c9a84c] mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {clientSecret && (
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
            <DepositForm matchId={matchId} depositDollars={depositDollars} />
          </Elements>
        )}

        <div className="flex items-center justify-center gap-2 mt-6">
          <Shield className="w-3.5 h-3.5 text-[#6b6b6b]" />
          <p className="text-[11px] text-[#6b6b6b]">Secured by Stripe · TatzAI never stores card details</p>
        </div>
      </main>
    </div>
  )
}
