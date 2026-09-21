import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Clock, CheckCircle, CalendarCheck, MessageCircle, User, Mail, Phone, AlertTriangle, Wallet,
} from 'lucide-react'
import { LeadActions } from './LeadActions'
import { ConversationViewer } from './ConversationViewer'
import type { ThreadMessage } from '@/components/InquiryThread'
import { depositUrl, inquiryUrl } from '@/lib/tokens'

// Lacey's inbox. Four groups, three buttons, one thread per lead.
// Everything is read through her session (RLS), nothing depends on the
// notify_artist_on_match trigger: the app writes its own notifications.

export const dynamic = 'force-dynamic'

interface Lead {
  id: string
  status: string
  client_brief: string | null
  ai_summary: string | null
  offered_price_cents: number | null
  placement: string | null
  created_at: string
  artist_response: string | null
  conversation_id: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  proposed_dates: string | null
  appointment_at: string | null
  stripe_payment_intent_id: string | null
  clients: { id: string; name: string | null; email: string | null } | null
}

type Group = 'needs_you' | 'waiting' | 'booked' | 'closed'

const CLOSED = ['rejected', 'completed', 'cancelled']
const BOOKED = ['paid', 'booked']

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'New', cls: 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30' },
  info_requested: { label: 'Asked', cls: 'bg-[#c9a84c]/10 text-[#e0c878] border-[#c9a84c]/20' },
  accepted: { label: 'Quoted · unpaid', cls: 'bg-green-900/20 text-green-400 border-green-800/30' },
  paid: { label: 'Deposit paid', cls: 'bg-green-900/30 text-green-300 border-green-700/40' },
  booked: { label: 'Booked', cls: 'bg-green-900/30 text-green-300 border-green-700/40' },
  completed: { label: 'Done', cls: 'bg-[#1e1e1e] text-[#9b9b9b] border-[#2a2a2a]' },
  rejected: { label: 'Passed', cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' },
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })

// A client message newer than her last one means the ball is in her court,
// whatever the status says.
function clientOwesNothing(thread: ThreadMessage[]): boolean {
  let lastArtist = 0
  let lastClient = 0
  for (const m of thread) {
    const t = new Date(m.created_at).getTime()
    if (m.sender === 'artist') lastArtist = Math.max(lastArtist, t)
    if (m.sender === 'client') lastClient = Math.max(lastClient, t)
  }
  return lastClient <= lastArtist
}

function groupOf(lead: Lead, thread: ThreadMessage[]): Group {
  if (CLOSED.includes(lead.status)) return 'closed'
  if (lead.status === 'pending') return 'needs_you'
  if (!clientOwesNothing(thread)) return 'needs_you'
  if (BOOKED.includes(lead.status)) return 'booked'
  return 'waiting'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard')

  const { data: artist } = await supabase
    .from('artists')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  const { data: rows } = await supabase
    .from('matches')
    .select(`
      id, status, client_brief, ai_summary, offered_price_cents,
      placement, created_at, artist_response, conversation_id,
      client_name, client_email, client_phone, proposed_dates, appointment_at,
      stripe_payment_intent_id,
      clients (id, name, email)
    `)
    .eq('artist_id', artist?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(100)

  const leads = (rows ?? []) as unknown as Lead[]

  const threads = new Map<string, ThreadMessage[]>()
  if (leads.length) {
    const { data: msgs } = await supabase
      .from('match_messages')
      .select('id, match_id, sender, body, created_at')
      .in('match_id', leads.map((l) => l.id))
      .order('created_at', { ascending: true })
    for (const m of (msgs ?? []) as (ThreadMessage & { match_id: string })[]) {
      const list = threads.get(m.match_id) ?? []
      list.push({ id: m.id, sender: m.sender, body: m.body, created_at: m.created_at })
      threads.set(m.match_id, list)
    }
  }

  const groups: Record<Group, Lead[]> = { needs_you: [], waiting: [], booked: [], closed: [] }
  for (const lead of leads) groups[groupOf(lead, threads.get(lead.id) ?? [])].push(lead)

  const sections: { key: Group; title: string; hint?: string; pulse?: boolean }[] = [
    { key: 'needs_you', title: 'Needs you', hint: 'New inquiries and client replies', pulse: true },
    { key: 'waiting', title: 'Waiting on client', hint: 'Questions out, quotes unpaid' },
    { key: 'booked', title: 'Booked', hint: 'Deposit in' },
    { key: 'closed', title: 'Closed' },
  ]

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
            <Link href="/dashboard/payouts" className="flex items-center gap-1 text-xs text-[#c9a84c] font-medium">
              <Wallet className="w-3.5 h-3.5" />
              Payouts
            </Link>
            <Link href="/rawsunart" className="text-xs text-[#9b9b9b] font-medium hidden sm:inline">Portfolio →</Link>
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
            <p className="text-xs text-[#6b6b6b] mb-5">Share your portfolio link to start getting inquiries.</p>
            <Link href="/rawsunart" className="text-[#c9a84c] text-sm font-medium">View your portfolio →</Link>
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
                  <LeadCard key={lead.id} lead={lead} group={key} thread={threads.get(lead.id) ?? []} />
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}

function LeadCard({ lead, group, thread }: { lead: Lead; group: Group; thread: ThreadMessage[] }) {
  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(lead.client_brief ?? '{}') } catch {}

  const name = lead.client_name || str(brief.client_name) || lead.clients?.name || 'Anonymous'
  const email = lead.client_email || str(brief.client_email) || lead.clients?.email || ''
  const phone = lead.client_phone || str(brief.client_phone) || ''
  const concept = str(brief.concept) || lead.ai_summary || 'New inquiry'
  const styles = Array.isArray(brief.styles) ? brief.styles.map(String).join(', ') : str(brief.styles)
  const placement = lead.placement || str(brief.placement)
  const size = str(brief.size)
  const budgetMax = Number(brief.budget_max_cents) || 0
  const budgetMin = Number(brief.budget_min_cents) || 0
  const budget = budgetMax ? (budgetMin && budgetMin !== budgetMax ? `${money(budgetMin)}–${money(budgetMax)}` : money(budgetMax)) : null
  const readiness = Number(brief.readiness_score)
  const flags = Array.isArray(brief.feasibility_flags) ? brief.feasibility_flags.map(String).filter(Boolean) : []
  const pill = STATUS_PILL[lead.status] ?? { label: lead.status, cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' }
  const actionable = lead.status === 'pending' || lead.status === 'info_requested'
  const depositPaid = ['paid', 'booked', 'completed'].includes(lead.status) || Boolean(lead.stripe_payment_intent_id)

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${group === 'needs_you' ? 'border-[#c9a84c]/25' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#6b6b6b]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{name}</p>
            <p className="text-[10px] text-[#6b6b6b]">{timeAgo(lead.created_at)} · {fmtDate(lead.created_at)}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      {(email || phone) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs">
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-1 text-[#9b9b9b] hover:text-[#c9a84c]">
              <Mail className="w-3 h-3" />{email}
            </a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 text-[#9b9b9b] hover:text-[#c9a84c]">
              <Phone className="w-3 h-3" />{phone}
            </a>
          )}
        </div>
      )}

      <p className="text-sm font-medium mb-2 leading-snug">{concept}</p>

      <div className="flex flex-wrap gap-2 mb-2">
        {styles && <Tag>{styles}</Tag>}
        {placement && <Tag>{placement}</Tag>}
        {size && <Tag>{size}</Tag>}
        {budget && <Tag>{budget} budget</Tag>}
        {brief.has_reference ? <Tag>Has reference</Tag> : null}
        {brief.creative_freedom ? <Tag>Creative freedom</Tag> : null}
        {brief.deposit_ready ? <Tag>Deposit ready</Tag> : null}
        {Number.isFinite(readiness) && readiness > 0 && (
          <Tag tone={readiness >= 70 ? 'good' : 'warn'}>Readiness {readiness}</Tag>
        )}
      </div>

      {flags.length > 0 && (
        <div className="mb-3 flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-900/10 border border-amber-800/30 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{flags.join(' · ')}</span>
        </div>
      )}

      {actionable && <LeadActions matchId={lead.id} status={lead.status as 'pending' | 'info_requested'} />}

      {!actionable && !CLOSED.includes(lead.status) && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3 text-xs space-y-1">
          {lead.offered_price_cents != null && (
            <p><span className="text-[#6b6b6b]">Quote</span> <span className="font-semibold">{money(lead.offered_price_cents)}</span></p>
          )}
          {lead.proposed_dates && <p><span className="text-[#6b6b6b]">Dates</span> {lead.proposed_dates}</p>}
          {lead.appointment_at && <p><span className="text-[#6b6b6b]">Appointment</span> <span className="text-green-400">{fmtDate(lead.appointment_at)}</span></p>}
          {!depositPaid && (
            <div className="pt-1">
              <p className="text-[10px] text-[#6b6b6b] mb-1">Deposit link — resend if the client didn&apos;t get it</p>
              <code className="block text-[10px] text-[#c9a84c] break-all">{depositUrl(lead.id)}</code>
            </div>
          )}
          <p className="text-[10px] text-[#6b6b6b] pt-1">
            Client page: <code className="text-[#9b9b9b] break-all">{inquiryUrl(lead.id)}</code>
          </p>
        </div>
      )}

      <ConversationViewer
        matchId={lead.id}
        conversationId={lead.conversation_id}
        thread={thread}
        clientName={name === 'Anonymous' ? 'Client' : name.split(' ')[0]}
        canReply={!['rejected', 'cancelled'].includes(lead.status)}
      />
    </div>
  )
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-green-800/40 text-green-400 bg-green-900/10'
    : tone === 'warn' ? 'border-amber-800/40 text-amber-300 bg-amber-900/10'
    : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#9b9b9b]'
  return <span className={`text-[10px] px-2 py-0.5 border rounded-full capitalize ${cls}`}>{children}</span>
}
