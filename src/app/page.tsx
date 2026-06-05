import Link from 'next/link'
import { Search, Sparkles, Star, ChevronRight, Zap } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { ArtistCard } from '@/components/ArtistCard'
import { MOCK_ARTISTS } from '@/lib/mock-data'

export default function HomePage() {
  const featured = MOCK_ARTISTS.slice(0, 6)

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="gradient-gold">Tatz</span>
            <span className="text-white">AI</span>
          </h1>
          <Link href="/explore" className="p-2 rounded-full bg-[#1e1e1e] hover:bg-[#2a2a2a] transition-colors">
            <Search className="w-5 h-5 text-[#c9a84c]" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4">
        <div className="mt-6 mb-8">
          <p className="text-[#6b6b6b] text-sm uppercase tracking-widest mb-2">AI-Powered Matching</p>
          <h2 className="text-3xl font-bold leading-tight mb-4">
            Tell us your vision.<br />
            <span className="gradient-gold">We find your artist.</span>
          </h2>
          <Link
            href="/agent"
            className="flex items-center justify-between w-full bg-[#c9a84c] hover:bg-[#d4b45a] text-black font-semibold px-5 py-4 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <span>Start with TatzAI</span>
            </div>
            <ChevronRight className="w-5 h-5" />
          </Link>
          <p className="text-center text-[#6b6b6b] text-xs mt-3">Free to explore · Pay only when matched</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Sparkles, label: 'Describe your idea', sub: 'AI refines it' },
            { icon: Zap, label: 'Get matched', sub: 'Best artist for you' },
            { icon: Star, label: 'Artist accepts', sub: 'Pay & book' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 text-center">
              <Icon className="w-5 h-5 text-[#c9a84c] mx-auto mb-2" />
              <p className="text-xs font-medium text-white leading-tight">{label}</p>
              <p className="text-[10px] text-[#6b6b6b] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Elite Artists</h3>
            <Link href="/explore" className="text-[#c9a84c] text-sm font-medium">See all</Link>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
            {['All', 'NYC', 'LA', 'Miami', 'Chicago', 'Atlanta', 'Houston'].map((city) => (
              <button
                key={city}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  city === 'All'
                    ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                    : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
            {['All Styles', 'Realism', 'Japanese', 'Blackwork', 'Fine Line', 'Neo-Trad', 'Geometric'].map((style) => (
              <button
                key={style}
                className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                  style === 'All Styles'
                    ? 'bg-[#1e1e1e] text-white border-[#c9a84c]'
                    : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
                }`}
              >
                {style}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {featured.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 mb-6">
          <p className="text-xs text-[#c9a84c] uppercase tracking-widest mb-2">For Artists</p>
          <h3 className="text-lg font-semibold mb-2">Get qualified leads<br />sent to you</h3>
          <p className="text-sm text-[#6b6b6b] mb-4">
            We match clients to your style & pricing. Accept or reject — no cold DMs, no tire-kickers.
          </p>
          <Link
            href="/artist/signup"
            className="flex items-center justify-center gap-2 w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#c9a84c] text-[#c9a84c] font-medium px-4 py-3 rounded-xl transition-colors text-sm"
          >
            Apply as an Artist
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <BottomNav active="home" />
    </div>
  )
}
