/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// Erica's rule (Nov 9 2026): Lacey never gets two emails about the same thing.
// A message that already passed through her own mailbox is on the card and in
// the thread like any other, but she is not emailed a second copy of it.

const notifyArtist = jest.fn().mockResolvedValue({ emailed: true, logId: 'log-1' })
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notifyArtist(...a) }))
jest.mock('@/lib/attachments', () => ({ fetchBytes: jest.fn(), storeAttachment: jest.fn() }))
const findOpenLead = jest.fn()
jest.mock('@/lib/channels', () => ({
  CHANNEL_LABEL: { email: 'Email', sms: 'Text', instagram: 'Instagram' },
  artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }),
  findOpenLead: (...a: unknown[]) => findOpenLead(...a),
  openLead: async () => ({ id: 'match-new' }),
  appendClientMessage: async () => ({ id: 'msg-1', duplicate: false }),
}))

import { alreadyInArtistMailbox, artistMailboxes, normalizeEmail, type ReceivedEmail } from '@/lib/inbound/email'
import { ingest, type NormalizedInbound } from '@/lib/inbound/ingest'

const mail = (over: Partial<ReceivedEmail>): ReceivedEmail => ({ id: 'e1', from: 'Devon Carter <devon@example.com>', to: ['inbox@rawsunart.com'], subject: 'Moth piece', text: 'Hi Lacey, a fine-line moth on my sternum.', html: null, ...over })

const FORWARD = `---------- Forwarded message ---------
From: Devon Carter <devon@example.com>
Date: Mon, Nov 9, 2026 at 9:14 AM
Subject: Tattoo inquiry - moth piece
To: <lacey@rawsunart.com>

Hi Lacey, I'd love a fine-line moth on my sternum.`

beforeEach(() => {
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  process.env.ARTIST_NOTIFICATION_CC = 'ops@example.com'
  process.env.INBOUND_EMAIL_ADDRESS = 'inbox@rawsunart.com'
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  notifyArtist.mockClear()
  findOpenLead.mockReset().mockResolvedValue(null)
})

describe('alreadyInArtistMailbox', () => {
  it('knows her mailbox from the sending, operator and intake addresses', () => {
    const hers = artistMailboxes()
    expect(hers.has('lacey@rawsunart.com')).toBe(true)
    expect(hers.has('club@rawsunart.com')).toBe(false)
    expect(hers.has('ops@example.com')).toBe(false)
    expect(hers.has('inbox@rawsunart.com')).toBe(false)
  })
  it('a forward she sent herself: she has it', () => {
    expect(alreadyInArtistMailbox(mail({ from: 'Lacey <lacey@rawsunart.com>', text: FORWARD }))).toBe('forwarded')
  })
  it('her mail auto-forwarded it (To is still her, Gmail adds X-Forwarded-For): she has it', () => {
    expect(alreadyInArtistMailbox(mail({ to: ['Lacey Rawson <lacey@rawsunart.com>'] }))).toBe('delivered')
    expect(alreadyInArtistMailbox(mail({ headers: { 'X-Forwarded-For': 'lacey@rawsunart.com inbox@rawsunart.com', 'X-Forwarded-To': 'inbox@rawsunart.com' } }))).toBe('delivered')
    expect(alreadyInArtistMailbox(mail({ headers: [{ name: 'Delivered-To', value: 'LACEY@RawSunArt.com' }] }))).toBe('delivered')
  })
  it('a client who wrote to us and copied her: she has it', () => {
    expect(alreadyInArtistMailbox(mail({ headers: { Cc: 'Lacey <lacey@rawsunart.com>, friend@example.com' } }))).toBe('delivered')
  })
  it('a client who wrote only to the intake address: she does not have it', () => {
    expect(alreadyInArtistMailbox(mail({}))).toBeNull()
    expect(alreadyInArtistMailbox(mail({ headers: { To: 'inbox@rawsunart.com', Cc: 'friend@example.com' } }))).toBeNull()
  })
  it('the operator forwarding a client email: she does not have it', () => {
    expect(alreadyInArtistMailbox(mail({ from: 'Ops <ops@example.com>', text: FORWARD }))).toBeNull()
  })
  it('an address that only contains hers is not hers', () => {
    expect(alreadyInArtistMailbox(mail({ to: ['notlacey@rawsunart.com.example.org'] }))).toBeNull()
  })
})

describe('normalizeEmail carries the flag', () => {
  it('her own forward becomes a lead for the client, marked as already hers', () => {
    const n = normalizeEmail(mail({ from: 'Lacey <lacey@rawsunart.com>', subject: 'Fwd: Tattoo inquiry - moth piece', text: FORWARD }), [])
    if ('ignored' in n) throw new Error('should not be ignored')
    expect(n.email).toBe('devon@example.com')
    expect(n.artistHasIt).toBe('forwarded')
  })
  it('a direct client email carries no flag', () => {
    const n = normalizeEmail(mail({}), [])
    if ('ignored' in n) throw new Error('should not be ignored')
    expect(n.artistHasIt).toBeNull()
  })
})

describe('ingest', () => {
  const inbound = (over: Partial<NormalizedInbound>): NormalizedInbound => ({
    channel: 'email', externalId: 'resend:e1', senderName: 'Devon Carter', email: 'devon@example.com', phone: null,
    text: 'Hi Lacey, a fine-line moth on my sternum.', subject: 'Moth piece', attachments: [], ...over,
  })
  const run = async (msg: NormalizedInbound) => {
    const db = fakeDb((c: Call) => (c.table === 'inbound_events' && c.op === 'insert' ? { data: { id: 1 } } : undefined))
    const out = await ingest(db.db, msg)
    return { out, db }
  }

  it('a message she forwarded herself opens the lead and tells notifyArtist to send nothing', async () => {
    const { out, db } = await run(inbound({ artistHasIt: 'forwarded' }))
    expect(out).toEqual({ outcome: 'opened', matchId: 'match-new', attachments: 0 })
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyArtist.mock.calls[0][0].skip).toMatch(/she forwarded this message herself/)
    expect(notifyArtist.mock.calls[0][0].matchId).toBe('match-new')
    // The event is still recorded as handled.
    expect(writes(db.calls, 'inbound_events', 'update')[0].payload).toMatchObject({ match_id: 'match-new', outcome: 'opened' })
  })
  it('a reply that reached her mailbox first joins the thread without a second email', async () => {
    findOpenLead.mockResolvedValue({ id: 'match-open', status: 'pending', channel: 'web', client_name: 'Devon', client_email: 'devon@example.com', client_phone: null, external_thread_id: null, ai_summary: 'moth' })
    const { out } = await run(inbound({ artistHasIt: 'delivered' }))
    expect(out).toMatchObject({ outcome: 'appended', matchId: 'match-open' })
    expect(notifyArtist.mock.calls[0][0].skip).toMatch(/delivered to her address/)
  })
  it('a message that came only to us still gets her one email', async () => {
    await run(inbound({ artistHasIt: null }))
    expect(notifyArtist.mock.calls[0][0].skip).toBeNull()
    await run(inbound({ channel: 'sms', externalId: 'sms:1', email: null, phone: '+16145550100' }))
    expect(notifyArtist.mock.calls[1][0].skip).toBeNull()
  })
})
