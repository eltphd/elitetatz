'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { ArtistCard } from '@/components/ArtistCard'
import { MOCK_ARTISTS } from '@/lib/mock-data'
import { ArtistStyle } from '@/lib/types'

const STYLES: ArtistStyle[] = ['realism', 'japanese', 'blackwork', 'fine-line', 'neo-traditional', 'geometric', 'watercolor', 'traditional', 'portrait', 'illustrative', 'tribal', 'cover-up']
const CITIES = ['All', 'NYC', 'LA', 'Miami', 'Chicago', 'Atlanta', 'Houston']

export default function ExplorePage() {
  const [query, setQuery] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<ArtistStyle | null>(null)
  const [selectedCity, setSelectedCity] = useState('All')
  const [maxBudget, setMaxBudget] = useState<number | null>(null)

  const filtered = MOCK_ARTISTS.filter((a) => {
    if (query && !a.name.toLowerCase().includes(query.toLowerCase()) && !a.styles.some(s => s.includes(query.toLowerCase()))) return false
    if (selectedStyle && !a.styles.includes(selectedStyle)) return false
    if (selectedCity !== 'All') {
      const cityMap: Record<string, string> = { NYC: 'New York', LA: 'Los Angeles', Miami: 'Miami', Chicago: 'Chicago', Atlanta: 'Atlanta', Houston: 'Houston' }
      if (a.location_city !== cityMap[selectedCity]) return false
    }
    if (maxBudget && a.min_piece_cents > maxBudget * 100) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 focus-within:border-[#c9a84c]/40 transition-colors">
            <Search className="w-4 h-4 text-[#6b6b6b] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists, styles..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#6b6b6b] outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X className="w-4 h-4 text-[#6b6b6b]" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {/* City filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
          {CITIES.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selectedCity === city
                  ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                  : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Style filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          <button
            onClick={() => setSelectedStyle(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
              !selectedStyle ? 'bg-[#1e1e1e] text-white border-[#c9a84c]' : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
            }`}
          >
            All
          </button>
          {STYLES.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style === selectedStyle ? null : style)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                selectedStyle === style ? 'bg-[#1e1e1e] text-white border-[#c9a84c]' : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#6b6b6b] mb-3">{filtered.length} artist{filtered.length !== 1 ? 's' : ''} found</p>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#6b6b6b]">
            <SlidersHorizontal className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No artists match your filters</p>
            <button onClick={() => { setQuery(''); setSelectedStyle(null); setSelectedCity('All') }} className="text-[#c9a84c] text-sm mt-2">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </main>

      <BottomNav active="explore" />
    </div>
  )
}
