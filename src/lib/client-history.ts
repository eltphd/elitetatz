import type { SupabaseClient } from '@supabase/supabase-js'

// Who is this, to Lacey? A first-timer, someone she has tattooed before, or
// someone who wrote to her before but never booked. Read at display time from
// her own records (past leads in `matches`, the client list in `rsa_contacts`),
// never stored, so it is never stale and never wrong about a new person.
//
// First-timers get the qualifying flow (what, where, size, budget, reference,
// then a quote). Returning clients skip the pitch: confirm the piece, offer
// dates. The card, the buttons and the assistant all read this.

export type ClientKind = 'new' | 'returning' | 'known'

export interface ClientHistory {
  kind: ClientKind
  // Sessions she did with them before this lead (booked or completed).
  sessions: number
  lastSessionAt: string | null
  // Other leads from them, any status, before this one.
  priorLeads: number
  // On the client list she reviewed in October (rsa_contacts).
  onList: boolean
  listStatus: string | null
  listSince: string | null
  lastService: string | null
  listSource: string | null
}

export const NEW_CLIENT: ClientHistory = {
  kind: 'new', sessions: 0, lastSessionAt: null, priorLeads: 0, onList: false,
  listStatus: null, listSince: null, lastService: null, listSource: null,
}

interface LeadLike { id: string; client_email?: string | null; client_phone?: string | null; created_at: string }
interface PastMatch { id: string; status: string; client_email: string | null; client_phone: string | null; created_at: string; appointment_at: string | null; booked_at: string | null }
interface ListRow { email: string; consent_status: string | null; source: string | null; source_year: string | null; first_seen_year: number | null; last_service_date: string | null; lacey_exclude: boolean | null }

const SESSION_STATUSES = new Set(['paid', 'booked', 'completed'])
const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

export function decide(lead: LeadLike, past: PastMatch[], list: ListRow[]): ClientHistory {
  const email = norm(lead.client_email)
  const phone = (lead.client_phone ?? '').trim()
  if (!email && !phone) return NEW_CLIENT
  const mine = past.filter((m) => m.id !== lead.id && m.created_at < lead.created_at && ((email && norm(m.client_email) === email) || (phone && m.client_phone === phone)))
  const sessions = mine.filter((m) => SESSION_STATUSES.has(m.status))
  const lastSessionAt = sessions.map((m) => m.appointment_at ?? m.booked_at ?? m.created_at).sort().pop() ?? null
  const row = email ? list.find((r) => norm(r.email) === email) : undefined
  const onList = Boolean(row)
  const tattooedBefore = sessions.length > 0 || row?.consent_status === 'legacy-customer'
  const kind: ClientKind = tattooedBefore ? 'returning' : mine.length > 0 || onList ? 'known' : 'new'
  return {
    kind,
    sessions: sessions.length,
    lastSessionAt,
    priorLeads: mine.length - sessions.length,
    onList,
    listStatus: row?.consent_status ?? null,
    listSince: row ? String(row.first_seen_year ?? row.source_year ?? '') || null : null,
    lastService: row?.last_service_date ?? null,
    listSource: row?.source ?? null,
  }
}

// History for a page of leads in two queries, whatever the page size.
export async function clientHistory(db: SupabaseClient, artistId: string, leads: LeadLike[]): Promise<Map<string, ClientHistory>> {
  const out = new Map<string, ClientHistory>()
  const emails = Array.from(new Set(leads.map((l) => norm(l.client_email)).filter(Boolean)))
  const phones = Array.from(new Set(leads.map((l) => (l.client_phone ?? '').trim()).filter(Boolean)))
  if (!emails.length && !phones.length) {
    for (const l of leads) out.set(l.id, NEW_CLIENT)
    return out
  }
  const [byEmail, byPhone, listRows] = await Promise.all([
    emails.length
      ? db.from('matches').select('id, status, client_email, client_phone, created_at, appointment_at, booked_at').eq('artist_id', artistId).in('client_email', emails)
      : Promise.resolve({ data: [] as PastMatch[] }),
    phones.length
      ? db.from('matches').select('id, status, client_email, client_phone, created_at, appointment_at, booked_at').eq('artist_id', artistId).in('client_phone', phones)
      : Promise.resolve({ data: [] as PastMatch[] }),
    emails.length
      ? db.from('rsa_contacts').select('email, consent_status, source, source_year, first_seen_year, last_service_date, lacey_exclude').in('email', emails)
      : Promise.resolve({ data: [] as ListRow[] }),
  ])
  const seen = new Map<string, PastMatch>()
  for (const m of [...((byEmail.data ?? []) as PastMatch[]), ...((byPhone.data ?? []) as PastMatch[])]) seen.set(m.id, m)
  const past = Array.from(seen.values())
  const list = (listRows.data ?? []) as ListRow[]
  for (const l of leads) out.set(l.id, decide(l, past, list))
  return out
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// One line for the card and the assistant: "Returning · 2 sessions, last Mar 2025".
export function historyLine(h: ClientHistory): string {
  if (h.kind === 'new') return ''
  if (h.kind === 'returning') {
    const parts: string[] = []
    if (h.sessions) parts.push(`${h.sessions} session${h.sessions === 1 ? '' : 's'} with you${h.lastSessionAt ? `, last ${monthYear(h.lastSessionAt)}` : ''}`)
    else if (h.lastService) parts.push(`tattooed by you, last ${h.lastService}`)
    else parts.push('on your client list as a past client')
    if (h.listSince && !h.lastService) parts.push(`since ${h.listSince}`)
    return parts.join(' · ')
  }
  const parts: string[] = []
  if (h.priorLeads) parts.push(`${h.priorLeads} earlier inquir${h.priorLeads === 1 ? 'y' : 'ies'}, never booked`)
  if (h.onList) parts.push(`wrote to you before${h.listSince ? ` (${h.listSince})` : ''}`)
  return parts.join(' · ') || 'has written before'
}
