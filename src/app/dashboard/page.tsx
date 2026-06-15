import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Clock, CheckCircle, XCircle, DollarSign, MessageCircle, User } from 'lucide-react'
import { LeadActions } from './LeadActions'

// Lacey's dashboard — server component, reads real data

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard')

  // Get artist row for this user
  const { data: artist } = await supabase
    .from('artists')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  // Fetch pending + recent matches with conversation brief
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, status, client_brief, ai_summary, offered_price_cents,
      placement, created_at, artist_response,
      clients (id, name, email)
    `)
    .eq('artist_id', artist?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50)

  const pending = matches?.filter((m) => m.status === 'pending') ?? []
  const active = matches?.filter((m) => ['accepted', 'paid'].includes(m.status)) ?? []
  const closed = matches?.filter((m) => ['completed', 'rejected', 'cancelled'].includes(m.status)) ?? []

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
          <Link href="/rawsunart" className="text-xs text-[#c9a84c] font-medium">View portfolio →</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-16">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'New leads', value: pending.length, icon: Clock, color: 'text-[#c9a84c]' },
            { label: 'Active', value: active.length, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Completed', value: closed.filter(m => m.status === 'completed').length, icon: DollarSign, color: 'text-[#6b6b6b]' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
              <p className="text-2xl font-bold mb-0.5">{value}</p>
              <p className="text-[10px] text-[#6b6b6b]">{label}</p>
            </div>
          ))}
        </div>

        {/* Pending leads */}
        {pending.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
              <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">New inquiries · needs response</p>
            </div>
            <div className="space-y-3">
              {pending.map((match) => (
                <LeadCard key={match.id} match={match} status="pending" />
              ))}
            </div>
          </section>
        )}

        {/* Active */}
        {active.length > 0 && (
          <section className="mb-8">
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">Active projects</p>
            <div className="space-y-3">
              {active.map((match) => (
                <LeadCard key={match.id} match={match} status="active" />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {pending.length === 0 && active.length === 0 && (
          <div className="text-center py-20">
            <MessageCircle className="w-10 h-10 text-[#6b6b6b] mx-auto mb-4 opacity-40" />
            <p className="text-sm text-[#6b6b6b] mb-2">No leads yet</p>
            <p className="text-xs text-[#6b6b6b] mb-5">Share your portfolio link to start getting inquiries.</p>
            <Link href="/rawsunart" className="text-[#c9a84c] text-sm font-medium">View your portfolio →</Link>
          </div>
        )}

        {/* Closed / history */}
        {closed.length > 0 && (
          <section>
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-3">History</p>
            <div className="space-y-2">
              {closed.map((match) => (
                <LeadCard key={match.id} match={match} status="closed" />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeadCard({ match, status }: { match: any; status: 'pending' | 'active' | 'closed' }) {
  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(match.client_brief ?? '{}') } catch {}

  const concept = (brief.concept as string) || match.ai_summary || 'New inquiry'
  const styles = Array.isArray(brief.styles) ? brief.styles.join(', ') : ''
  const budget = brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : null
  const hasRef = brief.has_reference

  const statusBadge = {
    pending: { label: 'New', cls: 'bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/30' },
    active: { label: 'Active', cls: 'bg-green-900/20 text-green-400 border-green-800/30' },
    closed: { label: match.status, cls: 'bg-[#1e1e1e] text-[#6b6b6b] border-[#2a2a2a]' },
  }[status]

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 ${status === 'pending' ? 'border-[#c9a84c]/20' : 'border-[#2a2a2a]'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#6b6b6b]" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{match.clients?.name ?? 'Anonymous'}</p>
            <p className="text-[10px] text-[#6b6b6b]">{match.clients?.email ?? ''}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      <p className="text-sm font-medium mb-2 leading-snug">{concept}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {styles && <Tag>{styles}</Tag>}
        {match.placement && <Tag>{match.placement}</Tag>}
        {budget && <Tag>{budget} budget</Tag>}
        {hasRef && <Tag>Has reference</Tag>}
      </div>

      <p className="text-[10px] text-[#6b6b6b] mb-3">
        {new Date(match.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>

      {status === 'pending' && <LeadActions matchId={match.id} />}

      {match.artist_response && (
        <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
          <p className="text-[10px] text-[#6b6b6b] mb-1">Your response</p>
          <p className="text-xs text-[#9b9b9b]">{match.artist_response}</p>
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-[#9b9b9b] capitalize">
      {children}
    </span>
  )
}
