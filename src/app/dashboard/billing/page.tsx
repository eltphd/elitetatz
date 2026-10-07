import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Receipt } from 'lucide-react'
import { artistContext } from '@/lib/artist-session'
import { statements, money, FEE_PER_BOOKED_LEAD_CENTS, BILLABLE_LEADS_CAP_PER_MONTH, MONTHLY_FEE_CAP_CENTS, type BookedLead } from '@/lib/billing'

// The artist's statement: booked leads per month and what that costs her.
// Read-only; the invoice itself is sent from the platform side.

export const dynamic = 'force-dynamic'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

export default async function BillingPage() {
  const ctx = await artistContext()
  if (!ctx.ok) redirect('/auth/login?next=/dashboard/billing')
  const { artist, db } = ctx

  const since = new Date()
  since.setMonth(since.getMonth() - 6)
  const { data } = await db
    .from('matches')
    .select('id, booked_at, client_name, ai_summary, offered_price_cents')
    .eq('artist_id', artist.id)
    .not('booked_at', 'is', null)
    .gte('booked_at', since.toISOString())
    .order('booked_at', { ascending: false })
  const months = statements((data ?? []) as BookedLead[])
  const current = months[0]

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e]" aria-label="Back to inbox"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <p className="text-sm font-bold">Billing</p>
            <p className="text-[10px] text-[#6b6b6b]">What TatzAI charges you, and why</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-1">This month</p>
          <p className="text-3xl font-bold">{money(current?.feeCents ?? 0)}</p>
          <p className="text-sm text-[#9b9b9b] mt-1">
            {current?.booked ?? 0} booked lead{(current?.booked ?? 0) === 1 ? '' : 's'}
            {current && current.booked > BILLABLE_LEADS_CAP_PER_MONTH ? `, capped at ${BILLABLE_LEADS_CAP_PER_MONTH}` : ''}
          </p>
          <p className="text-xs text-[#6b6b6b] mt-3 leading-relaxed">
            {money(FEE_PER_BOOKED_LEAD_CENTS)} per booked lead, never more than {money(MONTHLY_FEE_CAP_CENTS)} a month. A lead counts as booked
            the moment its deposit is in. Nothing is owed for inquiries, questions, or passes, and your clients are never charged.
            Invoiced at the start of the following month.
          </p>
        </section>

        <section className="space-y-3">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Statements</p>
          {months.map((m) => (
            <details key={m.key} className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4" open={m.key === current?.key}>
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="flex items-center gap-2 text-sm font-semibold"><Receipt className="w-4 h-4 text-[#c9a84c]" />{m.label}</span>
                <span className="text-sm">{m.booked} booked · <span className="font-semibold">{money(m.feeCents)}</span></span>
              </summary>
              {m.leads.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#2a2a2a] text-xs">
                  {m.leads.map((l, i) => (
                    <li key={l.id} className="py-2 flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-white">{l.client_name || 'Client'}</span>
                        <span className="text-[#6b6b6b]"> · {l.ai_summary || 'piece'}</span>
                      </span>
                      <span className="shrink-0 text-[#9b9b9b]">{fmt(l.booked_at)} · {i < BILLABLE_LEADS_CAP_PER_MONTH ? money(FEE_PER_BOOKED_LEAD_CENTS) : 'over cap · $0'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-[#6b6b6b]">No booked leads this month.</p>
              )}
            </details>
          ))}
        </section>
      </main>
    </div>
  )
}
