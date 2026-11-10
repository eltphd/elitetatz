/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

const send = jest.fn()
jest.mock('@/lib/resend', () => ({ sendEmailDetailed: (...a: unknown[]) => send(...a) }))
const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))
jest.mock('@/lib/sms', () => ({ sendSms: jest.fn(), toE164: () => null }))
let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))

import { notifyArtist, notifyClient } from '@/lib/notify'

beforeEach(() => {
  db = fakeDb((c: Call) => (c.table === 'artist_notifications' && c.op === 'insert' ? { data: { id: 'log-9' } } : undefined))
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  delete process.env.ARTIST_NOTIFICATION_CC
  send.mockReset()
  alertOperator.mockClear()
})

describe('notifyArtist', () => {
  test('a sent email is logged as sent, with the client as reply-to and the match attached', async () => {
    send.mockResolvedValue({ ok: true, id: 're_123' })
    const r = await notifyArtist({ kind: 'Client reply', ref: 'match-1', matchId: 'match-1', artistId: 'artist-1', replyTo: 'ana@example.com', subject: 'Ana replied', text: 'hi' })
    expect(r).toEqual({ emailed: true, error: undefined, logId: 'log-9' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'lacey@rawsunart.com', replyTo: 'ana@example.com', subject: 'Ana replied' })
    const [log] = writes(db.calls, 'artist_notifications', 'insert')
    expect(log.payload).toMatchObject({ match_id: 'match-1', artist_id: 'artist-1', kind: 'Client reply', ref: 'match-1', channel: 'email', status: 'sent', provider_id: 're_123', recipient: 'l***@rawsunart.com', read: true })
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('a failed email is logged as failed with the error, and the operator is alerted without client details', async () => {
    send.mockResolvedValue({ ok: false, error: 'resend 403: domain not verified' })
    const r = await notifyArtist({ kind: 'New inquiry', ref: 'abcdef12-0000', replyTo: 'ana@example.com', subject: 'Inquiry: fern', text: 'From: Ana Ruiz' })
    expect(r.emailed).toBe(false)
    expect(r.logId).toBe('log-9')
    const [log] = writes(db.calls, 'artist_notifications', 'insert')
    expect(log.payload).toMatchObject({ status: 'failed', error: 'resend 403: domain not verified', match_id: null })
    expect(alertOperator).toHaveBeenCalledTimes(1)
    const alert = alertOperator.mock.calls[0][0]
    expect(alert.subject).toContain('New inquiry')
    expect(alert.subject).toContain('abcdef12')
    expect(alert.text).toContain('resend 403')
    expect(alert.text).not.toContain('Ana')
    expect(alert.text).not.toContain('ana@example.com')
  })

  test('the log never breaks the send', async () => {
    db = fakeDb(() => ({ error: { message: 'column kind does not exist' } }))
    send.mockResolvedValue({ ok: true, id: 're_1' })
    const r = await notifyArtist({ kind: 'x', ref: 'r', subject: 's', text: 't' })
    expect(r).toEqual({ emailed: true, error: undefined, logId: null })
  })

  test('the CC copy says the artist copy failed when it did', async () => {
    process.env.ARTIST_NOTIFICATION_CC = 'ops@example.com'
    send.mockResolvedValueOnce({ ok: false, error: 'resend 500' }).mockResolvedValueOnce({ ok: true })
    await notifyArtist({ kind: 'New inquiry', ref: 'r1', subject: 's', text: 't' })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1][0].to).toBe('ops@example.com')
    expect(send.mock.calls[1][0].text).toContain('FAILED')
  })

  test('skip: nothing is sent to her, the operator copy or anyone, and the log says why', async () => {
    process.env.ARTIST_NOTIFICATION_CC = 'ops@example.com'
    const r = await notifyArtist({ kind: 'New email inquiry', ref: 'match-7', matchId: 'match-7', replyTo: 'ana@example.com', subject: 'Email: Ana', text: 't', sms: 'x', skip: 'already in her mailbox: she forwarded this message herself' })
    expect(r).toEqual({ emailed: false, skipped: true, logId: 'log-9' })
    expect(send).not.toHaveBeenCalled()
    expect(alertOperator).not.toHaveBeenCalled()
    const [log] = writes(db.calls, 'artist_notifications', 'insert')
    expect(log.payload).toMatchObject({ match_id: 'match-7', kind: 'New email inquiry', status: 'skipped', error: 'already in her mailbox: she forwarded this message herself', provider_id: null })
  })
})

describe('notifyClient', () => {
  test('every client email replies to Lacey', async () => {
    send.mockResolvedValue({ ok: true })
    await notifyClient({ email: 'ana@example.com', subject: 's', text: 't' })
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'ana@example.com', replyTo: 'lacey@rawsunart.com' })
  })
})
