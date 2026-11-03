'use client'

import { useRef, useState } from 'react'
import { Bot, Loader2, Send, Sparkles, MessageSquareQuote, BadgeDollarSign, Eye, CornerDownLeft } from 'lucide-react'
import { useSpeechInput } from '@/components/useSpeechInput'
import { MicButton } from '@/components/MicButton'
import type { NoteView } from './NotesPanel'

// The assistant on a lead. It has read the brief, the transcript, every
// message by every channel, the reference photos and her notes. Three one-tap
// reads (what do they want, draft a clarifying message, check the price) and
// a free question, typed or spoken. A draft lands in her reply box; it is
// sent only when she taps send there.

type Mode = 'ask' | 'intent' | 'clarify' | 'quote'
interface Exchange { id: string; kind: 'question' | 'answer' | 'draft'; body: string }

const DEMO: Record<Exclude<Mode, 'ask'>, string> = {
  intent: "They want a watercolor peony on the outer forearm, about 4 inches, and the reference is there for the color splash more than the exact flower: they said twice they'd rather it feel loose. Budget tops out at $500, above your $250–400 band for this size. They are ready: they asked about dates before you asked about size.\n\nStill unknown:\n- Lines under the color, or color only\n- Whether it wraps toward the inner arm\n\nI would quote now at $375 and ask the two questions in the same message.",
  clarify: "Hey! I can work with this. Two quick things before I give you a number: do you want fine lines under the watercolor, or color only? And should it stay on the outer forearm or wrap a little toward the inside? Once I have that I'll get you a price and we'll set a time.",
  quote: "The starting number of $375 is right for about 4 inches of watercolor on the forearm. It sits above the band's $250 floor because color takes longer than lines, and a single flower keeps drawing time down. If they add fine lines under the color I would hold $375; if it wraps and grows past 5 inches it moves into the next band, $400–700, and I would say $475. Their $500 ceiling works either way.\n\nSuggest: $375",
}

export function AssistantPanel({
  matchId,
  notes,
  onDraft,
  onQuestion,
  demo = false,
}: {
  matchId: string
  notes: NoteView[]
  /** The assistant wrote something for the client: put it in the reply box. */
  onDraft: (text: string) => void
  /** Put it in the "More info" question box instead. */
  onQuestion?: (text: string) => void
  demo?: boolean
}) {
  const initial: Exchange[] = notes
    .filter((n) => n.author === 'assistant' && (n.kind === 'question' || n.kind === 'answer' || n.kind === 'draft'))
    .map((n) => ({ id: n.id, kind: n.kind as Exchange['kind'], body: n.body }))
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Exchange[]>(initial)
  const [live, setLive] = useState<{ kind: 'answer' | 'draft'; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const base = useRef('')
  const speech = useSpeechInput((t) => setQuestion([base.current, t].filter(Boolean).join(' ')))
  function toggleMic() { if (!speech.listening) base.current = question.trim(); speech.toggle() }

  async function run(mode: Mode) {
    if (busy) return
    const q = mode === 'ask' ? question.trim() : ''
    if (mode === 'ask' && !q) return
    setBusy(true); setError(''); setOpen(true)
    const label = mode === 'ask' ? q : mode === 'intent' ? 'What does this client want?' : mode === 'clarify' ? 'Draft a message to settle what is open' : 'Check the price'
    setItems((l) => [...l, { id: `q-${Date.now()}`, kind: 'question', body: label }])
    const kind: 'answer' | 'draft' = mode === 'clarify' ? 'draft' : 'answer'
    setLive({ kind, body: '' })
    try {
      if (demo) {
        const text = mode === 'ask' ? "From the thread: they mentioned the piece is for their mom, who grew peonies. That is why the color matters more than the line work to them. If you want to honor that, the watercolor-forward read is the one to quote." : DEMO[mode]
        for (let i = 0; i < text.length; i += 3) {
          await new Promise((r) => setTimeout(r, 12))
          setLive({ kind, body: text.slice(0, i + 3) })
        }
        setItems((l) => [...l, { id: `a-${Date.now()}`, kind, body: text }])
      } else {
        const res = await fetch('/api/dashboard/assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, mode, question: q || undefined }),
        })
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? 'The assistant is unavailable')
        }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        let full = ''
        let streamError = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const p of parts) {
            if (!p.startsWith('data: ')) continue
            try {
              const ev = JSON.parse(p.slice(6)) as { text?: string; error?: string; done?: boolean }
              if (ev.text) { full += ev.text; setLive({ kind, body: full }) }
              if (ev.error) streamError = ev.error
            } catch { /* partial */ }
          }
        }
        if (streamError) throw new Error(streamError)
        setItems((l) => [...l, { id: `a-${Date.now()}`, kind, body: full.trim() }])
      }
      if (mode === 'ask') setQuestion('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setItems((l) => l.slice(0, -1))
    } finally {
      setLive(null)
      setBusy(false)
    }
  }

  const shown = items.slice(-6)
  const lastDraft = [...items].reverse().find((i) => i.kind === 'draft')

  return (
    <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs text-[#6b6b6b] hover:text-white transition-colors">
        <Bot className="w-3.5 h-3.5" />
        <span>Assistant{items.length ? ` · ${Math.ceil(items.length / 2)}` : ''}</span>
        <span className="text-[10px] text-[#4a4a4a]">has read the whole lead · drafts only, you send</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Chip onClick={() => run('intent')} disabled={busy} icon={<Eye className="w-3 h-3" />}>What do they want?</Chip>
            <Chip onClick={() => run('clarify')} disabled={busy} icon={<MessageSquareQuote className="w-3 h-3" />}>Draft a clarifying msg</Chip>
            <Chip onClick={() => run('quote')} disabled={busy} icon={<BadgeDollarSign className="w-3 h-3" />}>Check the price</Chip>
          </div>

          {(shown.length > 0 || live) && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
              {shown.map((x) => <Bubble key={x.id} x={x} onDraft={onDraft} onQuestion={onQuestion} />)}
              {live && <Bubble x={{ id: 'live', kind: live.kind, body: live.body || '…' }} streaming />}
            </div>
          )}

          {lastDraft && !live && (
            <p className="text-[10px] text-[#6b6b6b] flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> A draft is text in a box until you tap send.</p>
          )}

          <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run('ask') }}
                rows={1}
                disabled={busy}
                placeholder="Ask about this client: “Why do they want it on the ribs?” “Will this reference hold at 3 inches?”"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 resize-none disabled:opacity-50"
              />
              <MicButton supported={speech.supported} listening={speech.listening} onToggle={toggleMic} className="absolute right-1 top-1" />
            </div>
            <button onClick={() => run('ask')} disabled={busy || !question.trim()} aria-label="Ask" className="h-9 w-9 shrink-0 rounded-xl bg-[#c9a84c] text-black flex items-center justify-center disabled:opacity-40">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}

function Chip({ children, onClick, disabled, icon }: { children: React.ReactNode; onClick: () => void; disabled: boolean; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-1 bg-[#1e1e1e] border border-[#c9a84c]/25 text-[#e0c878] text-[11px] font-medium py-2 px-1.5 rounded-xl disabled:opacity-50 leading-tight">
      {icon}<span className="truncate">{children}</span>
    </button>
  )
}

function Bubble({ x, onDraft, onQuestion, streaming = false }: { x: Exchange; onDraft?: (t: string) => void; onQuestion?: (t: string) => void; streaming?: boolean }) {
  if (x.kind === 'question') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] bg-[#c9a84c]/15 text-[#e0c878] rounded-xl rounded-tr-sm px-3 py-1.5 text-xs">{x.body}</p>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className={`max-w-[92%] rounded-xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${x.kind === 'draft' ? 'bg-[#1a1710] border border-[#c9a84c]/30 text-[#f0e6c8]' : 'bg-[#1e1e1e] text-[#d0d0d0]'}`}>
        <span className="block text-[9px] opacity-60 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> {x.kind === 'draft' ? 'Draft for the client · not sent' : 'Assistant'}
        </span>
        {x.body}
        {x.kind === 'draft' && !streaming && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {onDraft && <button onClick={() => onDraft(x.body)} className="text-[10px] font-semibold bg-[#c9a84c] text-black px-2 py-1 rounded-lg">Put in reply box</button>}
            {onQuestion && <button onClick={() => onQuestion(x.body)} className="text-[10px] font-semibold bg-[#1e1e1e] border border-[#c9a84c]/30 text-[#e0c878] px-2 py-1 rounded-lg">Use as “More info” question</button>}
          </div>
        )}
      </div>
    </div>
  )
}
