import { User, Mail, Phone, AlertTriangle, HelpCircle, Camera, MessageCircle, AtSign, Globe, Smartphone, PenLine, Sparkles } from 'lucide-react'
import type { ThreadMessage } from '@/components/InquiryThread'
import { inquiryUrl, linksConfigured } from '@/lib/tokens'
import { depositLinkFor } from '@/lib/deposit'
import { briefFollowUps, referenceLine, suggestedQuestion } from '@/lib/brief'
import { suggestQuote } from '@/lib/quote'
import { replyRoute } from '@/lib/channels'
import { channelLabel } from '@/lib/channel-types'
import { AttachmentGrid, type AttachmentView } from './AttachmentGrid'
import { LeadWorkspace } from './LeadWorkspace'
import type { NoteView } from './NotesPanel'

// One lead, whatever channel it came by: who, what, the files, what is still
// open, the starting number, and then her buttons, the assistant, her notes
// and the thread. Server component; the interactive half is LeadWorkspace.

export interface Lead {
  id: string
  status: string
  channel: string | null
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
  external_thread_id: string | null
  proposed_dates: string | null
  appointment_at: string | null
  design_fee_cents: number | null
  date_request: string | null
  stripe_payment_intent_id: string | null
  last_client_message_at: string | null
  clients: { id: string; name: string | null; email: string | null } | null
}

export type Group = 'needs_you' | 'waiting' | 'booked' | 'closed'

export const CLOSED = ['rejected', 'completed', 'cancelled']
export const BOOKED = ['paid', 'booked']

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

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

export function isPast(iso: string | null, now = Date.now()): boolean {
  return Boolean(iso) && Date.parse(iso as string) < now
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })

// A client message newer than her last one means the ball is in her court,
// whatever the status says.
export function clientOwesNothing(thread: ThreadMessage[]): boolean {
  let lastArtist = 0
  let lastClient = 0
  for (const m of thread) {
    const t = new Date(m.created_at).getTime()
    if (m.sender === 'artist') lastArtist = Math.max(lastArtist, t)
    if (m.sender === 'client') lastClient = Math.max(lastClient, t)
  }
  return lastClient <= lastArtist
}

export function groupOf(lead: Lead, thread: ThreadMessage[]): Group {
  if (CLOSED.includes(lead.status)) return 'closed'
  if (lead.status === 'pending') return 'needs_you'
  if (!clientOwesNothing(thread)) return 'needs_you'
  // A paid client who has named a date and is waiting on her final say.
  if (lead.status === 'paid' && lead.date_request && !lead.appointment_at) return 'needs_you'
  if (BOOKED.includes(lead.status)) return 'booked'
  return 'waiting'
}

function ChannelIcon({ channel }: { channel: string | null }) {
  const cls = 'w-3 h-3'
  switch (channel) {
    case 'instagram': return <Camera className={cls} />
    case 'facebook': return <MessageCircle className={cls} />
    case 'email': return <AtSign className={cls} />
    case 'sms': return <Smartphone className={cls} />
    case 'manual': return <PenLine className={cls} />
    case 'concierge': return <Sparkles className={cls} />
    default: return <Globe className={cls} />
  }
}

export function LeadCard({
  lead,
  group,
  thread,
  attachments = [],
  notes = [],
  reviewUrlConfigured = false,
  demo = false,
}: {
  lead: Lead
  group: Group
  thread: ThreadMessage[]
  attachments?: AttachmentView[]
  notes?: NoteView[]
  reviewUrlConfigured?: boolean
  demo?: boolean
}) {
  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(lead.client_brief ?? '{}') } catch {}

  const email = lead.client_email || str(brief.client_email) || lead.clients?.email || ''
  const phone = lead.client_phone || str(brief.client_phone) || ''
  // A text with no name is still a person: show the number until she learns the name.
  const name = lead.client_name || str(brief.client_name) || lead.clients?.name || phone || 'Anonymous'
  const handle = str(brief.handle)
  const concept = str(brief.concept) || lead.ai_summary || 'New inquiry'
  const styles = Array.isArray(brief.styles) ? brief.styles.map(String).join(', ') : str(brief.styles)
  const placement = lead.placement || str(brief.placement)
  const size = str(brief.size)
  const budgetMax = Number(brief.budget_max_cents) || 0
  const budgetMin = Number(brief.budget_min_cents) || 0
  const budget = budgetMax ? (budgetMin && budgetMin !== budgetMax ? `${money(budgetMin)}–${money(budgetMax)}` : money(budgetMax)) : null
  const readiness = Number(brief.readiness_score)
  // What is still open before she quotes (the client's unanswered points and
  // an unconfirmed scale read) is shown apart from tattoo-ability notes.
  const followUps = briefFollowUps(brief)
  const toSettle = followUps.filter((f) => f.kind !== 'feasibility').map((f) => f.text)
  const flags = followUps.filter((f) => f.kind === 'feasibility').map((f) => f.text)
  const refs = referenceLine(brief)
  const scale = str(brief.scale_check)
  const pill = STATUS_PILL[lead.status] ?? { label: lead.status, cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' }
  const depositPaid = ['paid', 'booked', 'completed'].includes(lead.status) || Boolean(lead.stripe_payment_intent_id)
  const actionable =
    lead.status === 'pending' || lead.status === 'info_requested' || (lead.status === 'accepted' && !depositPaid) ||
    lead.status === 'paid' || lead.status === 'booked' || (lead.status === 'completed' && reviewUrlConfigured)
  const channel = lead.channel || (lead.conversation_id ? 'concierge' : 'web')
  const quote = ['pending', 'info_requested'].includes(lead.status) ? suggestQuote(brief) : null
  const hasRef = attachments.length > 0 || Boolean(brief.has_reference)
  const links = !demo && linksConfigured()

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${group === 'needs_you' ? 'border-[#c9a84c]/25' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#6b6b6b]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{name}{handle && name !== handle ? <span className="text-[#6b6b6b] font-normal"> {handle}</span> : null}</p>
            <p className="text-[10px] text-[#6b6b6b] flex items-center gap-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[#9b9b9b]"><ChannelIcon channel={channel} />{channelLabel(channel)}</span>
              <span>· {timeAgo(lead.created_at)} · {fmtDate(lead.created_at)}</span>
            </p>
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
        {hasRef ? <Tag>{attachments.length ? `${attachments.length} reference file${attachments.length === 1 ? '' : 's'}` : 'Has reference'}</Tag> : null}
        {brief.creative_freedom ? <Tag>Creative freedom</Tag> : null}
        {brief.deposit_ready ? <Tag>Deposit ready</Tag> : null}
        {Number.isFinite(readiness) && readiness > 0 && (
          <Tag tone={readiness >= 70 ? 'good' : 'warn'}>Readiness {readiness}</Tag>
        )}
      </div>

      <AttachmentGrid items={attachments} demo={demo} />

      {(refs || scale) && (
        <div className="mb-3 text-[11px] text-[#9b9b9b] space-y-0.5">
          {refs && <p><span className="text-[#6b6b6b]">Reference is for</span> {refs}</p>}
          {scale && (
            <p>
              <span className="text-[#6b6b6b]">Scale read</span> {scale}{' '}
              <span className={brief.scale_confirmed === true ? 'text-green-400' : 'text-amber-300'}>
                · {brief.scale_confirmed === true ? 'client confirmed' : 'not confirmed'}
              </span>
            </p>
          )}
        </div>
      )}

      {toSettle.length > 0 && (
        <div className="mb-3 flex items-start gap-1.5 text-[11px] text-[#e0c878] bg-[#c9a84c]/10 border border-[#c9a84c]/25 rounded-lg px-2.5 py-1.5">
          <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Still to settle before you quote</p>
            <ul className="space-y-0.5">{toSettle.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      )}

      {flags.length > 0 && (
        <div className="mb-3 flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-900/10 border border-amber-800/30 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{flags.join(' · ')}</span>
        </div>
      )}

      {(lead.status === 'paid' || lead.status === 'booked') && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3 text-xs space-y-1 mb-3">
          {lead.offered_price_cents != null && <p><span className="text-[#6b6b6b]">Quote</span> <span className="font-semibold">{money(lead.offered_price_cents)}</span>{lead.design_fee_cents ? <span className="text-[#9b9b9b]"> · drafts {money(lead.design_fee_cents)}</span> : null}</p>}
          {lead.proposed_dates && <p><span className="text-[#6b6b6b]">You offered</span> {lead.proposed_dates}</p>}
          {lead.appointment_at && <p><span className="text-[#6b6b6b]">Appointment</span> <span className="text-green-400">{fmtDate(lead.appointment_at)}</span></p>}
        </div>
      )}

      {!actionable && !CLOSED.includes(lead.status) && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-3 text-xs space-y-1 mb-3">
          {lead.offered_price_cents != null && (
            <p><span className="text-[#6b6b6b]">Quote</span> <span className="font-semibold">{money(lead.offered_price_cents)}</span></p>
          )}
          {lead.proposed_dates && <p><span className="text-[#6b6b6b]">Dates</span> {lead.proposed_dates}</p>}
          {lead.appointment_at && <p><span className="text-[#6b6b6b]">Appointment</span> <span className="text-green-400">{fmtDate(lead.appointment_at)}</span></p>}
          {!depositPaid && (
            <div className="pt-1">
              <p className="text-[10px] text-[#6b6b6b] mb-1">Deposit link — resend if the client didn&apos;t get it</p>
              <code className="block text-[10px] text-[#c9a84c] break-all">{depositLinkFor(lead.id).url ?? 'no deposit link configured'}</code>
            </div>
          )}
          {links && (
            <p className="text-[10px] text-[#6b6b6b] pt-1">
              Client page: <code className="text-[#9b9b9b] break-all">{inquiryUrl(lead.id)}</code>
            </p>
          )}
        </div>
      )}

      <LeadWorkspace
        matchId={lead.id}
        status={lead.status}
        actionable={actionable}
        conversationId={lead.conversation_id}
        thread={thread}
        clientName={name === 'Anonymous' || name === phone ? 'Client' : name.split(' ')[0]}
        canReply={!['rejected', 'cancelled'].includes(lead.status) && Boolean(email || phone || lead.external_thread_id?.startsWith('chatwoot:'))}
        dateRequest={lead.date_request}
        appointmentAt={lead.appointment_at}
        suggestedQuestion={suggestedQuestion(brief)}
        quote={quote}
        notes={notes}
        replyVia={replyRoute({ channel, client_email: email || null, client_phone: phone || null, external_thread_id: lead.external_thread_id })}
        reviewUrlConfigured={reviewUrlConfigured}
        sessionDone={lead.status === 'booked' && isPast(lead.appointment_at)}
        demo={demo}
      />
    </div>
  )
}

export function Tag({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-green-800/40 text-green-400 bg-green-900/10'
    : tone === 'warn' ? 'border-amber-800/40 text-amber-300 bg-amber-900/10'
    : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#9b9b9b]'
  return <span className={`text-[10px] px-2 py-0.5 border rounded-full capitalize ${cls}`}>{children}</span>
}
