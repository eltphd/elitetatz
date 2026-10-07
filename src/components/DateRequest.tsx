'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2 } from 'lucide-react'

// After the deposit: the client names the date they want. The artist has final
// say and confirms from her inbox; this page updates when she does.
export function DateRequest({
  matchId,
  token,
  artistName,
  proposedDates,
  existing,
}: {
  matchId: string
  token: string
  artistName: string
  proposedDates: string | null
  existing: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [sent, setSent] = useState<string | null>(existing)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const body = value.trim()
    if (!body) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, t: token, body, kind: 'date_request' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send')
      setSent(body); setValue('')
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-3">
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-1">
        <CalendarClock className="w-3.5 h-3.5 text-[#c9a84c]" />
        {sent ? 'Your date request' : 'Which date works for you?'}
      </p>
      {proposedDates && !sent && (
        <p className="text-[11px] text-[#9b9b9b] mb-2">{artistName} offered: {proposedDates}. Pick one, or suggest another.</p>
      )}
      {sent ? (
        <p className="text-sm">
          <span className="text-white">{sent}</span>
          <span className="block text-[11px] text-[#6b6b6b] mt-1">Waiting on {artistName} to confirm. You&apos;ll get a text when she does. Want a different date? Send a new request.</span>
        </p>
      ) : null}
      <div className="flex gap-2 mt-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={sent ? 'A different date…' : 'e.g. Sat Oct 11 at noon'}
          className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40"
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="bg-[#c9a84c] text-black font-bold px-4 rounded-xl text-sm disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Send
        </button>
      </div>
      {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
    </div>
  )
}
