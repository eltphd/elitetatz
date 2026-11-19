'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

// "I already handled this": one tap for a lead she answered by text, by phone,
// in Messenger or at the shop. It leaves a private note on the card, which is
// what stops the reminders (lib/handled.ts). Nothing is sent to anyone.

export function HandledButton({ matchId, first, demo = false }: { matchId: string; first: string; demo?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function mark() {
    if (busy || done) return
    setBusy(true); setError('')
    try {
      if (!demo) {
        const res = await fetch('/api/dashboard/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, handled: true }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Could not save')
        router.refresh()
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(false) }
  }

  if (done) {
    return <p className="mt-2 flex items-center gap-1.5 text-[11px] text-green-300"><Check className="w-3 h-3" /> Marked as handled. No reminders will go out about {first}.</p>
  }
  return (
    <div className="mt-2">
      <button
        onClick={mark}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#3a3a3a] bg-[#1e1e1e] px-2.5 py-1.5 text-[11px] font-medium text-[#e0c878] disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        I already handled this
      </button>
      <p className="mt-1 text-[10px] leading-relaxed text-[#8a8a8a]">
        Answered {first} by text, phone, Messenger or at the shop? Tap this and the reminders stop. Nothing is sent to {first}.
      </p>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
