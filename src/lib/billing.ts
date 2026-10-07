// Platform fee, decided 2026-10-06: the artist pays $25 per booked lead,
// capped at 10 a month (so never more than $250), invoiced monthly. Nothing
// is owed until a client puts down a deposit. Clients are never charged.
export const FEE_PER_BOOKED_LEAD_CENTS = 2500
export const BILLABLE_LEADS_CAP_PER_MONTH = 10
export const MONTHLY_FEE_CAP_CENTS = FEE_PER_BOOKED_LEAD_CENTS * BILLABLE_LEADS_CAP_PER_MONTH

export interface BookedLead {
  id: string
  booked_at: string
  client_name: string | null
  ai_summary: string | null
  offered_price_cents: number | null
}

export interface MonthlyStatement {
  key: string        // YYYY-MM in America/New_York
  label: string      // "October 2026"
  booked: number
  billable: number
  feeCents: number
  leads: BookedLead[]
}

const TZ = 'America/New_York'

export function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.toLocaleString('en-US', { timeZone: TZ, year: 'numeric' })
  const m = d.toLocaleString('en-US', { timeZone: TZ, month: '2-digit' })
  return `${y}-${m}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function statements(leads: BookedLead[], months = 6): MonthlyStatement[] {
  const byMonth = new Map<string, BookedLead[]>()
  for (const l of leads) {
    if (!l.booked_at) continue
    const k = monthKey(l.booked_at)
    byMonth.set(k, [...(byMonth.get(k) ?? []), l])
  }
  // Always include the current month, even at zero.
  const nowKey = monthKey(new Date().toISOString())
  if (!byMonth.has(nowKey)) byMonth.set(nowKey, [])
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, months)
    .map(([key, rows]) => {
      const booked = rows.length
      const billable = Math.min(booked, BILLABLE_LEADS_CAP_PER_MONTH)
      return { key, label: monthLabel(key), booked, billable, feeCents: billable * FEE_PER_BOOKED_LEAD_CENTS, leads: rows.sort((a, b) => (a.booked_at < b.booked_at ? 1 : -1)) }
    })
}

export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
