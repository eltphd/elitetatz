import { AgentChat } from '@/components/AgentChat'
import { BottomNav } from '@/components/BottomNav'
import { Sparkles } from 'lucide-react'

export default function AgentPage() {
  return (
    <div className="flex flex-col h-dvh">
      <header className="shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="w-9 h-9 rounded-full bg-[#c9a84c] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">TatzAI</h1>
            <p className="text-[10px] text-[#6b6b6b]">Your tattoo concierge</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
        </div>
      </header>

      <AgentChat />

      <BottomNav active="agent" />
    </div>
  )
}
