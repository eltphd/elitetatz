'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, DollarSign, Loader2 } from 'lucide-react'

export function LeadActions({ matchId }: { matchId: string }) {
  const [state, setState] = useState<'idle' | 'quoting' | 'done' | 'declined'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [quote, setQuote] = useState('')
  const [note, setNote] = useState('')

  async function respond(action: 'accept' | 'decline', price?: number, response?: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/dashboard/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, action, price_cents: price, artist_response: response }),
      })
      if (!res.ok) throw new Error()
      setState(action === 'accept' ? 'done' : 'declined')
    } catch {
      alert('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm text-green-400 font-medium">Accepted — client notified</span>
      </div>
    )
  }

  if (state === 'declined') {
    return (
      <div className="flex items-center gap-2 py-2">
        <XCircle className="w-4 h-4 text-[#6b6b6b]" />
        <span className="text-sm text-[#6b6b6b]">Declined</span>
      </div>
    )
  }

  if (state === 'quoting') {
    return (
      <div className="space-y-3 pt-1">
        <div>
          <label className="text-[10px] text-[#6b6b6b] block mb-1">Your quote ($)</label>
          <input
            type="number"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="e.g. 450"
            className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#6b6b6b] block mb-1">Message to client (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any questions or notes before they book..."
            rows={2}
            className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setState('idle')}
            className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white font-medium py-2.5 rounded-xl text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => respond('accept', quote ? Math.round(Number(quote) * 100) : undefined, note || undefined)}
            disabled={!quote || submitting}
            className="flex-1 bg-[#c9a84c] text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Accept & Quote
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setState('quoting')}
        className="flex items-center gap-1.5 flex-1 justify-center bg-[#c9a84c] text-black font-bold py-2.5 rounded-xl text-sm"
      >
        <DollarSign className="w-3.5 h-3.5" />
        Quote & Accept
      </button>
      <button
        onClick={() => respond('decline')}
        disabled={submitting}
        className="flex items-center gap-1.5 px-4 justify-center bg-[#1e1e1e] border border-[#2a2a2a] text-[#6b6b6b] font-medium py-2.5 rounded-xl text-sm hover:border-red-800/40 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
        Decline
      </button>
    </div>
  )
}
