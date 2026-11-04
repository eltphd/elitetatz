import Link from 'next/link'
import { Sparkles, ArrowLeft, Inbox } from 'lucide-react'
import { APPROVAL_KINDS, KIND_LABEL, type ApprovalKind, type ApprovalView } from '@/lib/approvals'
import { ApprovalCard } from './ApprovalCard'

// The approvals screen, shared by the live page and the demo. Two tabs, one
// per kind. Nothing here sends: Approve is a record Erica acts on afterwards.

export function ApprovalsView({ items, tab, artistName, basePath, demo = false }: { items: ApprovalView[]; tab: ApprovalKind; artistName: string; basePath: string; demo?: boolean }) {
  const counts = Object.fromEntries(APPROVAL_KINDS.map((k) => [k, items.filter((i) => i.kind === k && i.status === 'pending').length])) as Record<ApprovalKind, number>
  const list = items.filter((i) => i.kind === tab)
  const waiting = list.filter((i) => i.status === 'pending' || i.status === 'changes_requested')
  const decided = list.filter((i) => !waiting.includes(i))

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="text-sm font-bold">Approvals</p>
              <p className="text-[10px] text-[#6b6b6b]">Your okay before anything goes out · {artistName}</p>
            </div>
          </div>
          <Link href={demo ? '/demo/inbox' : '/dashboard'} className="flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Inbox
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-16">
        <div className="flex gap-2 mb-5">
          {APPROVAL_KINDS.map((k) => (
            <Link
              key={k}
              href={`${basePath}?tab=${k}`}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border ${tab === k ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-[#c9a84c]' : 'bg-[#141414] border-[#2a2a2a] text-[#9b9b9b]'}`}
            >
              {KIND_LABEL[k]}
              {counts[k] > 0 && <span className="text-[10px] font-bold bg-[#c9a84c] text-black rounded-full px-1.5 leading-4">{counts[k]}</span>}
            </Link>
          ))}
        </div>

        <div className="mb-5 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 text-xs text-[#9b9b9b] leading-relaxed">
          <p className="text-white font-semibold mb-1">How this works</p>
          <p>Anything that would go out under your name lands here first, exactly as people will see it. Read it, then tap Approve or Ask for changes. Approve is your okay. The send runs by itself afterwards, on its schedule, and refuses to run without your okay on record.</p>
        </div>

        {list.length === 0 && (
          <div className="text-center py-16">
            <Inbox className="w-8 h-8 text-[#6b6b6b] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[#6b6b6b]">Nothing waiting in {KIND_LABEL[tab].toLowerCase()}.</p>
          </div>
        )}

        {waiting.length > 0 && (
          <section className="mb-8">
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">Waiting for you · {waiting.length}</p>
            <div className="space-y-3">{waiting.map((i) => <ApprovalCard key={i.id} item={i} demo={demo} />)}</div>
          </section>
        )}
        {decided.length > 0 && (
          <section className="mb-8">
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">Decided · {decided.length}</p>
            <div className="space-y-3">{decided.map((i) => <ApprovalCard key={i.id} item={i} demo={demo} />)}</div>
          </section>
        )}
      </main>
    </div>
  )
}
