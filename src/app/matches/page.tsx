'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { ProjectTimeline } from '@/components/ProjectTimeline'
import { Star, MapPin, Sparkles } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { ProjectStage } from '@/lib/types'

const MOCK_MATCHES = [
  {
    id: 'm1',
    status: 'accepted',
    stage: 'sketching' as ProjectStage,
    ai_summary: 'Blackwork geometric sleeve, forearm to elbow. 5–6 inch piece.',
    offered_price_cents: 150000,
    final_price_cents: 150000,
    artist: {
      id: '1',
      name: 'Marco Vega',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
      location_city: 'New York',
      location_state: 'NY',
      rating: 4.9,
      styles: ['blackwork', 'geometric'],
    },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2',
    status: 'pending',
    stage: 'pending' as ProjectStage,
    ai_summary: 'Fine line botanical piece, inner wrist. Budget $280–$350.',
    offered_price_cents: 32000,
    final_price_cents: undefined,
    artist: {
      id: '3',
      name: 'Sofia Reyes',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
      location_city: 'Miami',
      location_state: 'FL',
      rating: 4.8,
      styles: ['fine-line', 'portrait'],
    },
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3',
    status: 'completed',
    stage: 'completed' as ProjectStage,
    ai_summary: 'Traditional panther, forearm. Flash piece from Tex.',
    offered_price_cents: 22000,
    final_price_cents: 22000,
    artist: {
      id: '6',
      name: 'Tex Williams',
      avatar_url: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?w=200&q=80',
      location_city: 'Houston',
      location_state: 'TX',
      rating: 4.8,
      styles: ['traditional'],
    },
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export default function MatchesPage() {
  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">My Projects</h1>
          <p className="text-xs text-[#6b6b6b]">{MOCK_MATCHES.length} active requests</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {MOCK_MATCHES.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-[#c9a84c] mx-auto mb-4 opacity-40" />
            <p className="text-[#6b6b6b] text-sm mb-4">No projects yet</p>
            <Link href="/agent" className="text-[#c9a84c] text-sm font-medium">
              Start with TatzAI →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {MOCK_MATCHES.map((match) => (
              <div
                key={match.id}
                className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden"
                data-testid={`match-card-${match.id}`}
              >
                {/* Artist header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
                  <Image
                    src={match.artist.avatar_url}
                    alt={match.artist.name}
                    width={44}
                    height={44}
                    className="rounded-full border border-[#2a2a2a]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{match.artist.name}</p>
                    <div className="flex items-center gap-2 text-[#6b6b6b]">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs">{match.artist.location_city}</span>
                      <Star className="w-3 h-3 text-[#c9a84c] fill-[#c9a84c]" />
                      <span className="text-xs text-[#c9a84c]">{match.artist.rating}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6b6b6b]">
                      {match.final_price_cents ? 'Agreed price' : 'Offer'}
                    </p>
                    <p className="text-base font-bold text-[#c9a84c]">
                      {formatPrice(match.final_price_cents ?? match.offered_price_cents)}
                    </p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="px-4 pt-3 pb-1">
                  <ProjectTimeline stage={match.stage} />
                </div>

                {/* Brief summary */}
                <div className="px-4 pb-4">
                  <p className="text-xs text-[#6b6b6b] leading-relaxed mb-3">{match.ai_summary}</p>

                  <div className="flex gap-2">
                    {match.stage === 'approval' && (
                      <button className="flex-1 bg-[#c9a84c] text-black font-semibold py-2.5 rounded-xl text-xs">
                        Review Sketch
                      </button>
                    )}
                    {match.stage === 'accepted' && (
                      <button className="flex-1 bg-[#c9a84c] text-black font-semibold py-2.5 rounded-xl text-xs">
                        Pay Deposit
                      </button>
                    )}
                    {match.stage === 'completed' && (
                      <button className="flex-1 bg-[#1e1e1e] border border-[#c9a84c]/30 text-[#c9a84c] font-medium py-2.5 rounded-xl text-xs">
                        Leave Review
                      </button>
                    )}
                    <Link
                      href={`/vault`}
                      className="px-4 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl text-xs text-[#6b6b6b] font-medium"
                    >
                      Vault
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav active="notifications" />
    </div>
  )
}
