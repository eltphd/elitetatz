import Link from 'next/link'
import { CheckCircle, CalendarDays, Clock, AlertTriangle } from 'lucide-react'
import { verifyMatch, inquiryUrl } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'
import { matchConcept } from '@/lib/stripe'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Landing page after the deposit. Reached two ways: our own router.push after
// an in-page card confirmation, or Stripe's return_url after a redirect-based
// payment method (which appends payment_intent and redirect_status).

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

export default async function DepositConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { matchId } = await params
  const sp = await searchParams
  const t = first(sp.t)
  const redirectStatus = first(sp.redirect_status)

  if (!verifyMatch(matchId, t)) {
    return (
      <Shell>
        <h1 className="text-xl font-bold mb-2">This link isn&apos;t valid</h1>
        <p className="text-sm text-[#9b9b9b]">Open the link from the email or text Lacey sent you.</p>
      </Shell>
    )
  }

  const db = createAdminClient()
  const { data: match } = db
    ? await db
        .from('matches')
        .select('id, status, appointment_at, client_name, client_brief, ai_summary, offered_price_cents')
        .eq('id', matchId)
        .single()
    : { data: null }

  const inquiry = inquiryUrl(matchId)
  const firstName = ARTIST_CONFIG.name.split(' ')[0]
  const deposit = ARTIST_CONFIG.depositCents / 100

  if (redirectStatus === 'failed') {
    return (
      <Shell icon={<AlertTriangle className="w-7 h-7 text-red-400" />} tone="red">
        <h1 className="text-xl font-bold mb-2">The payment didn&apos;t go through</h1>
        <p className="text-sm text-[#9b9b9b] mb-6">Nothing was charged. You can try another card from your deposit link.</p>
        <Link href={`/deposit/${matchId}?t=${encodeURIComponent(t as string)}`} className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
          Try again
        </Link>
      </Shell>
    )
  }

  const settled = match ? ['paid', 'booked', 'completed'].includes(match.status) : false
  const concept = match ? matchConcept(match) : 'your tattoo'

  if (!settled) {
    // Card went through client-side but the webhook hasn't landed yet, or a
    // bank redirect is still processing. Don't claim more than we know.
    return (
      <Shell icon={<Clock className="w-7 h-7 text-[#c9a84c]" />} tone="gold">
        <h1 className="text-xl font-bold mb-2">Confirming your deposit</h1>
        <p className="text-sm text-[#9b9b9b] mb-1">
          Stripe is finishing the ${deposit} deposit for <span className="text-white">{concept}</span>. This usually takes a few seconds.
        </p>
        <p className="text-sm text-[#9b9b9b] mb-6">
          You&apos;ll get an email and a text as soon as it lands, and your inquiry page will show it as paid.
        </p>
        <a href={inquiry} className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
          Open your inquiry page
        </a>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold mb-2">
        {match?.client_name ? `${match.client_name}, you're booked in` : "You're booked in"}
      </h1>
      <p className="text-sm text-[#9b9b9b] mb-5">
        Your ${deposit} deposit for <span className="text-white">{concept}</span> is confirmed. It comes off your final price; the balance is paid at the studio.
      </p>

      {match?.appointment_at ? (
        <div className="flex items-start gap-3 bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-left mb-6">
          <CalendarDays className="w-5 h-5 text-[#c9a84c] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-0.5">Your appointment</p>
            <p className="text-sm font-semibold">{formatWhen(match.appointment_at)}</p>
            <p className="text-xs text-[#9b9b9b] mt-1">{ARTIST_CONFIG.address}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-left mb-6">
          <Clock className="w-5 h-5 text-[#c9a84c] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-0.5">Next step</p>
            <p className="text-sm font-semibold">{firstName} will confirm your date on your inquiry page.</p>
            <p className="text-xs text-[#9b9b9b] mt-1">You&apos;ll get an email and a text when she does.</p>
          </div>
        </div>
      )}

      <a href={inquiry} className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
        Open your inquiry page
      </a>
      <p className="text-[11px] text-[#6b6b6b] mt-4">Keep that link — it&apos;s where {firstName} answers and where your date shows up.</p>
    </Shell>
  )
}

function Shell({
  children,
  icon,
  tone = 'green',
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  tone?: 'green' | 'gold' | 'red'
}) {
  const ring = {
    green: 'bg-green-900/20 border-green-800/40',
    gold: 'bg-[#c9a84c]/10 border-[#c9a84c]/30',
    red: 'bg-red-900/20 border-red-800/40',
  }[tone]
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className={`w-16 h-16 rounded-full border flex items-center justify-center mx-auto mb-5 ${ring}`}>
          {icon ?? <CheckCircle className="w-7 h-7 text-green-400" />}
        </div>
        {children}
      </div>
    </div>
  )
}
