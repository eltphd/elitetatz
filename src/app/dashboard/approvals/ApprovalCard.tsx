'use client'

import { useState } from 'react'
import { CheckCircle2, MessageSquareWarning, Loader2, Users, Mail, FileText } from 'lucide-react'
import type { ApprovalView } from '@/lib/approvals'

// One thing waiting for Lacey's word. She reads it exactly as it will go out,
// then taps Approve or Ask for changes. Approve records her okay; the send or
// the publish still happens by hand afterwards, so nothing on this card
// reaches anyone.

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting for you', cls: 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30' },
  approved: { label: 'Approved · not sent yet', cls: 'bg-green-900/20 text-green-400 border-green-800/30' },
  changes_requested: { label: 'Changes requested', cls: 'bg-amber-900/20 text-amber-300 border-amber-800/30' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' },
  sent: { label: 'Sent', cls: 'bg-[#1e1e1e] text-[#9b9b9b] border-[#2a2a2a]' },
  published: { label: 'Published', cls: 'bg-[#1e1e1e] text-[#9b9b9b] border-[#2a2a2a]' },
}

export function ApprovalCard({ item, demo = false }: { item: ApprovalView; demo?: boolean }) {
  const [status, setStatus] = useState(item.status)
  const [decidedAt, setDecidedAt] = useState(item.decided_at)
  const [notes, setNotes] = useState(item.artist_notes ?? '')
  const [mode, setMode] = useState<'read' | 'changes'>('read')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'html' | 'text'>(item.body_html ? 'html' : 'text')
  const open = status === 'pending' || status === 'changes_requested' || status === 'approved'
  const pill = STATUS[status] ?? STATUS.pending

  async function decide(decision: 'approve' | 'changes') {
    if (busy) return
    if (decision === 'changes' && !notes.trim()) { setError('Say what should change.'); return }
    setBusy(true); setError('')
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 500))
      } else {
        const res = await fetch('/api/dashboard/approvals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, decision, notes: notes.trim() || undefined }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Could not save')
      }
      setStatus(decision === 'approve' ? 'approved' : 'changes_requested')
      setDecidedAt(new Date().toISOString())
      setMode('read')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${status === 'pending' ? 'border-[#c9a84c]/25' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{item.title}</p>
          <p className="text-[10px] text-[#6b6b6b] mt-0.5 flex items-center gap-1 flex-wrap">
            {item.kind === 'email_campaign' ? <Mail className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            <span>{item.kind === 'email_campaign' ? 'Email to your list' : 'Blog post for rawsunart.com'}</span>
            <span>· submitted {fmt(item.created_at)}</span>
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${pill.cls}`}>{pill.label}</span>
      </div>

      {item.summary && <p className="text-xs text-[#c8c8c8] leading-relaxed mb-3">{item.summary}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
        {item.subject && (
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2">
            <p className="text-[10px] text-[#6b6b6b] mb-0.5">Subject line</p>
            <p className="text-white">{item.subject}</p>
          </div>
        )}
        {(item.audience || item.audience_count != null) && (
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2">
            <p className="text-[10px] text-[#6b6b6b] mb-0.5 flex items-center gap-1"><Users className="w-3 h-3" /> Who gets it</p>
            <p className="text-white">{item.audience_count != null ? `${item.audience_count.toLocaleString('en-US')} people` : ''}{item.audience ? `${item.audience_count != null ? ' · ' : ''}${item.audience}` : ''}</p>
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">Exactly as it will go out</p>
          {item.body_html && item.body_text && (
            <div className="flex gap-1 text-[10px]">
              <button onClick={() => setView('html')} className={`px-2 py-0.5 rounded-full border ${view === 'html' ? 'border-[#c9a84c]/40 text-[#c9a84c]' : 'border-[#2a2a2a] text-[#6b6b6b]'}`}>Designed</button>
              <button onClick={() => setView('text')} className={`px-2 py-0.5 rounded-full border ${view === 'text' ? 'border-[#c9a84c]/40 text-[#c9a84c]' : 'border-[#2a2a2a] text-[#6b6b6b]'}`}>Plain text</button>
            </div>
          )}
        </div>
        {view === 'html' && item.body_html ? (
          <iframe
            title={`Preview of ${item.title}`}
            sandbox=""
            srcDoc={item.body_html}
            className="w-full h-[560px] bg-white rounded-xl border border-[#2a2a2a]"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-xs text-[#c8c8c8] bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3 max-h-[560px] overflow-y-auto font-sans leading-relaxed">{item.body_text ?? ''}</pre>
        )}
      </div>

      {decidedAt && status !== 'pending' && (
        <p className="text-[11px] text-[#9b9b9b] mb-2">
          You {status === 'approved' ? 'approved this' : status === 'changes_requested' ? 'asked for changes' : status} on {fmt(decidedAt)}.{notes && status === 'changes_requested' ? ` Your notes: “${notes}”` : ''}
          {status === 'approved' && ' It goes out by itself the next Tuesday to Thursday morning, 40 people at a time, until everyone has it.'}
        </p>
      )}

      {open && mode === 'read' && (
        <div className="flex gap-2">
          {status !== 'approved' && (
            <button onClick={() => decide('approve')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-[#c9a84c] text-black text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
            </button>
          )}
          <button onClick={() => setMode('changes')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-[#1e1e1e] border border-[#2a2a2a] text-white text-xs font-medium py-2.5 rounded-xl disabled:opacity-50">
            <MessageSquareWarning className="w-3.5 h-3.5" /> Ask for changes
          </button>
        </div>
      )}
      {open && mode === 'changes' && (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What should change? Plain words: “cut the second paragraph”, “say Dublin, not Columbus”…"
            className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setMode('read')} disabled={busy} className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white text-xs font-medium py-2.5 rounded-xl">Cancel</button>
            <button onClick={() => decide('changes')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-[#c9a84c] text-black text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Send my notes
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
