'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Circle, AlertCircle, Loader2, ExternalLink, User, Store } from 'lucide-react'

type Target = 'artist' | 'shop'

type AccountState = {
  exists: boolean
  complete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsDue: string[]
  disabledReason: string | null
}

type PayoutState = {
  preference: Target
  shopName: string | null
  onboardingComplete: boolean
  depositCents: number
  shareCents: number
  artist: AccountState
  shop: AccountState
  heldCents: number
  heldCount: number
  sentCents: number
  sentCount: number
  recent: Array<{
    id: string
    status: string
    client: string
    concept: string
    target: Target
    shareCents: number
    sent: boolean
    at: string
  }>
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function statusOf(a: AccountState): { label: 'Complete' | 'Incomplete' | 'Not started'; cls: string } {
  if (!a.exists) return { label: 'Not started', cls: 'bg-[#1e1e1e] text-[#9b9b9b] border-[#2a2a2a]' }
  if (a.complete) return { label: 'Complete', cls: 'bg-green-900/20 text-green-400 border-green-800/30' }
  return { label: 'Incomplete', cls: 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30' }
}

export function PayoutsClient({
  banner,
}: {
  banner: { kind: 'connected' | 'refresh'; target: Target } | null
}) {
  const [state, setState] = useState<PayoutState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Target | 'prefer' | null>(null)
  const [error, setError] = useState('')
  const [shopName, setShopName] = useState('')

  // Bumping reloadKey re-runs the fetch (after a preference change). State
  // is only set from promise callbacks, never synchronously in the effect.
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch('/api/stripe/connect', { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) throw new Error(data.error ?? 'Could not load payout state')
        setState(data)
        setError('')
        if (data.shopName) setShopName((prev) => prev || data.shopName)
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load payout state') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reloadKey])

  async function connect(target: Target) {
    setBusy(target)
    setError('')
    try {
      const r = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, intent: 'onboard', shop_name: target === 'shop' ? shopName : undefined }),
      })
      const data = await r.json()
      if (!r.ok || !data.url) throw new Error(data.error ?? 'Stripe did not return a link')
      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Stripe setup')
      setBusy(null)
    }
  }

  async function prefer(target: Target) {
    if (!state || state.preference === target) return
    setBusy('prefer')
    setError('')
    try {
      const r = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, intent: 'prefer', shop_name: target === 'shop' ? shopName : undefined }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Could not save your choice')
      setState((s) => (s ? { ...s, preference: target } : s))
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
      </div>
    )
  }

  const share = state?.shareCents ?? 8000
  const deposit = state?.depositCents ?? 10000

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            banner.kind === 'connected'
              ? 'bg-green-900/20 border-green-800/40 text-green-300'
              : 'bg-[#c9a84c]/10 border-[#c9a84c]/30 text-[#c9a84c]'
          }`}
        >
          {banner.kind === 'connected'
            ? `Stripe sent you back from the ${banner.target === 'shop' ? 'shop' : 'personal'} account setup. The status below is live from Stripe; if it still says Incomplete, Stripe may need a document or a day to verify.`
            : `That Stripe link expired before you finished the ${banner.target === 'shop' ? 'shop' : 'personal'} setup. Hit the button again to pick up where you left off.`}
        </div>
      )}

      {/* Plain-language model */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5">
        <p className="text-sm leading-relaxed">
          Clients pay TatzAI. We keep 20% and send 80% of every deposit to the account you choose here.
          The balance of the tattoo is paid at the studio as usual.
        </p>
        <p className="text-xs text-[#6b6b6b] mt-2">
          On the {dollars(deposit)} pilot deposit that is {dollars(share)} to you per booking.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Held / sent */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`border rounded-xl p-4 ${state && state.heldCents > 0 ? 'bg-[#c9a84c]/5 border-[#c9a84c]/30' : 'bg-[#141414] border-[#2a2a2a]'}`}>
          <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-1">Held by TatzAI</p>
          <p className="text-2xl font-bold">{dollars(state?.heldCents ?? 0)}</p>
          <p className="text-[11px] text-[#9b9b9b] mt-1">
            {state?.heldCount
              ? `${state.heldCount} deposit${state.heldCount === 1 ? '' : 's'} waiting on a connected account`
              : 'Nothing waiting'}
          </p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-1">Sent to you</p>
          <p className="text-2xl font-bold">{dollars(state?.sentCents ?? 0)}</p>
          <p className="text-[11px] text-[#9b9b9b] mt-1">
            {state?.sentCount ? `${state.sentCount} deposit${state.sentCount === 1 ? '' : 's'} transferred` : 'No transfers yet'}
          </p>
        </div>
      </div>

      {state && state.heldCents > 0 && (
        <p className="text-xs text-[#c9a84c] -mt-2">
          Held money is real and yours. It moves the moment the account you&apos;ve chosen below shows Complete; TatzAI pays it out by hand until then.
        </p>
      )}

      {/* Two destinations */}
      <section className="space-y-3">
        <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Where the 80% goes</p>

        <DestinationCard
          target="artist"
          title="Pay me directly"
          subtitle="Your own Stripe Express account, in your name."
          icon={<User className="w-4 h-4 text-[#6b6b6b]" />}
          account={state?.artist ?? EMPTY}
          selected={state?.preference === 'artist'}
          busy={busy}
          onConnect={() => connect('artist')}
          onPrefer={() => prefer('artist')}
        />

        <DestinationCard
          target="shop"
          title="Pay my shop"
          subtitle="A Stripe Express account for the studio; the shop settles with you."
          icon={<Store className="w-4 h-4 text-[#6b6b6b]" />}
          account={state?.shop ?? EMPTY}
          selected={state?.preference === 'shop'}
          busy={busy}
          onConnect={() => connect('shop')}
          onPrefer={() => prefer('shop')}
          shopName={shopName}
          onShopName={setShopName}
        />
      </section>

      {/* Recent deposits */}
      {state && state.recent.length > 0 && (
        <section>
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">Recent deposits</p>
          <div className="space-y-2">
            {state.recent.map((r) => (
              <div key={r.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.client} · {r.concept}</p>
                  <p className="text-[10px] text-[#6b6b6b]">
                    {new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {r.target === 'shop' ? 'shop' : 'you'} · {r.status}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{dollars(r.shareCents)}</p>
                  <p className={`text-[10px] ${r.sent ? 'text-green-400' : 'text-[#c9a84c]'}`}>{r.sent ? 'sent' : 'held'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const EMPTY: AccountState = {
  exists: false, complete: false, chargesEnabled: false, payoutsEnabled: false,
  detailsSubmitted: false, requirementsDue: [], disabledReason: null,
}

function DestinationCard({
  target,
  title,
  subtitle,
  icon,
  account,
  selected,
  busy,
  onConnect,
  onPrefer,
  shopName,
  onShopName,
}: {
  target: Target
  title: string
  subtitle: string
  icon: React.ReactNode
  account: AccountState
  selected: boolean
  busy: Target | 'prefer' | null
  onConnect: () => void
  onPrefer: () => void
  shopName?: string
  onShopName?: (v: string) => void
}) {
  const status = statusOf(account)
  const canPrefer = account.exists
  const needsName = target === 'shop' && !account.exists && !(shopName ?? '').trim()

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${selected ? 'border-[#c9a84c]/40' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <label className={`flex items-start gap-3 ${canPrefer ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
          <input
            type="radio"
            name="payout_preference"
            value={target}
            checked={selected}
            disabled={!canPrefer || busy !== null}
            onChange={onPrefer}
            className="sr-only"
          />
          <span className="mt-0.5">
            {selected
              ? <CheckCircle className="w-5 h-5 text-[#c9a84c]" />
              : <Circle className={`w-5 h-5 ${canPrefer ? 'text-[#6b6b6b]' : 'text-[#2a2a2a]'}`} />}
          </span>
          <span>
            <span className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">{icon}</span>
              <span className="text-sm font-semibold">{title}</span>
            </span>
            <span className="block text-xs text-[#9b9b9b] mt-1">{subtitle}</span>
          </span>
        </label>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${status.cls}`}>{status.label}</span>
      </div>

      {target === 'shop' && onShopName && (
        <div className="mb-3">
          <label className="block text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-1" htmlFor="shop_name">Shop name</label>
          <input
            id="shop_name"
            value={shopName ?? ''}
            onChange={(e) => onShopName(e.target.value)}
            placeholder="e.g. AION Tattoo"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#c9a84c]/50"
          />
        </div>
      )}

      {account.exists && !account.complete && (
        <div className="flex items-start gap-2 text-xs text-[#c9a84c] mb-3">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>
            {account.disabledReason
              ? `Stripe says: ${account.disabledReason.replace(/_/g, ' ')}.`
              : account.requirementsDue.length
                ? `Stripe still needs: ${account.requirementsDue.slice(0, 3).map((r) => r.replace(/[._]/g, ' ')).join(', ')}${account.requirementsDue.length > 3 ? '…' : ''}.`
                : 'Stripe is still verifying this account.'}
            {' '}Payouts are held until it shows Complete.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onConnect}
          disabled={busy !== null || needsName}
          className={`inline-flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 ${
            account.complete ? 'bg-[#1e1e1e] border border-[#2a2a2a] text-white' : 'bg-[#c9a84c] text-black'
          }`}
        >
          {busy === target && <Loader2 className="w-4 h-4 animate-spin" />}
          {account.complete ? 'Open Stripe dashboard' : account.exists ? 'Finish setup' : 'Connect with Stripe'}
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </button>
        {selected && <span className="text-[11px] text-[#c9a84c]">Receiving payouts</span>}
        {!selected && canPrefer && (
          <button type="button" onClick={onPrefer} disabled={busy !== null} className="text-[11px] text-[#9b9b9b] underline underline-offset-2 disabled:opacity-50">
            Use this account
          </button>
        )}
      </div>
      {needsName && <p className="text-[11px] text-[#6b6b6b] mt-2">Add the shop name to start its Stripe setup.</p>}
    </div>
  )
}
