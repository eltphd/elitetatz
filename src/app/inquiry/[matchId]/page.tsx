import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Clock, HelpCircle, CheckCircle, CalendarCheck, XCircle, ShieldCheck } from 'lucide-react'
import { verifyMatch, depositUrl } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { InquiryThread, type ThreadMessage } from '@/components/InquiryThread'

// The client's page. No account: the signed token in the URL is the proof,
// and it is checked before a single row is read. Wrong or missing token →
// a friendly dead end that leaks nothing.

export const metadata: Metadata = {
  title: `Your inquiry with ${ARTIST_CONFIG.name}`,
  robots: { index: false, follow: false },
}

const firstName = ARTIST_CONFIG.name.split(' ')[0]
const PAID = ['paid', 'booked', 'completed']
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const str = (v: unknown) => (v == null ? '' : String(v)).trim()

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })

export default async function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const { matchId } = await params
  const sp = await searchParams
  const token = Array.isArray(sp.t) ? sp.t[0] : sp.t

  if (!verifyMatch(matchId, token)) return <Shell><InvalidLink /></Shell>

  const admin = createAdminClient()
  if (!admin) return <Shell><Unavailable /></Shell>

  const { data: match } = await admin
    .from('matches')
    .select('id, status, offered_price_cents, proposed_dates, appointment_at, ai_summary, client_brief, client_name, stripe_payment_intent_id, created_at')
    .eq('id', matchId)
    .single()
  if (!match) return <Shell><InvalidLink /></Shell>

  const { data: rows } = await admin
    .from('match_messages')
    .select('id, sender, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  const messages = (rows ?? []) as ThreadMessage[]

  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(match.client_brief ?? '{}') } catch {}
  const concept = str(brief.concept) || str(match.ai_summary) || 'your piece'
  const placement = str(brief.placement)
  const size = str(brief.size)
  const clientName = match.client_name || 'You'
  const depositPaid = PAID.includes(match.status) || Boolean(match.stripe_payment_intent_id)

  return (
    <Shell>
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-[#c9a84c] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="text-[10px] text-[#6b6b6b] uppercase tracking-widest">{ARTIST_CONFIG.handle}</p>
            <h1 className="text-lg font-bold leading-tight">Your inquiry with {firstName}</h1>
          </div>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4">
          <p className="text-sm font-medium leading-snug mb-2">{concept}</p>
          <div className="flex flex-wrap gap-2">
            {placement && <Tag>{placement}</Tag>}
            {size && <Tag>{size}</Tag>}
            <Tag>Sent {fmtDate(match.created_at)}</Tag>
          </div>
        </div>
      </header>

      <StatusCard
        status={match.status}
        depositPaid={depositPaid}
        priceCents={match.offered_price_cents}
        proposedDates={match.proposed_dates}
        appointmentAt={match.appointment_at}
        depositLink={match.status === 'accepted' && !depositPaid ? depositUrl(matchId) : null}
      />

      <section className="mt-6">
        <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">Messages</p>
        <InquiryThread
          matchId={matchId}
          token={token!}
          messages={messages}
          clientName={clientName}
          artistName={firstName}
        />
      </section>

      <footer className="mt-10 text-center text-[10px] text-[#6b6b6b] space-y-1">
        <p>{ARTIST_CONFIG.studio} · {ARTIST_CONFIG.city}, {ARTIST_CONFIG.state}</p>
        <p>Keep this link — it is your inquiry page.</p>
      </footer>
    </Shell>
  )
}

function StatusCard({
  status, depositPaid, priceCents, proposedDates, appointmentAt, depositLink,
}: {
  status: string
  depositPaid: boolean
  priceCents: number | null
  proposedDates: string | null
  appointmentAt: string | null
  depositLink: string | null
}) {
  const base = 'rounded-2xl p-4 border'

  if (status === 'pending') {
    return (
      <div className={`${base} bg-[#141414] border-[#c9a84c]/20`}>
        <Row icon={<Clock className="w-4 h-4 text-[#c9a84c]" />} title="Pending review">
          {firstName} reads every inquiry herself. You&apos;ll get a text and an email when she answers, and it shows up here.
        </Row>
      </div>
    )
  }

  if (status === 'info_requested') {
    return (
      <div className={`${base} bg-[#141414] border-[#c9a84c]/40`}>
        <Row icon={<HelpCircle className="w-4 h-4 text-[#c9a84c]" />} title={`${firstName} asked a question`}>
          Her question is in the thread below. Reply there and she&apos;ll see it right away.
        </Row>
      </div>
    )
  }

  if (status === 'accepted' && !depositPaid) {
    return (
      <div className={`${base} bg-[#141414] border-[#c9a84c]/50`}>
        <Row icon={<CheckCircle className="w-4 h-4 text-green-400" />} title="Accepted">
          {firstName} wants to do this piece.
        </Row>
        <dl className="mt-3 space-y-1.5 text-sm">
          {priceCents != null && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#9b9b9b]">Her quote</dt>
              <dd className="font-semibold">{money(priceCents)}</dd>
            </div>
          )}
          {proposedDates && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#9b9b9b] shrink-0">Proposed dates</dt>
              <dd className="text-right">{proposedDates}</dd>
            </div>
          )}
        </dl>
        {depositLink && (
          <a
            href={depositLink}
            className="mt-4 flex items-center justify-center gap-2 w-full bg-[#c9a84c] text-black font-bold py-3.5 rounded-xl text-base"
          >
            <ShieldCheck className="w-4 h-4" />
            Pay {money(ARTIST_CONFIG.depositCents)} deposit
          </a>
        )}
        <p className="mt-3 text-[11px] text-[#6b6b6b] leading-relaxed">{ARTIST_CONFIG.depositPolicy}</p>
        <p className="mt-2 text-[11px] text-[#6b6b6b]">Need a different date? Say so in the thread below.</p>
      </div>
    )
  }

  if (depositPaid || status === 'booked') {
    return (
      <div className={`${base} bg-[#141414] border-green-800/40`}>
        <Row icon={<CalendarCheck className="w-4 h-4 text-green-400" />} title="Deposit paid">
          {appointmentAt ? (
            <>Your appointment is <span className="text-white font-semibold">{fmtDate(appointmentAt)}</span> at {ARTIST_CONFIG.address}.</>
          ) : (
            <>{firstName} is confirming your date{proposedDates ? ` (${proposedDates})` : ''}. It will show here and you&apos;ll get a text.</>
          )}
        </Row>
        {priceCents != null && (
          <p className="mt-3 text-xs text-[#9b9b9b]">
            Quote {money(priceCents)} · {money(ARTIST_CONFIG.depositCents)} deposit comes off the final price.
          </p>
        )}
        {status === 'completed' && <p className="mt-2 text-xs text-green-400">Completed — thank you.</p>}
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className={`${base} bg-[#141414] border-[#2a2a2a]`}>
        <Row icon={<XCircle className="w-4 h-4 text-[#6b6b6b]" />} title="Passed">
          {firstName} isn&apos;t able to take this one on right now. Her note, if she left one, is in the thread below.
        </Row>
      </div>
    )
  }

  return (
    <div className={`${base} bg-[#141414] border-[#2a2a2a]`}>
      <Row icon={<XCircle className="w-4 h-4 text-[#6b6b6b]" />} title="Closed">
        This inquiry is closed. Start a new one any time.
      </Row>
    </div>
  )
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold mb-1">{title}</p>
        <p className="text-sm text-[#9b9b9b] leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-[#9b9b9b]">
      {children}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <main className="max-w-lg mx-auto px-4 pt-6 pb-16">{children}</main>
    </div>
  )
}

function InvalidLink() {
  return (
    <div className="text-center py-24">
      <div className="w-12 h-12 rounded-full bg-[#141414] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
        <XCircle className="w-5 h-5 text-[#6b6b6b]" />
      </div>
      <h1 className="text-lg font-bold mb-2">This link isn&apos;t valid</h1>
      <p className="text-sm text-[#9b9b9b] mb-6 leading-relaxed">
        Check the link in your email or text from {ARTIST_CONFIG.handle}, or start a fresh inquiry.
      </p>
      <Link href="/rawsunart" className="text-[#c9a84c] text-sm font-medium">Start a new inquiry →</Link>
    </div>
  )
}

function Unavailable() {
  return (
    <div className="text-center py-24">
      <h1 className="text-lg font-bold mb-2">One moment</h1>
      <p className="text-sm text-[#9b9b9b]">Your inquiry page is temporarily unavailable. Try again in a minute.</p>
    </div>
  )
}
