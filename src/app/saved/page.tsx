'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Star, MapPin, Heart, Sparkles } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { MOCK_ARTISTS } from '@/lib/mock-data'
import { formatPrice } from '@/lib/utils'

// Mock: first 3 artists are "saved"
const SAVED = MOCK_ARTISTS.slice(0, 3)

export default function SavedPage() {
  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold">Saved Artists</h1>
            <p className="text-[10px] text-[#6b6b6b]">{SAVED.length} saved</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {SAVED.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-10 h-10 text-[#6b6b6b] mx-auto mb-4 opacity-40" />
            <p className="text-sm text-[#6b6b6b] mb-2">No saved artists yet</p>
            <p className="text-xs text-[#6b6b6b] mb-5">Tap the heart on any artist profile to save them</p>
            <Link href="/explore" className="text-[#c9a84c] text-sm font-medium">Browse artists →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {SAVED.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="flex items-center gap-3 p-4 bg-[#141414] border border-[#2a2a2a] rounded-2xl hover:border-[#c9a84c]/30 transition-colors"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image
                    src={artist.portfolio_images[0]}
                    alt={artist.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{artist.name}</p>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                      className="shrink-0"
                    >
                      <Heart className="w-4 h-4 text-[#c9a84c] fill-[#c9a84c]" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[#6b6b6b]">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs">{artist.location_city}, {artist.location_state}</span>
                    <Star className="w-3 h-3 text-[#c9a84c] fill-[#c9a84c]" />
                    <span className="text-xs text-[#c9a84c]">{artist.rating}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {artist.styles.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full capitalize text-[#6b6b6b]">{s}</span>
                      ))}
                    </div>
                    <span className="text-xs text-[#c9a84c] ml-auto font-medium">From {formatPrice(artist.min_piece_cents)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {SAVED.length > 0 && (
          <div className="mt-6 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 text-center">
            <Sparkles className="w-5 h-5 text-[#c9a84c] mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Ready to pick one?</p>
            <p className="text-xs text-[#6b6b6b] mb-3">Let TatzAI match you with the best fit from your saved list.</p>
            <Link href="/agent" className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-semibold px-5 py-2.5 rounded-xl text-sm">
              Start with TatzAI
            </Link>
          </div>
        )}
      </main>

      <BottomNav active="profile" />
    </div>
  )
}
