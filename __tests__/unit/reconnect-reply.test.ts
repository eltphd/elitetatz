/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// F3 of the Nov 19 2026 dev file. The Reconnect email asks people for a healed
// photo and their story, by text or by reply. Its Reply-To is her address
// first and the portal's intake beside it, so one reply does two things: it
// lands in her mailbox, untouched, and its copy opens a card with the photo.
// She must not then be emailed about a message she already holds.

const notifyArtist = jest.fn().mockResolvedValue({ emailed: false, skipped: true, logId: 'log-1' })
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notifyArtist(...a) }))
const fetchBytes = jest.fn()
const storeAttachment = jest.fn()
jest.mock('@/lib/attachments', () => ({ fetchBytes: (...a: unknown[]) => fetchBytes(...a), storeAttachment: (...a: unknown[]) => storeAttachment(...a) }))
const findOpenLead = jest.fn()
const openLead = jest.fn()
const appendClientMessage = jest.fn()
jest.mock('@/lib/channels', () => ({
  CHANNEL_LABEL: { email: 'Email', sms: 'Text', instagram: 'Instagram', facebook: 'Facebook Messenger' },
  artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }),
  findOpenLead: (...a: unknown[]) => findOpenLead(...a),
  openLead: (...a: unknown[]) => openLead(...a),
  appendClientMessage: (...a: unknown[]) => appendClientMessage(...a),
}))

import { normalizeEmail, type ReceivedEmail } from '@/lib/inbound/email'
import { ingest, campaignReply, replyConcept } from '@/lib/inbound/ingest'
import { dueHolds, type HoldMatch } from '@/lib/holds'

const SUBJECT = "it's Lacey. I'd love to see how yours healed."
const QUOTED = '\n\nOn Tue, Nov 24, 2026 at 9:04 AM Lacey Rawson <lacey@rawsunart.com> wrote:\n> Hey Maya,\n> It\'s Lacey, your tattoo artist.'

const reply = (over: Partial<ReceivedEmail> = {}): ReceivedEmail => ({
  id: 'em_reply_1',
  from: 'Maya Ortiz <maya@example.com>',
  // What a mail app does with a two-address Reply-To: both on the To line.
  to: ['lacey@rawsunart.com', 'studio@inbox.rawsunart.com'],
  subject: `Re: ${SUBJECT}`,
  text: `Here is my cardinal, three years on. It still makes me think of my grandmother every morning.${QUOTED}`,
  html: null,
  headers: {},
  ...over,
})
const PHOTO = [{ url: 'https://files.resend.test/healed.jpg', filename: 'healed.jpg', mime: 'image/jpeg' }]

const world = () =>
  fakeDb((c: Call) => {
    if (c.table === 'inbound_events' && c.op === 'insert') return { data: { id: 1 } }
    if (c.table === 'approvals') return { data: [{ key: 'rsa-reconnect-1', subject: SUBJECT }, { key: 'blog-1', subject: null }] }
    return undefined
  })

beforeEach(() => {
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  process.env.INBOUND_EMAIL_ADDRESS = 'studio@inbox.rawsunart.com'
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  delete process.env.INBOUND_IGNORE_SENDERS
  notifyArtist.mockClear()
  findOpenLead.mockReset().mockResolvedValue(null)
  openLead.mockReset().mockResolvedValue({ id: 'match-new' })
  appendClientMessage.mockReset().mockResolvedValue({ id: 'msg-1', duplicate: false })
  fetchBytes.mockReset().mockResolvedValue({ bytes: new Uint8Array(40_000).buffer, mime: 'image/jpeg' })
  storeAttachment.mockReset().mockResolvedValue({ id: 'att-1' })
})

describe('a reply to the Reconnect email, with a healed photo', () => {
  it('is read as the client’s message, already in her mailbox, with the quoted email cut off', () => {
    const n = normalizeEmail(reply(), PHOTO)
    if ('ignored' in n) throw new Error(`ignored: ${n.ignored}`)
    expect(n.email).toBe('maya@example.com')
    expect(n.senderName).toBe('Maya Ortiz')
    expect(n.artistHasIt).toBe('delivered')
    expect(n.text).toBe('Here is my cardinal, three years on. It still makes me think of my grandmother every morning.')
    expect(n.attachments).toHaveLength(1)
  })

  it('opens one card with the photo on it and sends her nothing: her one copy is the client’s own email', async () => {
    const n = normalizeEmail(reply(), PHOTO)
    if ('ignored' in n) throw new Error('ignored')
    const db = world()
    const out = await ingest(db.db, n)
    expect(out).toEqual({ outcome: 'opened', matchId: 'match-new', attachments: 1 })

    // The photo is kept on the lead, tied to the message it came with.
    expect(fetchBytes).toHaveBeenCalledWith('https://files.resend.test/healed.jpg', expect.anything())
    expect(storeAttachment).toHaveBeenCalledTimes(1)
    expect(storeAttachment.mock.calls[0][1]).toMatchObject({ matchId: 'match-new', messageId: 'msg-1', filename: 'healed.jpg', mime: 'image/jpeg', source: 'email' })

    // The card is named for what she wrote, not for Lacey's own subject line.
    const opened = openLead.mock.calls[0][2]
    expect(opened.concept).toBe('Here is my cardinal, three years on.')
    expect(opened).toMatchObject({ channel: 'email', name: 'Maya Ortiz', email: 'maya@example.com' })
    expect(opened.brief).toMatchObject({ has_reference: true, reply_to_campaign: 'rsa-reconnect-1' })

    // One email about one thing: she already has the client's reply, so nothing is sent.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].skip).toMatch(/already in her mailbox/)
    expect(notifyArtist.mock.calls[0][0].replyTo).toBe('maya@example.com')
    // The thread carries the mailbox mark, which is what keeps the timers off it.
    expect(appendClientMessage.mock.calls[0][2].meta).toMatchObject({ mailbox: 'delivered' })
    expect(writes(db.calls, 'inbound_events', 'update')[0].payload).toMatchObject({ match_id: 'match-new', outcome: 'opened' })
  })

  it('she is never reminded about it and the client is never written to: it lives in her mailbox', () => {
    const NOW = Date.parse('2026-11-30T17:00:00Z')
    const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
    const lead: HoldMatch = {
      id: 'match-new', status: 'pending', channel: 'email', client_name: 'Maya Ortiz', client_email: 'maya@example.com', client_phone: null,
      external_thread_id: null, ai_summary: 'Here is my cardinal, three years on.', created_at: ago(80), updated_at: ago(80),
      artist_responded_at: null, booked_at: null, appointment_at: null, date_request: null, proposed_dates: null,
    }
    for (const hours of [26, 40, 80, 150]) {
      const thread = [{ match_id: 'match-new', sender: 'client' as const, body: 'x', created_at: ago(hours), meta: { mailbox: 'delivered' } }]
      expect(dueHolds([{ ...lead, created_at: ago(hours) }], thread, NOW)).toEqual([])
    }
  })

  it('a photo with no words still gets a card that says what it is', async () => {
    const n = normalizeEmail(reply({ text: QUOTED.trimStart() }), PHOTO)
    if ('ignored' in n) throw new Error('ignored')
    await ingest(world().db, n)
    expect(openLead.mock.calls[0][2].concept).toBe('Sent 1 photo in reply to your note')
    expect(replyConcept('', 3, 'email')).toBe('Sent 3 photos in reply to your note')
    expect(replyConcept('  ', 0, 'email')).toBe('Replied to your note')
  })

  it('a second reply from the same person joins their card instead of opening another', async () => {
    findOpenLead.mockResolvedValue({ id: 'match-open', status: 'pending', channel: 'email', client_name: 'Maya Ortiz', client_email: 'maya@example.com', client_phone: null, external_thread_id: null, ai_summary: 'cardinal' })
    const n = normalizeEmail(reply({ id: 'em_reply_2', text: 'One more angle.' }), PHOTO)
    if ('ignored' in n) throw new Error('ignored')
    const out = await ingest(world().db, n)
    expect(out).toEqual({ outcome: 'appended', matchId: 'match-open', attachments: 1 })
    expect(openLead).not.toHaveBeenCalled()
    expect(notifyArtist.mock.calls[0][0].skip).toMatch(/already in her mailbox/)
  })

  it('an out-of-office auto-reply to the send is not a client', () => {
    expect(normalizeEmail(reply({ subject: `Automatic reply: ${SUBJECT}` }), [])).toEqual({ ignored: 'automated' })
    expect(normalizeEmail(reply({ headers: { 'Auto-Submitted': 'auto-replied' } }), [])).toEqual({ ignored: 'automated' })
  })
})

describe('campaignReply', () => {
  it('matches a reply to a subject in her approvals queue, whatever the mail app did to it', async () => {
    const db = world().db
    expect(await campaignReply(db, `Re: ${SUBJECT}`)).toEqual({ key: 'rsa-reconnect-1' })
    expect(await campaignReply(db, `RE: Re:  IT’S LACEY. I’d love to see how yours healed.`)).toEqual({ key: 'rsa-reconnect-1' })
  })
  it('leaves an ordinary email alone: a new subject, or the same words without "Re:"', async () => {
    const db = world().db
    expect(await campaignReply(db, 'Re: Moth piece')).toBeNull()
    expect(await campaignReply(db, SUBJECT)).toBeNull()
    expect(await campaignReply(db, null)).toBeNull()
  })
  it('an ordinary inquiry keeps its own subject as the card title', async () => {
    const n = normalizeEmail(reply({ subject: 'Peony for my forearm', text: 'Hi Lacey, I would love a watercolor peony.' }), [])
    if ('ignored' in n) throw new Error('ignored')
    await ingest(world().db, n)
    expect(openLead.mock.calls[0][2].concept).toBe('Peony for my forearm')
    expect(openLead.mock.calls[0][2].brief.reply_to_campaign).toBeUndefined()
  })
})
