import { decide, historyLine, NEW_CLIENT } from '@/lib/client-history'

const lead = { id: 'L', client_email: 'Jordan@Example.com', client_phone: '+16145550177', created_at: '2026-11-03T10:00:00Z' }
const session = (id: string, status: string, email: string | null, created_at: string, appointment_at: string | null = null) =>
  ({ id, status, client_email: email, client_phone: null, created_at, appointment_at, booked_at: null })

describe('client history', () => {
  test('no contact details is a first-timer', () => {
    expect(decide({ id: 'x', client_email: null, client_phone: null, created_at: '2026-11-03T00:00:00Z' }, [], [])).toEqual(NEW_CLIENT)
  })

  test('nothing on file is a first-timer', () => {
    expect(decide(lead, [], []).kind).toBe('new')
  })

  test('a past booked session makes them returning, matched by email case-insensitively', () => {
    const h = decide(lead, [session('A', 'completed', 'jordan@example.com', '2025-03-01T00:00:00Z', '2025-03-14T18:00:00Z')], [])
    expect(h.kind).toBe('returning')
    expect(h.sessions).toBe(1)
    expect(h.lastSessionAt).toBe('2025-03-14T18:00:00Z')
    expect(historyLine(h)).toBe('1 session with you, last Mar 2025')
  })

  test('matched by phone when the email differs', () => {
    const past = { id: 'B', status: 'booked', client_email: 'other@example.com', client_phone: '+16145550177', created_at: '2025-06-01T00:00:00Z', appointment_at: null, booked_at: '2025-06-02T00:00:00Z' }
    expect(decide(lead, [past], []).kind).toBe('returning')
  })

  test('the lead itself and later leads do not count', () => {
    const self = session('L', 'completed', 'jordan@example.com', '2026-11-03T10:00:00Z')
    const later = session('C', 'completed', 'jordan@example.com', '2026-12-01T00:00:00Z')
    expect(decide(lead, [self, later], []).kind).toBe('new')
  })

  test('an earlier inquiry that never booked is known, not returning', () => {
    const h = decide(lead, [session('D', 'rejected', 'jordan@example.com', '2025-01-01T00:00:00Z')], [])
    expect(h.kind).toBe('known')
    expect(h.priorLeads).toBe(1)
    expect(historyLine(h)).toBe('1 earlier inquiry, never booked')
  })

  test('a legacy customer on the reviewed list is returning even with no lead on file', () => {
    const h = decide(lead, [], [{ email: 'jordan@example.com', consent_status: 'legacy-customer', source: 'client export', source_year: '2019', first_seen_year: 2019, last_service_date: '2021-08', lacey_exclude: false }])
    expect(h.kind).toBe('returning')
    expect(h.onList).toBe(true)
    expect(historyLine(h)).toBe('tattooed by you, last 2021-08')
  })

  test('a correspondent on the list who never booked is known', () => {
    const h = decide(lead, [], [{ email: 'jordan@example.com', consent_status: 'correspondent', source: 'mailbox', source_year: null, first_seen_year: 2022, last_service_date: null, lacey_exclude: false }])
    expect(h.kind).toBe('known')
    expect(historyLine(h)).toBe('wrote to you before (2022)')
  })
})
