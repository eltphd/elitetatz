'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, ImagePlus, ChevronRight } from 'lucide-react'
import { Message } from '@/lib/types'

const STARTER_PROMPTS = [
  "I want a sleeve but don't know where to start",
  "Small minimalist piece, first tattoo",
  "Cover up an old tattoo",
  "Japanese koi — how much should I budget?",
]

const WELCOME: Message = {
  role: 'assistant',
  content: `Hey! I'm TatzAI — your personal tattoo concierge. I'm here to help you:\n\n• **Refine your idea** into something an artist can work with\n• **Figure out your budget** based on what you actually want\n• **Match you with the right artist** for your style and location\n\nWhen you're ready, I'll put together a brief and send it to the best matching artists. They'll respond with an offer — you accept, we handle everything.\n\n**What are you thinking about getting?**`,
  timestamp: new Date().toISOString(),
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [briefReady, setBriefReady] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })

      if (!res.ok) throw new Error('Agent error')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMsg: Message = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                assistantContent += data.text
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { ...assistantMsg, content: assistantContent }
                  return updated
                })
              }
              if (data.briefReady) setBriefReady(true)
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Sorry, I hit a snag. Try again in a moment.",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-lg mx-auto w-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="bg-[#1e1e1e] rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-[#c9a84c] animate-spin" />
            </div>
          </div>
        )}

        {/* Brief ready CTA */}
        {briefReady && (
          <div className="bg-[#141414] border border-[#c9a84c]/40 rounded-2xl p-4 mx-2">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#c9a84c]" />
              <span className="text-sm font-semibold text-[#c9a84c]">Your brief is ready!</span>
            </div>
            <p className="text-xs text-[#6b6b6b] mb-3">
              I've put together your tattoo brief. Ready to send it to matching artists?
            </p>
            <button className="flex items-center justify-between w-full bg-[#c9a84c] text-black font-semibold px-4 py-3 rounded-xl text-sm">
              <span>Find My Artist</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Starter prompts (only at start) */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="shrink-0 text-xs px-3 py-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl text-[#c9a84c] hover:border-[#c9a84c]/40 transition-colors max-w-[180px] text-left leading-tight"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-3 border-t border-[#2a2a2a] bg-[#0a0a0a]">
        <div className="flex items-end gap-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl px-4 py-3 focus-within:border-[#c9a84c]/40 transition-colors">
          <button className="text-[#6b6b6b] hover:text-[#c9a84c] transition-colors mb-0.5">
            <ImagePlus className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your tattoo idea..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#6b6b6b] resize-none outline-none max-h-32 leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="mb-0.5 w-8 h-8 rounded-full bg-[#c9a84c] disabled:opacity-30 flex items-center justify-center shrink-0 transition-opacity"
          >
            <Send className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-black" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-[#c9a84c] text-black rounded-tr-sm font-medium'
            : 'bg-[#1e1e1e] text-[#f5f5f0] rounded-tl-sm'
        }`}
      >
        <FormattedMessage content={message.content} />
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part.split('\n').map((line, j) => (
            <span key={`${i}-${j}`}>
              {j > 0 && <br />}
              {line.startsWith('• ') ? (
                <span className="flex items-start gap-1.5">
                  <span className="text-[#c9a84c] mt-0.5">•</span>
                  <span>{line.slice(2)}</span>
                </span>
              ) : line}
            </span>
          ))
        )
      )}
    </span>
  )
}
