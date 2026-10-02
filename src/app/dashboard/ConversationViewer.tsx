'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { ThreadList, ReplyBox, type ThreadMessage } from '@/components/InquiryThread'

// Two layers on every lead: the concierge transcript (collapsed; loaded on
// demand from /api/dashboard/conversation) and the live thread with the
// client (always visible, with a reply box that posts to /api/dashboard/message).

interface Props {
  matchId: string
  conversationId: string | null
  thread: ThreadMessage[]
  clientName: string
  canReply: boolean
}

interface Msg { role: string; content: string; timestamp?: string }

export function ConversationViewer({ matchId, conversationId, thread, clientName, canReply }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [local, setLocal] = useState<ThreadMessage[]>([])

  const all = [...thread, ...local.filter((l) => !thread.some((m) => m.id === l.id))]

  async function loadTranscript() {
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

  async function reply(body: string) {
    const res = await fetch('/api/dashboard/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Could not send')
    if (data.message?.id) setLocal((prev) => [...prev, data.message])
    router.refresh()
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-3">
      {conversationId && (
        <div>
          <button
            onClick={loadTranscript}
            className="flex items-center gap-2 text-xs text-[#6b6b6b] hover:text-white transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Concierge transcript</span>
            {loading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {open && !loading && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
              {messages.filter((m) => m.role !== 'system').map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#c9a84c]/15 text-[#e0c878] rounded-tr-sm'
                      : 'bg-[#1e1e1e] text-[#9b9b9b] rounded-tl-sm'
                  }`}>
                    <span className="block text-[9px] opacity-50 mb-1 font-medium uppercase tracking-wide">
                      {msg.role === 'user' ? clientName : 'Concierge'}
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
      )}

      <div>
        <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide font-medium mb-2">Thread with {clientName}</p>
        {all.length > 0 ? (
          <ThreadList messages={all} viewer="artist" artistName="Lacey" clientName={clientName} />
        ) : (
          <p className="text-xs text-[#6b6b6b]">No messages yet.</p>
        )}
        {canReply && (
          <div className="mt-3">
            <ReplyBox onSend={reply} placeholder={`Message ${clientName}…`} />
          </div>
        )}
      </div>
    </div>
  )
}
