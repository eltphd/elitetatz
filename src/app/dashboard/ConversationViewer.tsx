'use client'

import { useState } from 'react'
import { MessageCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Props {
  matchId: string
  conversationId: string | null
}

interface Msg { role: string; content: string; timestamp?: string }

export function ConversationViewer({ matchId, conversationId }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    if (loaded) { setOpen(!open); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/conversation?matchId=${matchId}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
      setLoaded(true)
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }

  if (!conversationId) return null

  return (
    <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
      <button
        onClick={load}
        className="flex items-center gap-2 text-xs text-[#6b6b6b] hover:text-white transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>View full chat context</span>
        {loading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && !loading && (
        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
          {messages.filter(m => m.role !== 'system').map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#c9a84c]/15 text-[#e0c878] rounded-tr-sm'
                  : 'bg-[#1e1e1e] text-[#9b9b9b] rounded-tl-sm'
              }`}>
                <span className="block text-[9px] opacity-50 mb-1 font-medium uppercase tracking-wide">
                  {msg.role === 'user' ? 'Client' : 'Concierge'}
                </span>
                {msg.content.replace(/```brief[\s\S]*?```/g, '').replace(/BRIEF_READY/g, '').trim()}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-xs text-[#6b6b6b] text-center py-4">No conversation recorded</p>
          )}
        </div>
      )}
    </div>
  )
}
