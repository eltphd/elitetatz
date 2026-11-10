/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// The gap this closes: Lacey answers a client from her mail app, the portal
// never hears, and a day later it nudges her about someone she already wrote
// back to and tells that client "still with Lacey". Her reply is now copied
// to the intake address, recorded as her answer, and the timers stop. Where
// the portal cannot see the conversation at all, it does not time it.

const notifyArtist = jest.fn().mockResolvedValue({ emailed: true, logId: null })
const notifyClient = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notifyArtist(...a), notifyClient: (...a: unknown[]) => notifyClient(...a) }))
jest.mock('@/lib/attachments', () => ({ fetchBytes: jest.fn(), storeAttachment: jest.fn() }))
jest.mock('@/lib/inbound/chatwoot', () => ({ chatwootReply: jest.fn() }))
jest.mock('@/lib/slack', () => ({ postFollowup: jest.fn() }))
const findOpenLead = jest.fn()
jest.mock('@/lib/channels', () => ({
  CHANNEL_LABEL: { email: 'Email' },
  artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }),
  findOpenLead: (...a: unknown[]) => findOpenLead(...a),
  openLead: jest.fn(),
  appendClientMessage: jest.fn(),
}))

import { readArtistReply, normalizeEmail, type ReceivedEmail } from '@/lib/inbound/email'
import { recordArtistReply } from '@/lib/inbound/ingest'
import { dueHolds, type HoldMatch, type HoldMessage } from '@/lib/holds'

const mail = (over: Partial<ReceivedEmail>): ReceivedEmail => ({
  id: 'r1', from: 'Lacey Rawson <lacey@rawsunart.com>', to: ['devon@example.com', 'inbox@rawsunart.com'],
  subject: 'Re: Inquiry: fine-line moth (sternum)', text: 'Hi Devon, yes I can do this. Are weekdays ok?\n\nOn Mon, Nov 9, 2026 at 9:14 AM RawSunArt <club@rawsunart.com> wrote:\n> New inquiry from the rawsunart.com form.', html: null, ...over,
})

beforeEach(() => {
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  process.env.ARTIST_NOTIFICATION_CC = 'ops@example.com'
  process.env.INBOUND_EMAIL_ADDRESS = 'inbox@rawsunart.com'
  notifyArtist.mockClear(); notifyClient.mockClear()
  findOpenLead.mockReset().mockResolvedValue({ id: 'match-1', status: 'pending', channel: 'web', client_name: 'Devon', client_email: 'devon@example.com', client_phone: null, external_thread_id: null, ai_summary: 'moth' })
})

describe('readArtistReply', () => {
  it('her reply to a client, copied to the intake address', () => {
    const r = readArtistReply(mail({}))
    expect(r).toMatchObject({ externalId: 'resend:r1', clients: ['devon@example.com'], verified: false })
    expect(r?.text).toBe('Hi Devon, yes I can do this. Are weekdays ok?')
  })
  it('reads recipients from the To and Cc headers too, and leaves out our own addresses', () => {
    const r = readArtistReply(mail({ to: ['inbox@rawsunart.com'], headers: { To: 'Devon <devon@example.com>', Cc: 'ops@example.com, club@rawsunart.com' } }))
    expect(r?.clients).toEqual(['devon@example.com'])
  })
  it('a forward addressed to us alone is not a reply', () => {
    expect(readArtistReply(mail({ to: ['inbox@rawsunart.com'], text: '---------- Forwarded message ---------\nFrom: Devon <devon@example.com>\nSubject: moth\n\nHi' }))).toBeNull()
  })
  it('an Outlook-style reply ("Original Message") to a client is a reply, not a forward from that client', () => {
    const outlook = 'Yes, Friday works.\n\n-----Original Message-----\nFrom: Devon <devon@example.com>\nSent: Monday\nTo: lacey@rawsunart.com\nSubject: moth\n\nCan you do Friday?'
    expect(readArtistReply(mail({ text: outlook }))?.clients).toEqual(['devon@example.com'])
    // …and it never reaches the forward path, which would have filed her words as the client's.
    expect(normalizeEmail(mail({ to: ['inbox@rawsunart.com'], text: outlook }), [])).not.toEqual({ ignored: 'own-address' })
  })
  it('mail from anyone else is not her reply', () => {
    expect(readArtistReply(mail({ from: 'Devon <devon@example.com>', to: ['lacey@rawsunart.com', 'inbox@rawsunart.com'] }))).toBeNull()
    expect(readArtistReply(mail({ from: 'Ops <ops@example.com>' }))).toBeNull()
  })
  it('is verified only when the receiving server vouched for the sender', () => {
    expect(readArtistReply(mail({ headers: { 'Authentication-Results': 'mx.resend.com; dkim=pass header.d=rawsunart.com; spf=pass; dmarc=pass header.from=rawsunart.com' } }))?.verified).toBe(true)
    expect(readArtistReply(mail({ headers: { 'Authentication-Results': 'mx; dkim=pass header.d=rawsunart.com' } }))?.verified).toBe(true)
    expect(readArtistReply(mail({ headers: { 'Authentication-Results': 'mx; dkim=pass header.d=evil.example; dmarc=fail' } }))?.verified).toBe(false)
    expect(readArtistReply(mail({ headers: { 'Authentication-Results': 'mx; dmarc=fail' } }))?.verified).toBe(false)
  })
})

describe('recordArtistReply', () => {
  const run = async (over: Partial<Parameters<typeof recordArtistReply>[1]> = {}, respond?: (c: Call) => { data?: unknown; error?: unknown } | undefined) => {
    const db = fakeDb((c: Call) => respond?.(c) ?? (c.table === 'inbound_events' && c.op === 'insert' ? { data: { id: 1 } } : undefined))
    const out = await recordArtistReply(db.db, { externalId: 'resend:r1', clients: ['devon@example.com'], text: 'Hi Devon, yes I can do this.', subject: 'Re: moth', verified: true, ...over })
    return { out, db }
  }

  it('goes on the lead as her message, counts as her answer, and sends nothing to anyone', async () => {
    const { out, db } = await run()
    expect(out).toEqual({ outcome: 'artist_reply', matchId: 'match-1' })
    const [m] = writes(db.calls, 'match_messages', 'insert')
    expect(m.payload).toMatchObject({ match_id: 'match-1', sender: 'artist', body: 'Hi Devon, yes I can do this.', channel: 'email', external_id: 'resend:r1', meta: { mailbox: 'reply', verified: true } })
    const [u] = writes(db.calls, 'matches', 'update')
    expect(u.payload).toHaveProperty('artist_responded_at')
    expect(u.filters).toContainEqual(['id', 'match-1'])
    expect(notifyArtist).not.toHaveBeenCalled()
    expect(notifyClient).not.toHaveBeenCalled()
  })
  it('an unverified sender still stops the timers, but her words are not put in the client-visible thread', async () => {
    const { out, db } = await run({ verified: false, text: 'something typed by whoever sent this' })
    expect(out.outcome).toBe('artist_reply')
    expect((writes(db.calls, 'match_messages', 'insert')[0].payload as { body: string }).body).toBe('Replied by email.')
  })
  it('a reply to someone the portal does not know is left alone: no lead is opened from her mail', async () => {
    findOpenLead.mockResolvedValue(null)
    const { out, db } = await run()
    expect(out).toEqual({ outcome: 'ignored', reason: 'artist-reply-no-lead' })
    expect(writes(db.calls, 'match_messages', 'insert')).toHaveLength(0)
    expect(writes(db.calls, 'matches', 'insert')).toHaveLength(0)
  })
  it('the same delivery twice is recorded once', async () => {
    const { out, db } = await run({}, (c) => (c.table === 'inbound_events' && c.op === 'insert' ? { error: { code: '23505' } } : undefined))
    expect(out).toEqual({ outcome: 'duplicate' })
    expect(writes(db.calls, 'match_messages', 'insert')).toHaveLength(0)
  })
})

describe('hold timers and her mailbox', () => {
  const H = 3_600_000
  const NOW = Date.parse('2026-11-10T20:00:00Z') // 3 PM Eastern
  const ago = (h: number) => new Date(NOW - h * H).toISOString()
  const lead = (over: Partial<HoldMatch> = {}): HoldMatch => ({
    id: 'match-1', status: 'pending', channel: 'web', client_name: 'Devon', client_email: 'devon@example.com', client_phone: null,
    external_thread_id: null, ai_summary: 'a small moth', created_at: ago(80), updated_at: ago(80),
    artist_responded_at: null, booked_at: null, appointment_at: null, date_request: null, proposed_dates: null, ...over,
  })
  const m = (sender: HoldMessage['sender'], hoursAgo: number, meta?: Record<string, unknown>): HoldMessage => ({ match_id: 'match-1', sender, body: 'x', created_at: ago(hoursAgo), meta: meta ?? null })
  const holds = (matches: HoldMatch[], messages: HoldMessage[]) => dueHolds(matches, messages, NOW).map((d) => d.hold)

  it('baseline: a form inquiry she has not touched in 80 hours is escalated', () => {
    expect(holds([lead()], [])).toEqual(['A2'])
  })
  it('she answered from her mail app: no nudge to her, no "still with Lacey" to the client', () => {
    expect(holds([lead({ artist_responded_at: ago(78) })], [m('artist', 78, { mailbox: 'reply' })])).toEqual([])
  })
  it('…and the client is not chased for an answer they may have sent straight to her', () => {
    // 76 hours of portal silence after her email reply would have been hold B.
    expect(holds([lead({ artist_responded_at: ago(76) })], [m('artist', 76, { mailbox: 'reply' })])).toEqual([])
  })
  it('a lead she forwarded from her own mailbox is never timed: she may have answered there', () => {
    expect(holds([lead({ channel: 'email' })], [m('client', 80, { mailbox: 'forwarded' })])).toEqual([])
    expect(holds([lead({ channel: 'email', created_at: ago(40) })], [m('client', 40, { mailbox: 'delivered' })])).toEqual([])
  })
  it('the timers pick up again when the client writes where the portal can see', () => {
    const thread = [m('artist', 78, { mailbox: 'reply' }), m('client', 40)]
    expect(holds([lead({ artist_responded_at: ago(78) })], thread)).toEqual(['A1'])
  })
  it('her taps in the portal stay timed: a quote with no deposit still gets hold C', () => {
    const accepted = lead({ status: 'accepted', artist_responded_at: ago(80) })
    expect(holds([accepted], [m('client', 100, { mailbox: 'forwarded' }), m('artist', 80)])).toEqual(['C'])
  })
})
