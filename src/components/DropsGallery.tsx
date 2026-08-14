'use client'

import { useState } from 'react'
import type { ArtistDropsConfig, DropItem } from '@/lib/community/drops'

// Client half of /drops/[artist]: the claim flow. Tapping "Claim it" expands
// an inline form; success turns the card into a "Lacey will email you" state.

function ClaimCard({ artist, item }: { artist: ArtistDropsConfig; item: DropItem }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const price = `$${(item.priceCents / 100).toFixed(0)}`
  const sold = item.status !== 'available'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return
    setStatus('sending')
    try {
      const res = await fetch('/api/community/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistHandle: artist.artistHandle,
          dropSlug: item.slug,
          email: email.trim(),
          name: name.trim(),
          note: note.trim(),
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

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
        {!sold && item.boothQty > 0 && (
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-wider text-[#c9a050]">
            ✦ Only {item.boothQty} at the booth · then online
          </p>
        )}

        {sold ? (
          <div className="rounded-full border border-[rgba(201,160,80,0.15)] py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#6a5f4a]">
            {item.status === 'sold' ? 'Sold' : 'Reserved'}
          </div>
        ) : status === 'done' ? (
          <div className="rounded-lg border border-dashed border-[rgba(201,160,80,0.5)] bg-[rgba(201,160,80,0.12)] p-3 text-center text-xs text-[#f0ebe0]">
            🎉 Claimed — {artist.artistFirstName} will email you directly to arrange it.
          </div>
        ) : open ? (
          <form onSubmit={submit} className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-4 py-2.5 text-sm text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]"
            />
            <input
              type="email"
              required
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-4 py-2.5 text-sm text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Booth pickup or ship? Any questions?"
              className="w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-4 py-2.5 text-sm text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-full bg-[#c9a050] py-3 text-xs font-bold uppercase tracking-wider text-[#0a0805] transition-colors hover:bg-[#e0b96a] disabled:opacity-70"
            >
              {status === 'sending' ? 'Sending…' : `Claim ${item.title}`}
            </button>
            {status === 'error' && (
              <p className="text-center text-xs text-[#c06040]">
                Glitch — try again or DM {artist.instagramHandle}.
              </p>
            )}
          </form>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="w-full rounded-full bg-[#c9a050] py-3 text-xs font-bold uppercase tracking-wider text-[#0a0805] transition-colors hover:bg-[#e0b96a]"
          >
            Love it → Claim it
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
        <ClaimCard key={item.slug} artist={artist} item={item} />
      ))}
    </div>
  )
}
