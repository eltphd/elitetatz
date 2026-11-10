/**
 * @jest-environment node
 */
import { fakeDb, type Call } from '../helpers/fake-db'

// The 7 PM digest: one email to Lacey every evening, zero day or not.

const notifyArtist = jest.fn()
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notifyArtist(...a) }))
const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))

import { digestCopy, summarize, runDigest, easternDayStart, type DigestLead, type ProbeRow, type NudgeRow } from '@/lib/digest'
import type { HoldMessage } from '@/lib/holds'

const H = 3_600_000
// Tuesday 2026-11-10, 7:00 PM Eastern (EST = UTC-5).
const NOW = Date.parse('2026-11-11T00:00:00Z')
const ago = (msBack: number) => new Date(NOW - msBack).toISOString()
const PROBE_OK: ProbeRow = { ran_at: '2026-11-10T14:00:00Z', ok: true, error: null } // 9:00 AM Eastern
// Last night's digest, confirmed delivered by her mail server a few seconds after 7 PM.
const RECEIPT = ago(24 * H - 5000)

function lead(over: Partial<DigestLead> = {}): DigestLead {
  return { id: 'm1', status: 'pending', client_name: 'Ana Ruiz', client_brief: '{"found_via":"instagram"}', ai_summary: 'small watercolor fern', created_at: ago(3 * H), artist_responded_at: null, ...over }
}
const has = (c: Call, col: string, val?: unknown) => c.filters.some(([k, v]) => k === col && (val === undefined || v === val))

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  notifyArtist.mockReset().mockResolvedValue({ emailed: true, logId: 'log-1' })
  alertOperator.mockClear()
})

describe('digest copy', () => {
  test('a zero day says so, and that the system was checked', () => {
    const { subject, text } = digestCopy(summarize([], [], PROBE_OK, NOW, [], RECEIPT))
    expect(subject).toBe('RawSunArt today: 0 new inquiries')
    expect(text.startsWith('Today: 0 new inquiries. System checked OK at 9:00 AM.')).toBe(true)
    expect(text).toContain('Nothing is waiting on you.')
    expect(text).toContain('https://elitetatz.app/dashboard')
    expect(text).toContain('Tuesday, Nov 10')
    expect(text).not.toContain('Waiting on you:')
  })

  test('"System checked OK" is only said with a fresh delivery receipt; otherwise the line says what was actually checked', () => {
    const line = (receipt: string | null) => digestCopy(summarize([], [], PROBE_OK, NOW, [], receipt)).text.split('\n')[0]
    // The probe mails nobody, so on its own it proves the form and the inbox, not email.
    expect(line(null)).toBe('Today: 0 new inquiries. Form and inbox checked at 9:00 AM.')
    // A receipt from three days ago proves nothing about today.
    expect(line(ago(72 * H))).toBe('Today: 0 new inquiries. Form and inbox checked at 9:00 AM.')
    expect(line(ago(27 * H))).toBe('Today: 0 new inquiries. Form and inbox checked at 9:00 AM.')
    // Last night's digest, or anything she was sent today, does.
    expect(line(RECEIPT)).toBe('Today: 0 new inquiries. System checked OK at 9:00 AM.')
    expect(line(ago(2 * H))).toBe('Today: 0 new inquiries. System checked OK at 9:00 AM.')
  })

  test('a busy day names who came in and who has waited on her over a day', () => {
    const leads = [
      lead({ id: 'm1', client_name: 'Ana Ruiz', created_at: ago(2 * H) }),
      lead({ id: 'm2', client_name: 'Marcus Lee', ai_summary: 'blackwork sleeve', created_at: ago(5 * H) }),
      // Yesterday's lead, untouched for 30 hours.
      lead({ id: 'm3', client_name: 'Priya', ai_summary: 'fine-line moth', created_at: ago(30 * H) }),
      // Lacey answered this one; the client has not written back, so it is not on her.
      lead({ id: 'm4', client_name: 'Theo', status: 'info_requested', created_at: ago(50 * H), artist_responded_at: ago(40 * H) }),
    ]
    const msgs: HoldMessage[] = [{ match_id: 'm4', sender: 'artist', body: 'How big?', created_at: ago(40 * H) }]
    const s = summarize(leads, msgs, PROBE_OK, NOW, [], RECEIPT)
    expect(s.newToday.map((n) => n.first)).toEqual(['Marcus', 'Ana'])
    expect(s.unanswered).toEqual([{ first: 'Priya', concept: 'fine-line moth', waited: '30 hours', nudgedAt: null }])

    const { subject, text } = digestCopy(s)
    expect(subject).toBe('RawSunArt today: 2 new inquiries, 1 waiting on you')
    expect(text.startsWith('Today: 2 new inquiries (Marcus, Ana). 1 has waited on you over 24 hours. System checked OK at 9:00 AM.')).toBe(true)
    expect(text).toContain('• Priya · fine-line moth · waiting 30 hours')
    expect(text).toContain('• Marcus · blackwork sleeve')
    expect(text).not.toContain('Nothing is waiting on you.')
    expect(text).not.toContain('you were emailed')
  })

  test('a lead the hold timer already emailed her about today is one line, not a second reminder', () => {
    const priya = lead({ id: 'm3', client_name: 'Priya', ai_summary: 'fine-line moth', created_at: ago(30 * H) })
    const nudges: NudgeRow[] = [
      { match_id: 'm3', created_at: '2026-11-10T15:00:00Z' }, // 10:00 AM Eastern today
      { match_id: 'm3', created_at: '2026-11-09T15:00:00Z' }, // yesterday: not today's
    ]
    const s = summarize([priya], [], PROBE_OK, NOW, nudges)
    expect(s.unanswered[0].nudgedAt).toBe('10:00 AM')
    const { text } = digestCopy(s)
    expect(text).toContain('• Priya · fine-line moth · waiting 30 hours · you were emailed at 10:00 AM')
    expect(text).toContain('This is the only reminder tonight.')
    // A yesterday-only nudge does not count as today's.
    expect(summarize([priya], [], PROBE_OK, NOW, [nudges[1]]).unanswered[0].nudgedAt).toBeNull()
  })

  test('a thread that has moved into her mailbox is not "waiting on you": the timers leave it alone, and so does the digest', () => {
    // She forwarded this inquiry from her own mailbox 30 hours ago; she may have answered there.
    const forwarded = lead({ id: 'f', client_name: 'Devon', created_at: ago(30 * H) })
    // She answered this one from her mail app; the portal recorded the copy.
    const replied = lead({ id: 'r', client_name: 'Sam', status: 'info_requested', created_at: ago(60 * H), artist_responded_at: ago(50 * H) })
    // Same shape, but the last word came through the inquiry page: this one is on her.
    const portal = lead({ id: 'p', client_name: 'Priya', status: 'info_requested', created_at: ago(60 * H), artist_responded_at: ago(50 * H) })
    const msgs: HoldMessage[] = [
      { match_id: 'f', sender: 'client', body: 'Hi', created_at: ago(30 * H), meta: { mailbox: 'forwarded' } },
      { match_id: 'r', sender: 'client', body: 'About a palm', created_at: ago(40 * H) },
      { match_id: 'r', sender: 'artist', body: 'Great', created_at: ago(39 * H), meta: { mailbox: 'reply' } },
      { match_id: 'p', sender: 'artist', body: 'How big?', created_at: ago(50 * H), meta: { mailbox: 'reply' } },
      { match_id: 'p', sender: 'client', body: 'About a palm', created_at: ago(30 * H) },
    ]
    const s = summarize([forwarded, replied, portal], msgs, PROBE_OK, NOW)
    expect(s.unanswered.map((u) => u.first)).toEqual(['Priya'])
  })

  test('a failed or missing probe is said plainly, never hidden, receipt or not', () => {
    expect(digestCopy(summarize([], [], { ...PROBE_OK, ok: false, error: 'no source row' }, NOW, [], RECEIPT)).text).toContain('The system check at 9:00 AM did not pass; Erica has been told')
    expect(digestCopy(summarize([], [], null, NOW, [], RECEIPT)).text).toContain('No system check ran today; Erica has been told.')
  })

  test('the probe’s own inquiry is never counted', () => {
    const probe = lead({ id: 'p', client_name: 'System Probe', client_brief: '{"found_via":"test-probe"}', created_at: ago(10 * H) })
    const s = summarize([probe, lead({ created_at: ago(30 * H) })], [], PROBE_OK, NOW)
    expect(s.newToday).toHaveLength(0)
    expect(s.unanswered).toHaveLength(1)
  })

  test('the Eastern day starts at midnight Eastern', () => {
    expect(new Date(easternDayStart(NOW)).toISOString()).toBe('2026-11-10T05:00:00.000Z') // EST
    expect(new Date(easternDayStart(Date.parse('2026-07-15T23:00:00Z'))).toISOString()).toBe('2026-07-15T04:00:00.000Z') // EDT
  })
})

describe('runDigest', () => {
  interface World { leads?: DigestLead[]; probe?: ProbeRow | null; messages?: HoldMessage[]; sentNudges?: NudgeRow[]; holdEvents?: unknown[]; receipt?: string | null; alreadySent?: boolean }
  const tick = (w: World = {}) => {
    const db = fakeDb((c: Call) => {
      if (c.table === 'matches') return { data: w.leads ?? [] }
      if (c.table === 'match_messages') return { data: w.messages ?? [] }
      if (c.table === 'probe_runs') return { data: w.probe === undefined ? [PROBE_OK] : w.probe ? [w.probe] : [] }
      if (c.table === 'hold_events') return { data: w.holdEvents ?? [] }
      if (c.table === 'artist_notifications') {
        if (has(c, 'kind', 'Daily digest')) return { data: w.alreadySent ? [{ id: 'log-0' }] : [] } // the once-a-day check
        if (has(c, 'delivery_status', 'delivered')) return { data: w.receipt === undefined ? [{ delivered_at: RECEIPT }] : w.receipt ? [{ delivered_at: w.receipt }] : [] }
        if (has(c, 'kind in')) return { data: w.sentNudges ?? [] } // A1/A2 emails that really went
      }
      return undefined
    })
    return { db, run: (now = NOW, force = false) => runDigest(db.db, 'artist-1', { now, force }) }
  }

  test('sends the zero-day note through notifyArtist, logged as "Daily digest" for the day', async () => {
    const t = tick()
    const r = await t.run()
    expect(r).toEqual({ sent: true, skipped: null, newToday: 0, unanswered: 0, probe: 'ok', delivery: 'confirmed' })
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice).toMatchObject({ kind: 'Daily digest', ref: 'digest-2026-11-10', artistId: 'artist-1' })
    expect(notice.text).toContain('Today: 0 new inquiries. System checked OK at 9:00 AM.')
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('with no delivery receipt on record the note claims only what the probe checked', async () => {
    const r = await tick({ receipt: null }).run()
    expect(r).toMatchObject({ sent: true, probe: 'ok', delivery: 'unconfirmed' })
    const text = notifyArtist.mock.calls[0][0].text as string
    expect(text).toContain('Today: 0 new inquiries. Form and inbox checked at 9:00 AM.')
    expect(text).not.toContain('System checked OK')
  })

  test('only the 7 PM Eastern tick sends; the other cron hour is skipped without reading anything', async () => {
    const t = tick({ leads: [lead()] })
    const r = await t.run(Date.parse('2026-11-10T23:00:00Z')) // 6 PM EST: the 23:00 UTC tick in winter
    expect(r.skipped).toMatch(/7 PM Eastern/)
    expect(t.db.calls).toHaveLength(0)
    expect(notifyArtist).not.toHaveBeenCalled()
    // In summer the 23:00 UTC tick is the one that lands on 7 PM.
    expect((await tick({ probe: { ...PROBE_OK, ran_at: '2026-07-15T13:00:00Z' } }).run(Date.parse('2026-07-15T23:00:00Z'))).sent).toBe(true)
  })

  test('a digest already logged as sent today is not sent twice, unless forced', async () => {
    expect((await tick({ alreadySent: true }).run()).skipped).toBe('already sent today')
    expect(notifyArtist).not.toHaveBeenCalled()
    expect((await tick({ alreadySent: true }).run(NOW, true)).sent).toBe(true)
  })

  test('with no probe result today Lacey is told and so is Erica', async () => {
    const r = await tick({ probe: null }).run()
    expect(r.probe).toBe('none')
    expect(notifyArtist.mock.calls[0][0].text).toContain('No system check ran today')
    expect(alertOperator).toHaveBeenCalledTimes(1)
    expect(alertOperator.mock.calls[0][0].subject).toBe('No probe result today')
  })

  test('the counts come from the day’s leads, minus the probe, and a hold email that really went today is folded in', async () => {
    const leads = [lead(), lead({ id: 'p', client_brief: '{"found_via":"test-probe"}' }), lead({ id: 'old', created_at: ago(26 * H) })]
    const t = tick({ leads, probe: { ...PROBE_OK, ok: false }, sentNudges: [{ match_id: 'old', created_at: '2026-11-10T16:00:00Z' }] })
    const r = await t.run()
    expect(r).toMatchObject({ sent: true, newToday: 1, unanswered: 1, probe: 'failed' })
    const text = notifyArtist.mock.calls[0][0].text as string
    expect(text).toContain('Today: 1 new inquiry (Ana). 1 has waited on you over 24 hours.')
    expect(text).toContain('you were emailed at 11:00 AM')

    // "Emailed" is read from the delivery log: sent Hold A1/A2 rows for the waiting leads, today.
    const q = t.db.calls.find((c) => c.table === 'artist_notifications' && has(c, 'kind in'))!
    expect(q.filters).toEqual(expect.arrayContaining([['match_id in', ['m1', 'old']], ['kind in', ['Hold A1', 'Hold A2']], ['status', 'sent'], ['created_at>=', '2026-11-10T05:00:00.000Z']]))
    // The mailbox mark travels with the thread, as it does for the hold timers.
    expect(t.db.calls.some((c) => c.table === 'match_messages')).toBe(true)
  })

  test('a hold recorded in the digest hour sent her nothing, so the digest does not claim she was emailed', async () => {
    // What the 7 PM holds tick leaves behind: the hold_events row is written, her email is not sent.
    const t = tick({
      leads: [lead({ id: 'old', client_name: 'Priya', created_at: ago(26 * H) })],
      holdEvents: [{ match_id: 'old', hold: 'A1', sent_at: new Date(NOW).toISOString() }],
      sentNudges: [],
    })
    await t.run()
    const text = notifyArtist.mock.calls[0][0].text as string
    expect(text).toContain('• Priya · small watercolor fern · waiting 26 hours')
    expect(text).not.toContain('you were emailed')
    // hold_events is not what the digest reads for this.
    expect(t.db.calls.some((c) => c.table === 'hold_events')).toBe(false)
  })

  test('a lead whose last word is in her mailbox is not listed, end to end', async () => {
    const t = tick({
      leads: [lead({ id: 'f', client_name: 'Devon', created_at: ago(30 * H) })],
      messages: [{ match_id: 'f', sender: 'client', body: 'Hi', created_at: ago(30 * H), meta: { mailbox: 'forwarded' } }],
    })
    const r = await t.run()
    expect(r.unanswered).toBe(0)
    expect(notifyArtist.mock.calls[0][0].text).toContain('Nothing is waiting on you.')
  })
})
