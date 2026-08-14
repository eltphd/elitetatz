import Link from 'next/link'
import { AgentChat } from '@/components/AgentChat'
import { BottomNav } from '@/components/BottomNav'
import { Sparkles, ArrowLeft } from 'lucide-react'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

interface Props {
  searchParams: Promise<{ mode?: string }>
}

export default async function AgentPage({ searchParams }: Props) {
  const { mode } = await searchParams
  const isArtistMode = mode === 'rawsunart'

  return (
    <div className="flex flex-col h-dvh">
      <header className="shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {isArtistMode ? (
            <a
              href="https://rawsunart.com"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] text-[#c9a84c] hover:bg-[#1e1e1e]"
              aria-label="Back to RawSunArt"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c9a84c]">
              <Sparkles className="h-4 w-4 text-black" />
            </div>
          )}
          <div>
            {isArtistMode ? (
              <>
                <h1 className="text-sm font-semibold text-white">{ARTIST_CONFIG.handle} · Concierge</h1>
                <p className="text-[10px] text-[#6b6b6b]">Booking assistant for {ARTIST_CONFIG.name}</p>
              </>
            ) : (
              <>
                <h1 className="text-sm font-semibold text-white">EliteTatz</h1>
                <p className="text-[10px] text-[#6b6b6b]">Your tattoo concierge</p>
              </>
            )}
          </div>
          <div className="ml-auto h-2 w-2 rounded-full bg-green-500" />
        </div>
      </header>

      <AgentChat mode={isArtistMode ? 'lacey' : undefined} />

      {/* Artist-mode concierge is a contained, single-purpose experience —
          no marketplace nav. Organic marketplace visitors keep the tab bar. */}
      {isArtistMode ? (
        <footer className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3 text-center">
          <Link href="https://rawsunart.com" className="text-xs text-[#6b6b6b] hover:text-[#c9a84c]">
            ← Back to rawsunart.com
          </Link>
        </footer>
      ) : (
        <BottomNav active="agent" />
      )}
    </div>
  )
}
