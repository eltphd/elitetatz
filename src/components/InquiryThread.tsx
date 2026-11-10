'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { channelLabel } from '@/lib/channel-types'

// The two-way thread between the artist and an anonymous client. Rendered
// on both sides: the dashboard (viewer 'artist') and /inquiry (viewer 'client').

export interface ThreadMessage {
  id: string
  sender: 'artist' | 'client' | 'system'
  body: string
  created_at: string
  /** Where the message came from or went; shown on the bubble when it is not the website. */
  channel?: string | null
  /** Set when the message lives in her own mailbox: 'reply' (hers), 'forwarded' or 'delivered' (the client's). */
  mailbox?: string | null
}

export function formatWhen(iso: string): string {
  // Fixed zone so server and client render the same string (no hydration drift).
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

export function ThreadList({
  messages,
  viewer,
  artistName = 'Lacey',
  clientName = 'Client',
}: {
  messages: ThreadMessage[]
  viewer: 'artist' | 'client'
  artistName?: string
  clientName?: string
}) {
  if (messages.length === 0) return null
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        if (m.sender === 'system') {
          return (
            <p key={m.id} className="text-[10px] text-[#6b6b6b] text-center py-1 italic">
              {m.body}
            </p>
          )
        }
        const mine = m.sender === viewer
        const label = m.sender === 'artist' ? artistName : clientName
        const via = m.channel && !['web', 'concierge'].includes(m.channel) && viewer === 'artist' ? ` · via ${channelLabel(m.channel, true)}` : ''
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                mine
                  ? 'bg-[#c9a84c]/15 text-[#e0c878] rounded-tr-sm'
                  : 'bg-[#1e1e1e] text-[#d0d0d0] rounded-tl-sm'
              }`}
            >
              <span className="block text-[9px] opacity-60 mb-1 font-medium uppercase tracking-wide">
                {label} · {formatWhen(m.created_at)}{via}
              </span>
              {m.body}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ReplyBox({
  onSend,
  placeholder = 'Write a reply…',
  disabled = false,
  initialText,
  initialKey = 0,
  hint,
}: {
  onSend: (body: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  /** Text dropped in from outside (an assistant draft). Re-applied whenever initialKey changes. */
  initialText?: string
  initialKey?: number
  /** One line under the box: where this reply will go. */
  hint?: string
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // A new draft from outside replaces what is in the box; her own typing is
  // never overwritten unless another draft arrives (the key changes).
  const [appliedKey, setAppliedKey] = useState(0)
  if (initialKey !== appliedKey) {
    setAppliedKey(initialKey)
    if (initialKey > 0 && initialText) setText(initialText)
  }

  async function submit() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      await onSend(body)
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          placeholder={placeholder}
          rows={2}
          disabled={disabled || sending}
          className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors resize-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || sending || !text.trim()}
          aria-label="Send"
          className="h-11 w-11 shrink-0 rounded-xl bg-[#c9a84c] text-black flex items-center justify-center disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-[10px] text-[#6b6b6b]">{hint}</p>}
    </div>
  )
}

// Client-side thread for /inquiry/[matchId]: posts to /api/inquiry with the
// signed token, appends optimistically, then refreshes the server page.
export function InquiryThread({
  matchId,
  token,
  messages,
  clientName,
  artistName,
}: {
  matchId: string
  token: string
  messages: ThreadMessage[]
  clientName: string
  artistName: string
}) {
  const router = useRouter()
  const [local, setLocal] = useState<ThreadMessage[]>([])
  const all = [...messages, ...local.filter((l) => !messages.some((m) => m.id === l.id))]

  async function send(body: string) {
    const res = await fetch('/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, t: token, body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Could not send')
    if (data.message) setLocal((prev) => [...prev, data.message])
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {all.length > 0 ? (
        <ThreadList messages={all} viewer="client" artistName={artistName} clientName={clientName} />
      ) : (
        <p className="text-xs text-[#6b6b6b] text-center py-3">No messages yet.</p>
      )}
      <ReplyBox onSend={send} placeholder={`Message ${artistName}…`} />
      <p className="text-[10px] text-[#6b6b6b]">{artistName} gets a text and an email when you reply.</p>
    </div>
  )
}
