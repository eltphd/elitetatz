'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Zap, MapPin, Star, CheckCircle, X, ArrowLeft } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { FlashCard } from '@/components/FlashCard'
import { MOCK_FLASH } from '@/lib/mock-data'
import { formatPrice } from '@/lib/utils'

const STYLE_FILTERS = ['All', 'blackwork', 'fine-line', 'japanese', 'watercolor', 'traditional', 'geometric']

export default function FlashPage() {
  const [selectedStyle, setSelectedStyle] = useState('All')
  const [selected, setSelected] = useState<typeof MOCK_FLASH[0] | null>(null)

  const filtered = MOCK_FLASH.filter(
    (f) => selectedStyle === 'All' || f.style === selectedStyle
  )

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#c9a84c]" />
            <h1 className="text-lg font-bold">Flash Drop</h1>
            <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#c9a84c]/15 text-[#c9a84c] rounded-full border border-[#c9a84c]/30 font-medium">
              1-of-1
            </span>
          </div>
          <p className="text-xs text-[#6b6b6b]">Pre-drawn designs · Fixed price · Instant book</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {/* How it works banner */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 mb-4 flex items-start gap-3">
          <Zap className="w-4 h-4 text-[#c9a84c] shrink-0 mt-0.5" />
          <p className="text-xs text-[#6b6b6b] leading-relaxed">
            Flash designs are ready-to-tattoo. Buy one, it's yours alone — the listing disappears the moment you pay. No agent needed, no waiting for quotes.
          </p>
        </div>

        {/* Style filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          {STYLE_FILTERS.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border font-medium capitalize transition-colors ${
                selectedStyle === style
                  ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                  : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#6b6b6b] mb-3">
          {filtered.filter((f) => !f.sold).length} available · {filtered.filter((f) => f.sold).length} sold
        </p>

        <div className="grid grid-cols-2 gap-3">
          {filtered.map((flash) => (
            <FlashCard key={flash.id} flash={flash} onSelect={setSelected} />
          ))}
        </div>
      </main>

      {/* Detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]">
          <div className="relative w-full aspect-square">
            <Image
              src={selected.image_url}
              alt={selected.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {selected.sold && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold text-xl tracking-widest uppercase">Sold</span>
              </div>
            )}
            {!selected.sold && (
              <div className="absolute top-4 left-4 px-2.5 py-1 bg-[#c9a84c] rounded-full">
                <span className="text-[10px] font-bold text-black uppercase tracking-widest">Available</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold">{selected.title}</h2>
              <p className="text-xl font-bold text-[#c9a84c] shrink-0">{formatPrice(selected.price_cents)}</p>
            </div>

            <p className="text-sm text-[#6b6b6b] leading-relaxed mb-4">{selected.description}</p>

            <div className="flex items-center gap-4 mb-4 text-xs text-[#6b6b6b]">
              <span className="capitalize px-2.5 py-1 bg-[#1e1e1e] rounded-full border border-[#2a2a2a]">{selected.style}</span>
              <span>{selected.size_inches}" piece</span>
            </div>

            <div className="mb-4">
              <p className="text-xs text-[#6b6b6b] mb-2">Works well on</p>
              <div className="flex gap-2 flex-wrap">
                {selected.placement_suggestions.map((p) => (
                  <span key={p} className="text-xs px-2.5 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full capitalize">{p}</span>
                ))}
              </div>
            </div>

            {/* Artist info */}
            <Link
              href={`/artist/${selected.artist_id}`}
              className="flex items-center gap-3 p-3 bg-[#141414] border border-[#2a2a2a] rounded-xl mb-6"
            >
              <Image
                src={selected.artist.avatar_url}
                alt={selected.artist.name}
                width={40}
                height={40}
                className="rounded-full border border-[#2a2a2a]"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold">{selected.artist.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-[#c9a84c] fill-[#c9a84c]" />
                    <span className="text-xs text-[#c9a84c]">{selected.artist.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#6b6b6b]">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs">{selected.artist.location_city}</span>
                  </div>
                </div>
              </div>
              <CheckCircle className="w-4 h-4 text-[#c9a84c]" />
            </Link>

            {/* What you get */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-white mb-3">What securing this design includes</p>
              {[
                'Exclusive rights to this design — listing closes immediately',
                'Direct booking with the artist',
                'Design saved to your Vault',
                'TatzAI coordinates the appointment details',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#c9a84c] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6b6b6b]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 border-t border-[#2a2a2a] bg-[#0a0a0a]">
            <button
              disabled={selected.sold}
              className="w-full bg-[#c9a84c] disabled:bg-[#2a2a2a] disabled:text-[#6b6b6b] text-black font-bold py-4 rounded-2xl text-sm transition-colors"
            >
              {selected.sold ? 'This design has been claimed' : `Secure This Design · ${formatPrice(selected.price_cents)}`}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="explore" />
    </div>
  )
}
