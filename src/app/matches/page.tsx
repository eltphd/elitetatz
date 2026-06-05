'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BottomNav } from '@/components/BottomNav'
import { Star, MapPin, CheckCircle, Clock, XCircle, Sparkles } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

// Placeholder — in production this comes from Supabase realtime
const MOCK_MATCHES = [
  {
    id: 'm1',
    status: 'pending',
    ai_summary: 'Blackwork geometric sleeve, forearm to elbow. Budget $1,200–$1,800.',
    offered_price_cents: 150000,
    artist: {
      id: '1',
      name: 'Marco Vega',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
      location_city: 'New York',
      location_state: 'NY',
      rating: 4.9,
      styles: ['blackwork', 'geometric'],
    },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
]

const STATUS_CONFIG = {
  pending: { label: 'Awaiting Artist', color: 'text-yellow-400', icon: Clock, bg: 'bg-yellow-400/10' },
  accepted: { label: 'Artist Accepted!', color: 'text-green-400', icon: CheckCircle, bg: 'bg-green-400/10' },
  rejected: { label: 'Not Available', color: 'text-red-400', icon: XCircle, bg: 'bg-red-400/10' },
  completed: { label: 'Completed', color: 'text-[#c9a84c]', icon: Star, bg: 'bg-[#c9a84c]/10' },
  paid: { label: 'Booked', color: 'text-[#c9a84c]', icon: CheckCircle, bg: 'bg-[#c9a84c]/10' },
}

export default function MatchesPage() {
  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">My Matches</h1>
          <p className="text-xs text-[#6b6b6b]">Track your artist requests</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {MOCK_MATCHES.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-[#c9a84c] mx-auto mb-4 opacity-40" />
            <p className="text-[#6b6b6b] text-sm mb-4">No matches yet</p>
            <Link href="/agent" className="text-[#c9a84c] text-sm font-medium">
              Start with TatzAI →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_MATCHES.map((match) => {
              const cfg = STATUS_CONFIG[match.status as keyof typeof STATUS_CONFIG]
              const Icon = cfg.icon
              return (
                <div key={match.id} className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Image
                      src={match.artist.avatar_url}
                      alt={match.artist.name}
                      width={48}
                      height={48}
                      className="rounded-full border border-[#2a2a2a]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{match.artist.name}</p>
                      <div className="flex items-center gap-1 text-[#6b6b6b]">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs">{match.artist.location_city}, {match.artist.location_state}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${cfg.bg}`}>
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                      <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#6b6b6b] mb-3 leading-relaxed">{match.ai_summary}</p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#6b6b6b]">Offered price</p>
                      <p className="text-base font-bold text-[#c9a84c]">{formatPrice(match.offered_price_cents)}</p>
                    </div>
                    {match.status === 'accepted' && (
                      <button className="bg-[#c9a84c] text-black text-sm font-semibold px-4 py-2 rounded-xl">
                        Pay & Book
                      </button>
                    )}
                    {match.status === 'pending' && (
                      <p className="text-xs text-[#6b6b6b]">Usually 24–48h</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav active="notifications" />
    </div>
  )
}
