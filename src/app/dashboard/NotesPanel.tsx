'use client'

import { useState } from 'react'
import { StickyNote, Loader2, Trash2 } from 'lucide-react'

// Her notes to herself on a lead. Private: never shown to the client, never
// sent. The assistant reads them so its advice knows what she already thinks.

export interface NoteView { id: string; author: string; kind: string; body: string; created_at: string }

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export function NotesPanel({ matchId, notes, demo = false }: { matchId: string; notes: NoteView[]; demo?: boolean }) {
  const [list, setList] = useState<NoteView[]>(notes.filter((n) => n.author === 'artist'))
  const [text, setText] = useState('')
  const [open, setOpen] = useState(list.length > 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true); setError('')
    try {
      if (demo) {
        setList((l) => [...l, { id: `demo-${Date.now()}`, author: 'artist', kind: 'note', body, created_at: new Date().toISOString() }])
      } else {
        const res = await fetch('/api/dashboard/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, body }) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Could not save')
        setList((l) => [...l, data.note])
      }
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    setList((l) => l.filter((n) => n.id !== id))
    if (demo) return
    await fetch('/api/dashboard/notes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs text-[#6b6b6b] hover:text-white transition-colors">
        <StickyNote className="w-3.5 h-3.5" />
        <span>Your notes{list.length ? ` · ${list.length}` : ''}</span>
        <span className="text-[10px] text-[#4a4a4a]">private</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {list.map((n) => (
            <div key={n.id} className="group flex items-start gap-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[#d0d0d0]">{n.body}</p>
                <p className="text-[9px] text-[#6b6b6b] mt-1">{when(n.created_at)}</p>
              </div>
              <button onClick={() => remove(n.id)} aria-label="Delete note" className="opacity-0 group-hover:opacity-100 text-[#6b6b6b] hover:text-red-400 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add() }}
              rows={1}
              placeholder="A note to yourself: what you think, what to check at the appointment…"
              className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 resize-none"
            />
            <button onClick={add} disabled={!text.trim() || busy} className="h-9 px-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-xs text-[#e0c878] disabled:opacity-40 flex items-center gap-1">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
