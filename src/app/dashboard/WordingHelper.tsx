'use client'

import { useRef, useState } from 'react'
import { Loader2, Sparkles, PenLine, RotateCcw, Check } from 'lucide-react'
import { useSpeechInput } from '@/components/useSpeechInput'
import { MicButton } from '@/components/MicButton'
import { parseReworded, type Reworded } from '@/lib/reword'

// "Say it your way." The first thing on a card she can act on.
//
// She types or says what she wants to tell the client, however it comes out.
// The assistant hands back the same thing worded for that client, says what
// it changed and why, and asks when it is not sure what she meant. She takes
// it, corrects it, or sends her own words. It is an aid: she is the artist,
// her decision stands, and nothing is sent until she taps Send on the reply.

const demoAnswer = (name: string) => `MESSAGE: Hey ${name}! I'd love to do this one. I don't copy another artist's piece line for line, so I'll draw you your own version: same feeling, made for you and for where it's going. We finish the design together at the appointment, so you see it before anything is permanent. It would be $450. Want me to send a couple of dates?
WHY: I kept your no on copying and your price exactly as you said them. I put the yes first, because that is what they are waiting to hear, and added what you do instead, which is your usual practice, so the no reads as care and not a door closing.
CHECK: Did you mean you won't use their reference at all, or only that you won't copy it exactly? I wrote it as the second.
ADDONS: You gave a price. They may want an original of the piece to keep, digital or on watercolor paper, and you haven't mentioned it yet. Your call.`

export function WordingHelper({
  matchId,
  clientName,
  canReply,
  onUse,
  demo = false,
}: {
  matchId: string
  clientName: string
  /** There is a way to reach this client from here (email, phone or a DM thread). */
  canReply: boolean
  /** Put text in the reply box. Nothing is sent by this. */
  onUse: (text: string) => void
  demo?: boolean
}) {
  const [words, setWords] = useState('')
  const [busy, setBusy] = useState(false)
  const [raw, setRaw] = useState('')
  const [asked, setAsked] = useState('')
  const [error, setError] = useState('')
  const [used, setUsed] = useState<'theirs' | 'mine' | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const base = useRef('')
  const speech = useSpeechInput((t) => setWords([base.current, t].filter(Boolean).join(' ')))
  function toggleMic() { if (!speech.listening) base.current = words.trim(); speech.toggle() }

  const result: Reworded | null = raw ? parseReworded(raw) : null

  async function help() {
    const mine = words.trim()
    if (!mine || busy) return
    setBusy(true); setError(''); setRaw(''); setUsed(null); setAsked(mine); setCorrecting(false)
    try {
      if (demo) {
        const answer = demoAnswer(clientName === 'Client' ? 'there' : clientName)
        for (let i = 0; i < answer.length; i += 6) {
          await new Promise((r) => setTimeout(r, 10))
          setRaw(answer.slice(0, i + 6))
        }
        setRaw(answer)
        return
      }
      const res = await fetch('/api/dashboard/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, mode: 'reword', question: mine }),
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
            const ev = JSON.parse(p.slice(6)) as { text?: string; error?: string }
            if (ev.text) { full += ev.text; setRaw(full) }
            if (ev.error) streamError = ev.error
          } catch { /* partial chunk */ }
        }
      }
      if (streamError) throw new Error(streamError)
    } catch (e) {
      setRaw('')
      setError(e instanceof Error ? `${e.message} Your own words are still here; you can send them as they are.` : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function use(text: string, which: 'theirs' | 'mine') {
    onUse(text)
    setUsed(which)
  }
  function notWhatIMeant() {
    setRaw(''); setUsed(null); setCorrecting(true)
    box.current?.focus()
  }

  const first = clientName === 'Client' ? 'this client' : clientName

  return (
    <div className="mb-3 rounded-xl border border-[#c9a84c]/35 bg-[#17140c] p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#e0c878]">
        <PenLine className="w-3.5 h-3.5" /> Say it your way
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[#a89a72]">
        Tell me what you want to say to {first}, however it comes out. I&apos;ll offer a way to word it for them. You decide what goes.
      </p>

      <div className="relative mt-2">
        <textarea
          ref={box}
          id={`say-${matchId}`}
          aria-label={`What you want to say to ${first}`}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) help() }}
          rows={correcting || words.length > 90 ? 3 : 2}
          disabled={busy}
          placeholder={correcting ? 'Tell me what you meant instead. Plain is fine.' : 'e.g. “I won’t copy that piece, I’ll draw my own version. It’ll be around 450.”'}
          className="w-full resize-none rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2 pr-10 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/50 disabled:opacity-60"
        />
        <MicButton supported={speech.supported} listening={speech.listening} onToggle={toggleMic} className="absolute right-1.5 top-1.5" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={help}
          disabled={busy || !words.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-[#c9a84c] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? 'Working on it…' : result ? 'Try again' : 'Help me word it'}
        </button>
        {canReply && words.trim() && !busy && (
          <button type="button" onClick={() => use(words.trim(), 'mine')} className="rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2 text-xs font-medium text-[#d0d0d0]">
            Use my own words
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}

      {result && result.message && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="rounded-xl border border-[#c9a84c]/30 bg-[#1a1710] px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#c9a84c]">How about saying it like this</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f0e6c8]">{result.message}</p>
          </div>

          {result.why && (
            <p className="text-[11px] leading-relaxed text-[#b8b8b8]"><span className="font-semibold text-[#d0d0d0]">What I changed, and why. </span>{result.why}</p>
          )}
          {result.check && (
            <p className="rounded-lg border border-[#c9a84c]/25 bg-[#c9a84c]/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-[#e0c878]">
              <span className="font-semibold">Before you send, did I get this right? </span>{result.check}
            </p>
          )}
          {result.addons && (
            <p className="rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] px-2.5 py-1.5 text-[11px] leading-relaxed text-[#b8b8b8]">
              <span className="font-semibold text-[#d0d0d0]">Worth a mention. </span>{result.addons}
            </p>
          )}

          {!busy && (
            <div className="flex flex-wrap gap-2">
              {canReply && (
                <button type="button" onClick={() => use(result.message, 'theirs')} className="flex items-center gap-1.5 rounded-xl bg-[#c9a84c] px-3 py-2 text-xs font-bold text-black">
                  <Check className="w-3.5 h-3.5" /> Use this wording
                </button>
              )}
              <button type="button" onClick={notWhatIMeant} className="flex items-center gap-1.5 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2 text-xs font-medium text-[#d0d0d0]">
                <RotateCcw className="w-3.5 h-3.5" /> That&apos;s not what I meant
              </button>
              {canReply && asked && (
                <button type="button" onClick={() => use(asked, 'mine')} className="rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2 text-xs font-medium text-[#d0d0d0]">
                  Use my own words
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {used && (
        <p role="status" className="mt-2 rounded-lg border border-green-800/40 bg-green-900/15 px-2.5 py-1.5 text-[11px] text-green-300">
          {used === 'theirs' ? 'That wording' : 'Your own wording'} is in the reply box at the bottom of this card. Read it over, change anything, then tap Send. Nothing has gone to {first} yet.
        </p>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-[#7d7458]">
        You are the artist. This only helps with wording: it never changes what you decided, and nothing reaches {first} until you tap Send.
        {!canReply ? ' There is no email, phone or DM on this card yet, so copy the wording to wherever you are talking to them.' : ''}
      </p>
    </div>
  )
}
