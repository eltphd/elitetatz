/**
 * @jest-environment node
 */
import { fakeDb } from '../helpers/fake-db'

const send = jest.fn().mockResolvedValue({ ok: true, id: 're_1' })
jest.mock('@/lib/resend', () => ({ sendEmailDetailed: (...a: unknown[]) => send(...a) }))
jest.mock('@/lib/alert', () => ({ alertOperator: jest.fn() }))
jest.mock('@/lib/sms', () => ({ sendSms: jest.fn(), toE164: () => null }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb().db }))

import { artistReplyTo, notifyArtist } from '@/lib/notify'

beforeEach(() => {
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  process.env.INBOUND_EMAIL_ADDRESS = 'inbox@rawsunart.com'
  delete process.env.ARTIST_NOTIFICATION_CC
  delete process.env.REPLY_SYNC
  send.mockClear()
})

describe('artistReplyTo', () => {
  it('her reply goes to the client first, with the intake address beside it', () => {
    expect(artistReplyTo('ana@example.com')).toEqual(['ana@example.com', 'inbox@rawsunart.com'])
  })
  it('falls back to the client alone when there is no intake address or the switch is off', () => {
    delete process.env.INBOUND_EMAIL_ADDRESS
    expect(artistReplyTo('ana@example.com')).toBe('ana@example.com')
    process.env.INBOUND_EMAIL_ADDRESS = 'inbox@rawsunart.com'
    process.env.REPLY_SYNC = 'off'
    expect(artistReplyTo('ana@example.com')).toBe('ana@example.com')
  })
  it('is nothing when there is no client address to answer', () => {
    expect(artistReplyTo(null)).toBeUndefined()
    expect(artistReplyTo('  ')).toBeUndefined()
  })
})

describe('notifyArtist', () => {
  it('every email to her about a client carries both addresses in Reply-To', async () => {
    await notifyArtist({ kind: 'New inquiry', ref: 'm1', replyTo: 'ana@example.com', subject: 's', text: 't' })
    expect(send.mock.calls[0][0].replyTo).toEqual(['ana@example.com', 'inbox@rawsunart.com'])
  })
  it('an email that is not about a client (the digest, an approval) has no client reply-to', async () => {
    await notifyArtist({ kind: 'approval', ref: 'a1', subject: 's', text: 't' })
    expect(send.mock.calls[0][0].replyTo).toBeUndefined()
  })
})
