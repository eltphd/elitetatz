'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

// The one button on the page a reminder links to. The tap is what records it;
// opening the page records nothing, so a mail scanner that follows links
// cannot mark a lead as handled.

export function ConfirmHandled({ matchId, token, first }: { matchId: string; token: string; first: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')

  async function mark() {
    if (state !== 'idle') return
    setState('busy'); setError('')
    try {
      const res = await fetch('/api/handled', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, t: token }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save. Try again.')
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-green-800/40 bg-green-900/15 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-green-300"><Check className="w-4 h-4" /> Done.</p>
        <p className="mt-1 text-sm leading-relaxed text-[#d0d0d0]">
          No more reminders about {first}. Nothing was sent to {first}. If they write again, you will hear about it once.
        </p>
      </div>
    )
  }
  return (
    <div>
      <button
        onClick={mark}
        disabled={state === 'busy'}
        className="w-full rounded-xl bg-[#c9a84c] px-4 py-3.5 text-base font-semibold text-black disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {state === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Yes, I already handled this
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
