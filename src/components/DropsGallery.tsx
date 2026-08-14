'use client'

import { useState, useEffect } from 'react'
import type { ArtistDropsConfig, DropItem } from '@/lib/community/drops'

// Client half of /drops/[artist]: booth reservation flow.
// Reserve → pickup code + "print N of M" + 20-minute hold countdown.
// If reservations aren't configured (no Supabase/Resend yet), falls back to a
// simple claim that emails the artist.

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  if (left <= 0) return <span className="text-[#c06040]">Hold expired — order online instead.</span>
  return (
    <span>
      Show it at the booth within{' '}
      <strong className="text-[#c9a050]">
        {m}:{s.toString().padStart(2, '0')}
      </strong>
    </span>
  )
}

function ReserveCard({ artist, item }: { artist: ArtistDropsConfig; item: DropItem }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'reserved' | 'claimed' | 'soldout' | 'error'>('idle')
  const [result, setResult] = useState<{ code?: string; boothIndex?: number; total?: number; expiresAt?: string }>({})
  const [errMsg, setErrMsg] = useState('')

  const price = `$${(item.priceCents / 100).toFixed(0)}`
  const sold = item.status !== 'available'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return
    setStatus('sending')
    setErrMsg('')
    const payload = { artistHandle: artist.artistHandle, dropSlug: item.slug, email: email.trim(), name: name.trim() }
    try {
      // Try the reservation flow first (code + hold).
      const res = await fetch('/api/community/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.soldOut) { setStatus('soldout'); return }
        setResult(data)
        setStatus('reserved')
        return
      }
      if (res.status !== 503) throw new Error()
      // Reservations not configured → fall back to a plain claim.
      const claim = await fetch('/api/community/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!claim.ok) throw new Error()
      setStatus('claimed')
    } catch {
      setStatus('error')
      setErrMsg(`Glitch — try again or DM ${artist.instagramHandle}.`)
    }
  }

  const inputCls =
    'w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-4 py-2.5 text-sm text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]'

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(201,160,80,0.15)] bg-[#181410]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imageUrl} alt={item.title} loading="lazy" className="aspect-square w-full object-cover" />
      <div className="p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="font-serif text-lg text-[#f0ebe0]">{item.title}</span>
          <span className="font-semibold text-[#c9a050]">{price}</span>
        </div>
        <p className="mb-2 text-xs text-[#a09070]">{item.description}</p>
        {!sold && status === 'idle' && item.boothQty > 0 && (
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-wider text-[#c9a050]">
            ✦ Only {item.boothQty} at the booth · then online
          </p>
        )}

        {sold ? (
          <div className="rounded-full border border-[rgba(201,160,80,0.15)] py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#6a5f4a]">
            {item.status === 'sold' ? 'Sold' : 'Reserved'}
          </div>
        ) : status === 'reserved' ? (
          <div className="rounded-lg border border-dashed border-[rgba(201,160,80,0.5)] bg-[rgba(201,160,80,0.12)] p-3 text-center">
            <div className="text-[0.62rem] uppercase tracking-widest text-[#8a6f2e]">
              Print {result.boothIndex} of {result.total} · your code
            </div>
            <div className="my-1 text-3xl font-extrabold tracking-[0.3em] text-[#f0ebe0]">{result.code}</div>
            <p className="text-[0.72rem] text-[#a09070]">
              {result.expiresAt ? <Countdown expiresAt={result.expiresAt} /> : null}
            </p>
            <p className="mt-1 text-[0.68rem] text-[#6a5f4a]">Also emailed to you. Show it to Lacey to pick up.</p>
          </div>
        ) : status === 'claimed' ? (
          <div className="rounded-lg border border-dashed border-[rgba(201,160,80,0.5)] bg-[rgba(201,160,80,0.12)] p-3 text-center text-xs text-[#f0ebe0]">
            🎉 Claimed — {artist.artistFirstName} will email you to arrange it.
          </div>
        ) : status === 'soldout' ? (
          <div className="rounded-lg border border-[rgba(201,160,80,0.15)] p-3 text-center text-xs text-[#a09070]">
            Booth copies are gone — <a href={artist.siteUrl} className="text-[#c9a050]">order online</a>.
          </div>
        ) : open ? (
          <form onSubmit={submit} className="space-y-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" className={inputCls} />
            <input type="email" required inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={inputCls} />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-full bg-[#c9a050] py-3 text-xs font-bold uppercase tracking-wider text-[#0a0805] transition-colors hover:bg-[#e0b96a] disabled:opacity-70"
            >
              {status === 'sending' ? 'Reserving…' : `Reserve for booth pickup`}
            </button>
            {status === 'error' && <p className="text-center text-xs text-[#c06040]">{errMsg}</p>}
          </form>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="w-full rounded-full bg-[#c9a050] py-3 text-xs font-bold uppercase tracking-wider text-[#0a0805] transition-colors hover:bg-[#e0b96a]"
          >
            Reserve · Pick up at booth
          </button>
        )}
      </div>
    </div>
  )
}

export default function DropsGallery({ artist }: { artist: ArtistDropsConfig }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {artist.items.map((item) => (
        <ReserveCard key={item.slug} artist={artist} item={item} />
      ))}
    </div>
  )
}
