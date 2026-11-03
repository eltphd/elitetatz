import { artistContext } from '@/lib/artist-session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Clock, CheckCircle, CalendarCheck, MessageCircle, Wallet, Link2, Receipt, Plus, ClipboardCheck } from 'lucide-react'
import type { ThreadMessage } from '@/components/InquiryThread'
import { signAttachments, type AttachmentRow } from '@/lib/attachments'
import { LeadCard, groupOf, type Group, type Lead } from './LeadCard'
import type { AttachmentView } from './AttachmentGrid'
import type { NoteView } from './NotesPanel'
import { clientHistory } from '@/lib/client-history'

// Lacey's inbox. Every channel (website, concierge, email, Instagram,
// Messenger, text, by hand) lands here as one card with the thread, the
// reference files, her notes and the assistant. Four groups, three buttons.
// Everything is read through her session (RLS), nothing depends on the
// notify_artist_on_match trigger: the app writes its own notifications.

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const ctx = await artistContext()
  if (!ctx.ok && ctx.status === 401) redirect('/auth/login?next=/dashboard')
  if (!ctx.ok) return <NotAnArtist reason={ctx.error} />
  const { user, artist, db } = ctx

  const { data: rows } = await db
    .from('matches')
    .select(`
      id, status, channel, client_brief, ai_summary, offered_price_cents,
      placement, created_at, artist_response, conversation_id,
      client_name, client_email, client_phone, external_thread_id, proposed_dates, appointment_at,
      design_fee_cents, date_request, stripe_payment_intent_id, last_client_message_at,
      clients (id, name, email)
    `)
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const leads = (rows ?? []) as unknown as Lead[]
  const ids = leads.map((l) => l.id)

  const threads = new Map<string, ThreadMessage[]>()
  const files = new Map<string, AttachmentView[]>()
  const notes = new Map<string, NoteView[]>()
  if (ids.length) {
    const [{ data: msgs }, { data: atts }, { data: nts }] = await Promise.all([
      db.from('match_messages').select('id, match_id, sender, body, channel, created_at').in('match_id', ids).order('created_at', { ascending: true }),
      db.from('lead_attachments').select('id, match_id, message_id, storage_path, filename, mime, size_bytes, source, created_at').in('match_id', ids).order('created_at', { ascending: true }),
      db.from('lead_notes').select('id, match_id, author, kind, body, created_at').in('match_id', ids).order('created_at', { ascending: true }),
    ])
    for (const m of (msgs ?? []) as (ThreadMessage & { match_id: string })[]) {
      const list = threads.get(m.match_id) ?? []
      list.push({ id: m.id, sender: m.sender, body: m.body, created_at: m.created_at, channel: m.channel ?? null })
      threads.set(m.match_id, list)
    }
    const attRows = (atts ?? []) as AttachmentRow[]
    const urls = await signAttachments(db, attRows)
    for (const a of attRows) {
      const list = files.get(a.match_id) ?? []
      list.push({ id: a.id, filename: a.filename, mime: a.mime, size_bytes: a.size_bytes, source: a.source, url: urls[a.id] ?? null, created_at: a.created_at })
      files.set(a.match_id, list)
    }
    for (const n of (nts ?? []) as (NoteView & { match_id: string })[]) {
      const list = notes.get(n.match_id) ?? []
      list.push({ id: n.id, author: n.author, kind: n.kind, body: n.body, created_at: n.created_at })
      notes.set(n.match_id, list)
    }
  }

  const [history, { count: pendingApprovals }] = await Promise.all([
    clientHistory(db, artist.id, leads),
    db.from('approvals').select('id', { count: 'exact', head: true }).eq('artist_id', artist.id).eq('status', 'pending'),
  ])

  const groups: Record<Group, Lead[]> = { needs_you: [], waiting: [], booked: [], closed: [] }
  for (const lead of leads) groups[groupOf(lead, threads.get(lead.id) ?? [])].push(lead)

  const sections: { key: Group; title: string; hint?: string; pulse?: boolean }[] = [
    { key: 'needs_you', title: 'Needs you', hint: 'New inquiries and client replies', pulse: true },
    { key: 'waiting', title: 'Waiting on client', hint: 'Questions out, quotes unpaid' },
    { key: 'booked', title: 'Booked', hint: 'Deposit in' },
    { key: 'closed', title: 'Closed' },
  ]
  const reviewUrlConfigured = Boolean(process.env.GOOGLE_REVIEW_URL?.trim())

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="text-sm font-bold">RawSunArt Studio</p>
              <p className="text-[10px] text-[#6b6b6b]">Lead inbox · {artist?.name ?? user.email}</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard/new" className="flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <Plus className="w-3.5 h-3.5" />
              Add a lead
            </Link>
            <Link href="/dashboard/approvals" className="flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Approvals</span>
              {(pendingApprovals ?? 0) > 0 && <span className="ml-0.5 text-[10px] font-bold bg-[#c9a84c] text-black rounded-full px-1.5 leading-4">{pendingApprovals}</span>}
            </Link>
            <Link href="/dashboard/payouts" className="hidden sm:flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <Wallet className="w-3.5 h-3.5" />
              Payouts
            </Link>
            <Link href="/dashboard/billing" className="hidden sm:flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <Receipt className="w-3.5 h-3.5" />
              Billing
            </Link>
            <Link href="/dashboard/connections" className="flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connections</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-16">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Needs you', value: groups.needs_you.length, icon: Clock, color: 'text-[#c9a84c]' },
            { label: 'Waiting', value: groups.waiting.length, icon: CheckCircle, color: 'text-[#e0c878]' },
            { label: 'Booked', value: groups.booked.length, icon: CalendarCheck, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
              <p className="text-2xl font-bold mb-0.5">{value}</p>
              <p className="text-[10px] text-[#6b6b6b]">{label}</p>
            </div>
          ))}
        </div>

        {leads.length === 0 && (
          <div className="text-center py-20">
            <MessageCircle className="w-10 h-10 text-[#6b6b6b] mx-auto mb-4 opacity-40" />
            <p className="text-sm text-[#6b6b6b] mb-2">No leads yet</p>
            <p className="text-xs text-[#6b6b6b] mb-5">Share your portfolio link to start getting inquiries, or add one by hand.</p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/rawsunart" className="text-[#c9a84c] text-sm font-medium">View your portfolio →</Link>
              <Link href="/dashboard/new" className="text-[#c9a84c] text-sm font-medium">Add a lead →</Link>
            </div>
          </div>
        )}

        {sections.map(({ key, title, hint, pulse }) => {
          const list = groups[key]
          if (list.length === 0) return null
          return (
            <section key={key} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                {pulse && <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />}
                <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">
                  {title} · {list.length}
                </p>
                {hint && <p className="text-[10px] text-[#4a4a4a] ml-auto">{hint}</p>}
              </div>
              <div className="space-y-3">
                {list.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    group={key}
                    thread={threads.get(lead.id) ?? []}
                    attachments={files.get(lead.id) ?? []}
                    notes={notes.get(lead.id) ?? []}
                    reviewUrlConfigured={reviewUrlConfigured}
                    history={history.get(lead.id)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}

function NotAnArtist({ reason }: { reason: string }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold mb-2">This inbox isn&apos;t available.</p>
        <p className="text-xs text-[#9b9b9b]">{reason}. If you are the artist, sign in with the email the studio set up for you.</p>
      </div>
    </div>
  )
}
