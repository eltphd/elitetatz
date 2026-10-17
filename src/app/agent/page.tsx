import Link from 'next/link'
import { AgentChat } from '@/components/AgentChat'
import { ArrowLeft } from 'lucide-react'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Every chat is Lacey's. Old links still carry ?mode=rawsunart; it is ignored.
export default function AgentPage() {
  return (
    <div className="flex flex-col h-dvh">
      <header className="shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <a
            href="https://rawsunart.com"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a2a2a] text-[#c9a84c] hover:bg-[#1e1e1e]"
            aria-label="Back to RawSunArt"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-sm font-semibold text-white">{ARTIST_CONFIG.handle} · Concierge</h1>
            <p className="text-[10px] text-[#6b6b6b]">Booking assistant for {ARTIST_CONFIG.name}</p>
          </div>
          <div className="ml-auto h-2 w-2 rounded-full bg-green-500" />
        </div>
      </header>

      <AgentChat />

      <footer className="shrink-0 border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3 text-center">
        <Link href="https://rawsunart.com" className="text-xs text-[#6b6b6b] hover:text-[#c9a84c]">
          ← Back to rawsunart.com
        </Link>
      </footer>
    </div>
  )
}
