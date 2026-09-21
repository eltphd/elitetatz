'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, HelpCircle, XCircle, Loader2 } from 'lucide-react'

// Three buttons. Accept opens quote + dates + note; Need more info opens a
// question box; Pass opens an optional note. One tap each after the fields.
// Optimistic: the card flips to its result the moment she taps, then the
// server page refreshes so the lead lands in the right group.

type Panel = 'idle' | 'accept' | 'more_info' | 'decline'
type Done = 'accepted' | 'info_requested' | 'rejected'

const INPUT =
  'w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors'

export function LeadActions({ matchId, status }: { matchId: string; status: 'pending' | 'info_requested' }) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('idle')
  const [done, setDone] = useState<Done | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote] = useState('')
  const [dates, setDates] = useState('')
  const [note, setNote] = useState('')
  const [question, setQuestion] = useState('')

  async function send(action: 'accept' | 'more_info' | 'decline') {
    const optimistic: Done = action === 'accept' ? 'accepted' : action === 'more_info' ? 'info_requested' : 'rejected'
    setSubmitting(true)
    setDone(optimistic)
    try {
      const res = await fetch('/api/dashboard/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          action,
          price_cents: action === 'accept' ? Math.round(Number(quote) * 100) : undefined,
          proposed_dates: action === 'accept' ? dates || undefined : undefined,
          message: action === 'more_info' ? question : note || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong')
      }
      router.refresh()
    } catch (e) {
      setDone(null)
      alert(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done === 'accepted') {
    return (
      <Result icon={<CheckCircle className="w-4 h-4 text-green-400" />} cls="text-green-400">
        Accepted — client got the quote and deposit link
      </Result>
    )
  }
  if (done === 'info_requested') {
    return (
      <Result icon={<HelpCircle className="w-4 h-4 text-[#c9a84c]" />} cls="text-[#c9a84c]">
        Question sent — waiting on the client
      </Result>
    )
  }
  if (done === 'rejected') {
    return (
      <Result icon={<XCircle className="w-4 h-4 text-[#6b6b6b]" />} cls="text-[#6b6b6b]">
        Passed — client notified
      </Result>
    )
  }

  if (panel === 'accept') {
    const valid = Number(quote) > 0
    return (
      <div className="space-y-3 pt-1">
        <Field label="Your quote ($)">
          <input type="number" inputMode="decimal" min={1} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="e.g. 450" className={INPUT} autoFocus />
        </Field>
        <Field label="Proposed dates">
          <input type="text" value={dates} onChange={(e) => setDates(e.target.value)} placeholder="Wed Oct 8 at 1pm or Sat Oct 11 at noon" className={INPUT} />
        </Field>
        <Field label="Note to client (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything they should know before booking…" className={`${INPUT} resize-none`} />
        </Field>
        <div className="flex gap-2">
          <Cancel onClick={() => setPanel('idle')} />
          <button
            onClick={() => send('accept')}
            disabled={!valid || submitting}
            className="flex-[2] bg-[#c9a84c] text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Send quote{valid ? ` · $${Number(quote).toLocaleString('en-US')}` : ''}
          </button>
        </div>
      </div>
    )
  }

  if (panel === 'more_info') {
    return (
      <div className="space-y-3 pt-1">
        <Field label="What do you need to know?">
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="Can you send a reference? Color or black and grey?" className={`${INPUT} resize-none`} autoFocus />
        </Field>
        <div className="flex gap-2">
          <Cancel onClick={() => setPanel('idle')} />
          <button
            onClick={() => send('more_info')}
            disabled={!question.trim() || submitting}
            className="flex-[2] bg-[#c9a84c] text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5" />}
            Ask the client
          </button>
        </div>
      </div>
    )
  }

  if (panel === 'decline') {
    return (
      <div className="space-y-3 pt-1">
        <Field label="Note to client (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Not my style, but thank you for thinking of me." className={`${INPUT} resize-none`} autoFocus />
        </Field>
        <div className="flex gap-2">
          <Cancel onClick={() => setPanel('idle')} />
          <button
            onClick={() => send('decline')}
            disabled={submitting}
            className="flex-[2] bg-[#1e1e1e] border border-red-900/50 text-red-400 font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Pass on this one
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        onClick={() => setPanel('accept')}
        className="flex items-center justify-center gap-1.5 bg-[#c9a84c] text-black font-bold py-3 rounded-xl text-sm"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        Accept
      </button>
      <button
        onClick={() => setPanel('more_info')}
        className="flex items-center justify-center gap-1.5 bg-[#1e1e1e] border border-[#c9a84c]/30 text-[#e0c878] font-semibold py-3 rounded-xl text-sm"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="truncate">{status === 'info_requested' ? 'Ask again' : 'More info'}</span>
      </button>
      <button
        onClick={() => setPanel('decline')}
        className="flex items-center justify-center gap-1.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#9b9b9b] font-medium py-3 rounded-xl text-sm hover:border-red-800/40 hover:text-red-400 transition-colors"
      >
        <XCircle className="w-3.5 h-3.5" />
        Pass
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-[#6b6b6b] block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Cancel({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white font-medium py-2.5 rounded-xl text-sm">
      Cancel
    </button>
  )
}

function Result({ icon, cls, children }: { icon: React.ReactNode; cls: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2">
      {icon}
      <span className={`text-sm font-medium ${cls}`}>{children}</span>
    </div>
  )
}
