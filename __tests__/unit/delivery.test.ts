/**
 * @jest-environment node
 */
import { createHmac } from 'crypto'
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// Proof of delivery from Resend's receipts, with no extra mail to Lacey.

const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))
let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))
const handleInboundEmail = jest.fn().mockResolvedValue({ outcome: 'ignored', reason: 'test' })
jest.mock('@/lib/inbound/email', () => ({ ...jest.requireActual('@/lib/inbound/email'), handleInboundEmail: (...a: unknown[]) => handleInboundEmail(...a) }))

import { recordDeliveryEvent, sweepReceipts, latestReceipt, isDeliveryEvent } from '@/lib/delivery'
import { POST } from '@/app/api/inbound/email/route'

const NOW = Date.parse('2026-11-10T20:00:00Z')
const ROW = { id: 'log-1', kind: 'New inquiry', ref: 'abcdef12-3456', recipient: 'l***@rawsunart.com', delivery_status: null as string | null }
const has = (c: Call, col: string, val?: unknown) => c.filters.some(([k, v]) => k === col && (val === undefined || v === val))

const logWith = (row: typeof ROW | null) =>
  fakeDb((c: Call) => (c.table === 'artist_notifications' && c.op === 'select' ? { data: row ? [row] : [] } : undefined))
const event = (type: string, extra: Record<string, unknown> = {}) => ({ type, created_at: '2026-11-10T19:59:30.000Z', data: { email_id: 're_123', to: ['lacey@rawsunart.com'], ...extra } })

beforeEach(() => {
  alertOperator.mockClear()
  handleInboundEmail.mockClear()
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('a-test-signing-secret').toString('base64')
})

describe('recordDeliveryEvent', () => {
  test('a delivered receipt is written onto the row for that message, and nobody is mailed', async () => {
    db = logWith(ROW)
    expect(await recordDeliveryEvent(db.db, event('email.delivered'), NOW)).toEqual({ outcome: 'recorded', status: 'delivered' })
    expect(db.calls[0].filters).toContainEqual(['provider_id', 're_123'])
    const [up] = writes(db.calls, 'artist_notifications', 'update')
    expect(up.payload).toEqual({ delivery_status: 'delivered', delivered_at: '2026-11-10T19:59:30.000Z' })
    expect(up.filters).toContainEqual(['id', 'log-1'])
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('a bounce alerts the operator with the reason and the ref, never a client’s details', async () => {
    db = logWith(ROW)
    const r = await recordDeliveryEvent(db.db, event('email.bounced', { bounce: { type: 'Permanent', subType: 'General', message: 'mailbox full' }, subject: 'Inquiry: fern for Ana Ruiz' }), NOW)
    expect(r).toEqual({ outcome: 'recorded', status: 'bounced' })
    expect(writes(db.calls, 'artist_notifications', 'update')[0].payload).toEqual({ delivery_status: 'bounced' })
    expect(alertOperator).toHaveBeenCalledTimes(1)
    const alert = alertOperator.mock.calls[0][0]
    expect(alert.subject).toBe('Email to Lacey BOUNCED: New inquiry (ref abcdef12)')
    expect(alert.text).toContain('Permanent / General: mailbox full')
    expect(alert.text).toContain('l***@rawsunart.com')
    expect(alert.text).not.toContain('Ana')
  })

  test('a spam complaint alerts too, even on a row already delivered', async () => {
    db = logWith({ ...ROW, delivery_status: 'delivered' })
    expect(await recordDeliveryEvent(db.db, event('email.complained'), NOW)).toEqual({ outcome: 'recorded', status: 'complained' })
    expect(alertOperator.mock.calls[0][0].subject).toContain('was marked as spam')
  })

  test('a delay is recorded quietly; a late "delayed" never undoes "delivered"', async () => {
    db = logWith(ROW)
    expect(await recordDeliveryEvent(db.db, event('email.delivery_delayed'), NOW)).toEqual({ outcome: 'recorded', status: 'delayed' })
    expect(alertOperator).not.toHaveBeenCalled()

    db = logWith({ ...ROW, delivery_status: 'delivered' })
    expect(await recordDeliveryEvent(db.db, event('email.delivery_delayed'), NOW)).toEqual({ outcome: 'ignored', reason: 'already delivered' })
    expect(writes(db.calls, 'artist_notifications', 'update')).toHaveLength(0)
  })

  test('a receipt that arrives after the sweep gave up still marks the row delivered', async () => {
    db = logWith({ ...ROW, delivery_status: 'unconfirmed' })
    expect(await recordDeliveryEvent(db.db, event('email.delivered'), NOW)).toEqual({ outcome: 'recorded', status: 'delivered' })
  })

  test('receipts for mail that is not hers (client receipts, alerts) and other events are ignored', async () => {
    db = logWith(null)
    expect(await recordDeliveryEvent(db.db, event('email.delivered'), NOW)).toEqual({ outcome: 'ignored', reason: 'not an email to the artist' })
    expect(await recordDeliveryEvent(db.db, event('email.opened'), NOW)).toEqual({ outcome: 'ignored', reason: 'not a delivery event' })
    expect(isDeliveryEvent('email.received')).toBe(false)
    expect(isDeliveryEvent('email.bounced')).toBe(true)
    expect(writes(db.calls, 'artist_notifications', 'update')).toHaveLength(0)
  })
})

describe('sweepReceipts', () => {
  const stale = [
    { id: 'log-1', kind: 'New inquiry', ref: 'abcdef12-0000', created_at: '2026-11-10T19:30:00.000Z', delivery_status: null },
    { id: 'log-2', kind: 'Daily digest', ref: 'digest-2026-11-09', created_at: '2026-11-10T00:00:05.000Z', delivery_status: 'delayed' },
  ]

  test('sent rows with no receipt after 15 minutes are marked unconfirmed and reported once, in one alert', async () => {
    db = fakeDb((c: Call) => (c.table === 'artist_notifications' && c.op === 'select' ? { data: stale } : undefined))
    expect(await sweepReceipts(db.db, NOW)).toEqual({ unconfirmed: 2, skipped: null })

    const q = db.calls[0]
    expect(q.filters).toEqual(expect.arrayContaining([
      ['status', 'sent'],
      ['provider_id not is', null],
      ['or', 'delivery_status.is.null,delivery_status.eq.delayed'],
      ['created_at<=', '2026-11-10T19:45:00.000Z'], // 15 minutes of grace
      ['created_at>=', '2026-11-09T20:00:00.000Z'], // nothing older than a day
    ]))
    const [up] = writes(db.calls, 'artist_notifications', 'update')
    expect(up.payload).toEqual({ delivery_status: 'unconfirmed' })
    expect(up.filters).toContainEqual(['id in', ['log-1', 'log-2']])

    expect(alertOperator).toHaveBeenCalledTimes(1)
    const alert = alertOperator.mock.calls[0][0]
    expect(alert.subject).toBe('2 emails to Lacey with no delivery receipt after 15 minutes')
    expect(alert.text).toContain('New inquiry, ref abcdef12')
    expect(alert.text).toContain('Daily digest, ref digest-2')
    expect(alert.text).toContain('delayed')
  })

  test('nothing overdue: no write, no alert', async () => {
    db = fakeDb(() => ({ data: [] }))
    expect(await sweepReceipts(db.db, NOW)).toEqual({ unconfirmed: 0, skipped: null })
    expect(writes(db.calls, 'artist_notifications', 'update')).toHaveLength(0)
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('off until the webhook secret is set: without the webhook every send would read as a miss', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    db = fakeDb(() => ({ data: stale }))
    expect((await sweepReceipts(db.db, NOW)).skipped).toMatch(/RESEND_WEBHOOK_SECRET/)
    expect(db.calls).toHaveLength(0)
    expect(alertOperator).not.toHaveBeenCalled()
  })
})

describe('latestReceipt', () => {
  test('the newest delivered_at, or null', async () => {
    db = fakeDb((c: Call) => (has(c, 'delivery_status', 'delivered') ? { data: [{ delivered_at: '2026-11-10T00:00:04.000Z' }] } : undefined))
    expect(await latestReceipt(db.db)).toBe('2026-11-10T00:00:04.000Z')
    db = fakeDb(() => ({ data: [] }))
    expect(await latestReceipt(db.db)).toBeNull()
    db = fakeDb(() => ({ error: { message: 'column delivered_at does not exist' } }))
    expect(await latestReceipt(db.db)).toBeNull() // before migration 020: no receipt, no claim
  })
})

describe('POST /api/inbound/email with delivery events', () => {
  const post = (body: unknown, sign = true) => {
    const raw = JSON.stringify(body)
    const id = 'msg_1'
    const ts = String(Math.floor(Date.now() / 1000))
    const key = Buffer.from(process.env.RESEND_WEBHOOK_SECRET!.replace(/^whsec_/, ''), 'base64')
    const sig = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64')
    return POST(new Request('http://x/api/inbound/email', {
      method: 'POST',
      headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sign ? `v1,${sig}` : 'v1,bm9wZQ==' },
      body: raw,
    }))
  }

  test('a signed delivered event is recorded; it never goes down the inbound-message path', async () => {
    db = logWith(ROW)
    const res = await post(event('email.delivered'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, outcome: 'recorded', status: 'delivered' })
    expect(writes(db.calls, 'artist_notifications', 'update')[0].payload).toMatchObject({ delivery_status: 'delivered' })
    expect(handleInboundEmail).not.toHaveBeenCalled()
  })

  test('an unsigned event writes nothing', async () => {
    db = logWith(ROW)
    expect((await post(event('email.bounced'), false)).status).toBe(401)
    expect(db.calls).toHaveLength(0)
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('a database failure answers 500 so Resend retries the receipt', async () => {
    db = fakeDb(() => ({ error: { message: 'connection refused' } }))
    expect((await post(event('email.delivered'))).status).toBe(500)
  })

  test('email.received still goes to the inbox as before', async () => {
    db = logWith(ROW)
    const res = await post({ type: 'email.received', data: { email_id: 'in_1' } })
    expect(res.status).toBe(200)
    expect(handleInboundEmail).toHaveBeenCalledWith(db.db, 'in_1')
  })
})
