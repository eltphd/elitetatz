/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

const notifyArtist = jest.fn().mockResolvedValue(undefined)
const notifyClient = jest.fn().mockResolvedValue(undefined)
const chatwoot = jest.fn().mockResolvedValue(true)
const slack = jest.fn().mockResolvedValue(true)
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notifyArtist(...a), notifyClient: (...a: unknown[]) => notifyClient(...a) }))
jest.mock('@/lib/inbound/chatwoot', () => ({ chatwootReply: (...a: unknown[]) => chatwoot(...a) }))
jest.mock('@/lib/slack', () => ({ postFollowup: (...a: unknown[]) => slack(...a) }))

import { dueHolds, runHolds, sendingHours, dayWord, type HoldMatch, type HoldMessage } from '@/lib/holds'

const H = 3_600_000
const D = 24 * H
// Tuesday 2026-11-10, 3 PM Eastern (EST = UTC-5).
const NOW = Date.parse('2026-11-10T20:00:00Z')
const ago = (msBack: number) => new Date(NOW - msBack).toISOString()

function lead(over: Partial<HoldMatch> = {}): HoldMatch {
  return {
    id: 'match-1', status: 'pending', channel: 'web', client_name: 'Jordan', client_email: 'j@example.com', client_phone: null,
    external_thread_id: null, ai_summary: 'a small moth', created_at: ago(40 * H), updated_at: ago(40 * H),
    artist_responded_at: null, booked_at: null, appointment_at: null, date_request: null, proposed_dates: null, ...over,
  }
}
const msg = (sender: HoldMessage['sender'], msBack: number, body = 'hi', match_id = 'match-1'): HoldMessage => ({ match_id, sender, body, created_at: ago(msBack) })

function tick(matches: HoldMatch[], messages: HoldMessage[] = [], events: { match_id: string; hold: string }[] = [], onInsert?: (c: Call) => { error?: unknown } | undefined) {
  const db = fakeDb((c: Call) => {
    if (c.table === 'matches') return { data: matches }
    if (c.table === 'match_messages' && c.op === 'select') return { data: messages }
    if (c.table === 'hold_events' && c.op === 'select') return { data: events }
    if (c.op === 'insert' && onInsert) return onInsert(c)
    return { data: null }
  })
  return { db, run: () => runHolds(db.db, 'artist-1', NOW) }
}

beforeEach(() => {
  notifyArtist.mockClear(); notifyClient.mockClear(); chatwoot.mockClear(); slack.mockClear()
})

describe('dueHolds', () => {
  test('A1 at 36 h for a new lead nobody has touched; A2 takes over at 72 h', () => {
    expect(dueHolds([lead()], [], NOW).map((d) => d.hold)).toEqual(['A1'])
    expect(dueHolds([lead({ created_at: ago(80 * H) })], [], NOW).map((d) => d.hold)).toEqual(['A2'])
    expect(dueHolds([lead({ created_at: ago(20 * H) })], [], NOW)).toHaveLength(0)
  })

  test('A counts from the client’s last message when they wrote after Lacey', () => {
    const m = lead({ status: 'info_requested', created_at: ago(10 * D), artist_responded_at: ago(5 * D) })
    const thread = [msg('artist', 5 * D, 'How big?'), msg('client', 40 * H, 'About a palm')]
    const due = dueHolds([m], thread, NOW)
    expect(due.map((d) => d.hold)).toEqual(['A1'])
    expect(due[0].since).toBe(ago(40 * H))
  })

  test('B when Lacey asked and the client is silent 72 h; B14 at 14 days; never both', () => {
    const m = lead({ status: 'info_requested', created_at: ago(10 * D), artist_responded_at: ago(80 * H) })
    expect(dueHolds([m], [msg('artist', 80 * H, 'How big?')], NOW).map((d) => d.hold)).toEqual(['B'])
    const old = lead({ status: 'info_requested', created_at: ago(30 * D), artist_responded_at: ago(15 * D) })
    expect(dueHolds([old], [msg('artist', 15 * D, 'How big?')], NOW).map((d) => d.hold)).toEqual(['B14'])
  })

  test('C when quoted with no deposit for 72 h; C14 at 14 days', () => {
    const m = lead({ status: 'accepted', created_at: ago(5 * D), artist_responded_at: ago(80 * H) })
    expect(dueHolds([m], [msg('artist', 80 * H, 'Accepted — quote $375.')], NOW).map((d) => d.hold)).toEqual(['C'])
    const old = lead({ status: 'accepted', created_at: ago(20 * D), artist_responded_at: ago(15 * D) })
    expect(dueHolds([old], [msg('artist', 15 * D, 'Accepted')], NOW).map((d) => d.hold)).toEqual(['C14'])
  })

  test('D when the deposit is in and no date was named for 72 h', () => {
    const m = lead({ status: 'paid', created_at: ago(5 * D), artist_responded_at: ago(80 * H), booked_at: ago(80 * H) })
    expect(dueHolds([m], [], NOW).map((d) => d.hold)).toEqual(['D'])
    expect(dueHolds([lead({ ...m, booked_at: ago(10 * H) })], [], NOW)).toHaveLength(0)
  })

  test('E when a date was asked for and not confirmed in 48 h', () => {
    const m = lead({ status: 'paid', created_at: ago(5 * D), booked_at: ago(4 * D), date_request: 'Dec 12 afternoon', updated_at: ago(50 * H) })
    const due = dueHolds([m], [msg('client', 50 * H, 'Date request: Dec 12 afternoon')], NOW)
    expect(due.map((d) => d.hold)).toEqual(['E'])
    expect(dueHolds([lead({ ...m, appointment_at: ago(H) })], [], NOW)).toHaveLength(0)
  })

  test('a hold whose window closed long ago is history, not a hold', () => {
    // A pending lead from a month ago: A2 opened at 72 h and the grace week is gone.
    expect(dueHolds([lead({ created_at: ago(30 * D) })], [], NOW)).toHaveLength(0)
  })

  test('closed leads are never touched', () => {
    for (const status of ['rejected', 'completed', 'cancelled']) expect(dueHolds([lead({ status })], [], NOW)).toHaveLength(0)
  })
})

describe('runHolds', () => {
  test('A1: records the hold, writes the thread line, tells the client and Lacey, no Slack', async () => {
    const t = tick([lead()])
    const r = await t.run()
    expect(r.sent).toEqual([{ match_id: 'match-1', hold: 'A1' }])
    expect(writes(t.db.calls, 'hold_events', 'insert')[0].payload).toEqual({ match_id: 'match-1', hold: 'A1' })
    const line = writes(t.db.calls, 'match_messages', 'insert')[0].payload as Record<string, unknown>
    expect(line).toMatchObject({ match_id: 'match-1', sender: 'system', channel: 'system' })
    expect(String(line.body)).toContain('still with Lacey')
    expect(notifyClient).toHaveBeenCalledTimes(1)
    expect(notifyClient.mock.calls[0][0].text).toContain('/inquiry/match-1?t=')
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].text).toContain('/dashboard')
    expect(slack).not.toHaveBeenCalled()
  })

  test('A2 posts YOUR MOVE to Slack and replies in the DM thread when there is one', async () => {
    const t = tick([lead({ created_at: ago(80 * H), external_thread_id: 'chatwoot:31', client_email: null })])
    const r = await t.run()
    expect(r.sent.map((s) => s.hold)).toEqual(['A2'])
    expect(slack).toHaveBeenCalledTimes(1)
    expect(slack.mock.calls[0][0]).toMatch(/YOUR MOVE/)
    expect(slack.mock.calls[0][0]).not.toContain('Jordan')
    expect(chatwoot).toHaveBeenCalledWith('chatwoot:31', expect.stringContaining('books are full'))
  })

  test('B14 and C14 go to Lacey only, as a private note, never to the client thread', async () => {
    const m = lead({ status: 'accepted', created_at: ago(20 * D), artist_responded_at: ago(15 * D) })
    const t = tick([m], [msg('artist', 15 * D, 'Accepted')])
    const r = await t.run()
    expect(r.sent.map((s) => s.hold)).toEqual(['C14'])
    expect(notifyClient).not.toHaveBeenCalled()
    expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(writes(t.db.calls, 'lead_notes', 'insert')[0].payload).toMatchObject({ author: 'assistant', kind: 'note' })
    expect(notifyArtist.mock.calls[0][0].subject).toMatch(/expired/i)
  })

  test('C carries the deposit link; D and E carry the inquiry link', async () => {
    const c = lead({ id: 'c', status: 'accepted', created_at: ago(5 * D), artist_responded_at: ago(80 * H) })
    const d = lead({ id: 'd', status: 'paid', created_at: ago(5 * D), booked_at: ago(80 * H) })
    const e = lead({ id: 'e', status: 'paid', created_at: ago(5 * D), booked_at: ago(4 * D), date_request: 'Dec 12', updated_at: ago(50 * H) })
    const t = tick([c, d, e], [msg('artist', 80 * H, 'Accepted', 'c')])
    const r = await t.run()
    expect(r.sent.map((s) => s.hold).sort()).toEqual(['C', 'D', 'E'])
    const texts = notifyClient.mock.calls.map((a) => a[0].text as string)
    expect(texts.find((x) => x.includes('good for 14 days'))).toContain('checkout.square.site')
    expect(texts.find((x) => x.includes('spot'))).toContain('/inquiry/d?t=')
    expect(texts.find((x) => x.includes('date request'))).toContain('/inquiry/e?t=')
    // Only E nudges Lacey.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
  })

  test('a second tick sends nothing: the recorded hold filters it, and a duplicate key stops it', async () => {
    const recorded = tick([lead()], [], [{ match_id: 'match-1', hold: 'A1' }])
    expect((await recorded.run()).sent).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()

    const raced = tick([lead()], [], [], (c) => (c.table === 'hold_events' ? { error: { code: '23505' } } : undefined))
    expect((await raced.run()).sent).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()
    expect(notifyArtist).not.toHaveBeenCalled()
  })

  test('outside 9 AM–8 PM Eastern nothing is read and nothing is sent', async () => {
    const db = fakeDb(() => ({ data: [lead()] }))
    const r = await runHolds(db.db, 'artist-1', Date.parse('2026-11-11T07:30:00Z')) // 2:30 AM Eastern
    expect(r.skipped).toMatch(/Eastern/)
    expect(db.calls).toHaveLength(0)
    expect(sendingHours(Date.parse('2026-11-11T14:00:00Z'))).toBe(true) // 9 AM
    expect(sendingHours(Date.parse('2026-11-12T01:00:00Z'))).toBe(false) // 8 PM
  })

  test('dayWord names the weekday, with a date when it is more than six days out', () => {
    expect(dayWord(NOW + 3 * D, NOW)).toBe('Friday')
    expect(dayWord(NOW + 8 * D, NOW)).toBe('Wednesday, Nov 18')
  })
})
