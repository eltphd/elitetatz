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

import { dueHolds, runHolds, sendingHours, dayWord, clientNotesOn, copyFor, oneLine, type HoldMatch, type HoldMessage, type HoldNote } from '@/lib/holds'

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

function tick(matches: HoldMatch[], messages: HoldMessage[] = [], events: { match_id: string; hold: string }[] = [], onInsert?: (c: Call) => { error?: unknown } | undefined, notes: HoldNote[] = []) {
  const db = fakeDb((c: Call) => {
    if (c.table === 'matches') return { data: matches }
    if (c.table === 'match_messages' && c.op === 'select') return { data: messages }
    if (c.table === 'hold_events' && c.op === 'select') return { data: events }
    if (c.table === 'lead_notes' && c.op === 'select') return { data: notes }
    if (c.op === 'insert' && onInsert) return onInsert(c)
    return { data: null }
  })
  return { db, run: () => runHolds(db.db, 'artist-1', NOW) }
}

beforeEach(() => {
  notifyArtist.mockClear(); notifyClient.mockClear(); chatwoot.mockClear(); slack.mockClear()
  delete process.env.HOLD_CLIENT_NOTES
})
afterAll(() => { delete process.env.HOLD_CLIENT_NOTES })

describe('dueHolds', () => {
  test('her nudge (A1) opens at 24 h and A2 takes over at 72 h; there is no hold for the client’s side of a wait on her', () => {
    const holds = (hours: number) => dueHolds([lead({ created_at: ago(hours * H) })], [], NOW).map((d) => d.hold)
    expect(holds(20)).toEqual([])
    expect(holds(23)).toEqual([])
    expect(holds(24)).toEqual(['A1'])
    // 36 h used to open "still with Lacey" to the client (A1C). It is gone.
    expect(holds(36)).toEqual(['A1'])
    expect(holds(71)).toEqual(['A1'])
    expect(holds(72)).toEqual(['A2'])
    expect(holds(80)).toEqual(['A2'])
    // A client reply newer than Lacey's last message restarts the clock.
    const m = lead({ status: 'info_requested', created_at: ago(10 * D), artist_responded_at: ago(5 * D) })
    expect(dueHolds([m], [msg('artist', 5 * D, 'How big?'), msg('client', 26 * H, 'About a palm')], NOW).map((d) => d.hold)).toEqual(['A1'])
  })

  test('the daily probe’s inquiry is never a hold', () => {
    const probe = lead({ created_at: ago(30 * H), client_brief: JSON.stringify({ found_via: 'test-probe', concept: 'Daily system check' }) })
    expect(dueHolds([probe], [], NOW)).toHaveLength(0)
    expect(dueHolds([lead({ created_at: ago(30 * H), client_brief: JSON.stringify({ found_via: 'instagram' }) })], [], NOW)).toHaveLength(1)
  })

  test('A counts from the client’s last message when they wrote after Lacey', () => {
    const m = lead({ status: 'info_requested', created_at: ago(10 * D), artist_responded_at: ago(5 * D) })
    const thread = [msg('artist', 5 * D, 'How big?'), msg('client', 40 * H, 'About a palm')]
    const due = dueHolds([m], thread, NOW)
    expect(due.map((d) => d.hold)).toEqual(['A1'])
    expect(due[0].since).toBe(ago(40 * H))
  })

  test('a lead she noted as handled somewhere else is not timed: no nudge to her, nothing to the client', () => {
    const note = (msBack: number, match_id = 'match-1'): HoldNote => ({ match_id, created_at: ago(msBack) })
    // New web inquiry 40 h ago; she texted them and wrote "Deposit request sent" 20 h ago.
    expect(dueHolds([lead()], [msg('client', 40 * H)], NOW, [note(20 * H)])).toHaveLength(0)
    // Three days on, still nothing: the Nov 13 "books are full" case.
    expect(dueHolds([lead({ created_at: ago(80 * H) })], [msg('client', 80 * H)], NOW, [note(60 * H)])).toHaveLength(0)
    // Another lead's note does not cover this one.
    expect(dueHolds([lead()], [msg('client', 40 * H)], NOW, [note(20 * H, 'other')]).map((d) => d.hold)).toEqual(['A1'])
    // The client writes again where the portal sees it: the note is older than
    // the last word, so the clock starts from their new message.
    const again = dueHolds([lead({ created_at: ago(5 * D) })], [msg('client', 5 * D), msg('client', 30 * H, 'Any update?')], NOW, [note(4 * D)])
    expect(again.map((d) => d.hold)).toEqual(['A1'])
    expect(again[0].since).toBe(ago(30 * H))
    // A note does not stop the holds that follow her own taps in the portal (a quote, a deposit).
    const quoted = lead({ status: 'accepted', created_at: ago(5 * D), artist_responded_at: ago(80 * H) })
    expect(dueHolds([quoted], [msg('artist', 80 * H, 'Accepted — quote $375.')], NOW, [note(70 * H)]).map((d) => d.hold)).toEqual(['C'])
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
  test('A1 is one email to Lacey with the client as reply-to, so answering it is the reply; it carries the "already handled" link', async () => {
    const t = tick([lead({ created_at: ago(26 * H) })])
    const r = await t.run()
    expect(r.sent).toEqual([{ match_id: 'match-1', hold: 'A1' }])
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice).toMatchObject({ kind: 'Hold A1', matchId: 'match-1', replyTo: 'j@example.com' })
    expect(notice.subject).toBe('Waiting a day: a small moth')
    expect(notice.text).toContain('Reply to this email and it goes straight to Jordan (j@example.com)')
    expect(notice.text).toContain('Nothing has been sent to Jordan about the wait, and nothing will be.')
    expect(notice.text).toMatch(/Already answered Jordan another way[^\n]*\nhttps:\/\/[^\s]+\/handled\/match-1\?t=/)
    // The client hears nothing: no thread line, no email, no DM.
    expect(writes(t.db.calls, 'hold_events', 'insert').map((c) => c.payload)).toEqual([{ match_id: 'match-1', hold: 'A1' }])
    expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()
    expect(chatwoot).not.toHaveBeenCalled()
    expect(slack).not.toHaveBeenCalled()
  })

  test('at 36 h nothing goes to the client: "still with Lacey" no longer exists', async () => {
    // Her nudge went yesterday. Today there is nothing left to send to anyone.
    const t = tick([lead()], [], [{ match_id: 'match-1', hold: 'A1' }])
    const r = await t.run()
    expect(r.sent).toEqual([])
    expect(writes(t.db.calls, 'hold_events', 'insert')).toHaveLength(0)
    expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()
    expect(notifyArtist).not.toHaveBeenCalled()
  })

  test('no wait on Lacey ever writes to the client, at any age, even with every client note switched on', async () => {
    process.env.HOLD_CLIENT_NOTES = 'A1,A1C,A2,B,C,D,E'
    for (const hours of [24, 30, 36, 48, 71, 72, 80, 120, 200]) {
      notifyClient.mockClear(); chatwoot.mockClear()
      const t = tick([lead({ created_at: ago(hours * H), external_thread_id: 'chatwoot:31' })])
      await t.run()
      expect(notifyClient).not.toHaveBeenCalled()
      expect(chatwoot).not.toHaveBeenCalled()
      expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    }
  })

  test('a lead she noted as handled gets no reminder and the client gets nothing, end to end', async () => {
    const t = tick([lead({ created_at: ago(80 * H) })], [msg('client', 80 * H)], [], undefined, [{ match_id: 'match-1', created_at: ago(60 * H) }])
    const r = await t.run()
    expect(r.due).toBe(0)
    expect(notifyArtist).not.toHaveBeenCalled()
    expect(notifyClient).not.toHaveBeenCalled()
    expect(slack).not.toHaveBeenCalled()
    // Only her own notes are read for this.
    const read = t.db.calls.find((c) => c.table === 'lead_notes' && c.op === 'select') as Call
    expect(read.filters).toEqual(expect.arrayContaining([['author', 'artist']]))
  })

  test('in the 7 PM digest hour the A holds write their record but Lacey gets nothing: the digest is her one email. No client is written to', async () => {
    const sevenPm = Date.parse('2026-11-11T00:00:00Z') // 7 PM EST
    const late = (msBack: number) => new Date(sevenPm - msBack).toISOString()
    const a1 = lead({ id: 'a1', created_at: late(40 * H), updated_at: late(40 * H) })
    const a2 = lead({ id: 'a2', created_at: late(80 * H), updated_at: late(80 * H) })
    const e = lead({ id: 'e', status: 'paid', created_at: late(5 * D), booked_at: late(4 * D), date_request: 'Dec 12', updated_at: late(50 * H) })
    const db = fakeDb((c: Call) => {
      if (c.table === 'matches') return { data: [a1, a2, e] }
      if (c.table === 'match_messages' && c.op === 'select') return { data: [msg('client', 50 * H, 'Date request: Dec 12', 'e')] }
      if (c.table === 'hold_events' && c.op === 'select') return { data: [] }
      return { data: null }
    })
    const r = await runHolds(db.db, 'artist-1', sevenPm)
    expect(r.sent.map((s) => s.hold).sort()).toEqual(['A1', 'A2', 'E'])
    expect(writes(db.calls, 'hold_events', 'insert')).toHaveLength(3)
    expect(notifyClient).not.toHaveBeenCalled()
    // Only E, which the digest does not cover, reaches her now.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].kind).toBe('Hold E')
    expect(notifyArtist.mock.calls[0][0].text).toContain('Nothing has been sent to them about the wait.')
    expect(slack).toHaveBeenCalledTimes(1) // A2's YOUR MOVE is for Erica, not Lacey
  })

  test('a lead first seen past 36 h gets one email to her and that is all: no thread line, no client note, no Slack', async () => {
    const t = tick([lead()])
    const r = await t.run()
    expect(r.sent).toEqual([{ match_id: 'match-1', hold: 'A1' }])
    expect(writes(t.db.calls, 'hold_events', 'insert').map((c) => c.payload)).toEqual([{ match_id: 'match-1', hold: 'A1' }])
    expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].text).toContain('/dashboard')
    expect(notifyArtist.mock.calls[0][0].text).not.toMatch(/being told|still with you/)
    expect(slack).not.toHaveBeenCalled()
  })

  test('A2 is her last reminder and a YOUR MOVE line for Erica; the client’s DM thread is not touched', async () => {
    const t = tick([lead({ created_at: ago(80 * H), external_thread_id: 'chatwoot:31', client_email: null })])
    const r = await t.run()
    expect(r.sent.map((s) => s.hold)).toEqual(['A2'])
    expect(slack).toHaveBeenCalledTimes(1)
    expect(slack.mock.calls[0][0]).toMatch(/YOUR MOVE/)
    expect(slack.mock.calls[0][0]).toContain('Nothing was sent to the client')
    expect(slack.mock.calls[0][0]).not.toContain('Jordan')
    expect(chatwoot).not.toHaveBeenCalled()
    expect(notifyClient).not.toHaveBeenCalled()
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.subject).toBe('Waiting 3 days: a small moth')
    expect(notice.text).toContain('Nothing has been sent to Jordan about the wait.')
    expect(notice.text).not.toMatch(/was told|books are full/)
    expect(notice.text).toContain('/handled/match-1?t=')
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

  test('the other timed client notes (B, C, D, E) are off unless HOLD_CLIENT_NOTES names them', async () => {
    const c = lead({ id: 'c', status: 'accepted', created_at: ago(5 * D), artist_responded_at: ago(80 * H) })
    const d = lead({ id: 'd', status: 'paid', created_at: ago(5 * D), booked_at: ago(80 * H) })
    const e = lead({ id: 'e', status: 'paid', created_at: ago(5 * D), booked_at: ago(4 * D), date_request: 'Dec 12', updated_at: ago(50 * H) })
    const b = lead({ id: 'b', status: 'info_requested', created_at: ago(10 * D), artist_responded_at: ago(80 * H) })
    const thread = [msg('artist', 80 * H, 'Accepted', 'c'), msg('artist', 80 * H, 'How big?', 'b')]
    const t = tick([c, d, e, b], thread)
    const r = await t.run()
    // By default no client is written to. E still nudges Lacey; B, C and D
    // have nothing to send, so they leave no record and stay unsent.
    expect(notifyClient).not.toHaveBeenCalled()
    expect(writes(t.db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(r.sent).toEqual([{ match_id: 'e', hold: 'E' }])
    expect(writes(t.db.calls, 'hold_events', 'insert').map((x) => x.payload)).toEqual([{ match_id: 'e', hold: 'E' }])
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].text).not.toContain('was told')

    expect([...clientNotesOn(undefined)]).toEqual([])
    expect([...clientNotesOn('c, D ,x,A2,A1C')].sort()).toEqual(['C', 'D'])
  })

  test('switched on, C carries the deposit link; D and E carry the inquiry link', async () => {
    process.env.HOLD_CLIENT_NOTES = 'C,D,E'
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
    // Only E nudges Lacey, and now it can say the client was told.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].text).toContain('The client was told')
  })

  test('a concept with line breaks becomes one short line in a subject', () => {
    const long = 'My friend and I would both like to get meaningful tattoos done.\nMine: 4 intertwined flowers - forget me not, hibiscus, lily of the valley'
    const copy = copyFor({ hold: 'A1', match: lead({ ai_summary: long }), since: ago(26 * H) }, NOW)
    expect(copy.artist?.subject).not.toMatch(/[\r\n]/)
    expect(copy.artist?.subject.length).toBeLessThanOrEqual('Waiting a day: '.length + 80)
    expect(oneLine('  a\n b\t c  ')).toBe('a b c')
    expect(oneLine(null)).toBe('')
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
