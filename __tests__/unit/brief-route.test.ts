/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// The rule under test: every concierge brief reaches Lacey's email, whatever
// else fails, and a second brief from the same person is never dropped.

const notifyArtist = jest.fn()
const notifyClient = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/notify', () => ({
  notifyArtist: (...a: unknown[]) => notifyArtist(...a),
  notifyClient: (...a: unknown[]) => notifyClient(...a),
}))
const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
let db: ReturnType<typeof fakeDb> | null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => (db ? db.db : null) }))

import { POST } from '@/app/api/brief/route'
import { signBrief } from '@/lib/tokens'

const ARTIST = { id: 'artist-1', payout_preference: null }
const brief = {
  concept: 'Watercolor fern',
  placement: 'outer ankle',
  size: '2 inches',
  styles: ['watercolor'],
  client_name: 'Ana Ruiz',
  client_email: 'Ana@Example.com',
  client_phone: '',
  readiness_score: 80,
}

let ipN = 0
const post = (body: unknown) =>
  POST(new Request('http://x/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `198.51.100.${++ipN}` },
    body: JSON.stringify(body),
  }))
const payload = () => ({ messages: [{ role: 'user', content: 'hi' }], brief, briefToken: signBrief(brief), sessionId: 's-1' })

const dbWith = (extra?: (c: Call) => { data?: unknown; error?: unknown } | undefined) =>
  fakeDb((c: Call) => {
    const r = extra?.(c)
    if (r) return r
    if (c.table === 'artists') return { data: ARTIST }
    if (c.table === 'matches' && c.op === 'select') return { data: [] }
    if (c.table === 'conversations' && c.op === 'insert') return { data: { id: 'conv-1' } }
    return undefined
  })

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  process.env.MATCH_TOKEN_SECRET = 'a'.repeat(64)
  db = dbWith()
  notifyArtist.mockReset().mockResolvedValue({ emailed: true, logId: 'log-1' })
  notifyClient.mockClear()
  alertOperator.mockClear()
})

describe('concierge brief', () => {
  test('emails Lacey before any write, with the client as reply-to, then opens the match and sends the receipt', async () => {
    let writesBeforeEmail = -1
    notifyArtist.mockImplementation(async () => {
      writesBeforeEmail = db!.calls.filter((c) => c.op !== 'select').length
      return { emailed: true, logId: 'log-1' }
    })
    const res = await post(payload())
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toMatchObject({ portal: true, emailed: true, conversationId: 'conv-1' })
    expect(out.inquiryUrl).toContain(out.matchId)

    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const n = notifyArtist.mock.calls[0][0]
    expect(n.kind).toBe('New inquiry')
    expect(n.replyTo).toBe('ana@example.com')
    expect(n.text).toContain('Watercolor fern')
    expect(n.text).toContain('Reply to this email')

    // Nothing was written before her email went out.
    expect(writesBeforeEmail).toBe(0)
    const order = notifyArtist.mock.invocationCallOrder[0]
    const inserts = writes(db!.calls, 'matches', 'insert')
    expect(inserts).toHaveLength(1)
    expect((inserts[0].payload as { id: string }).id).toBe(out.matchId)
    expect(order).toBeLessThan(notifyClient.mock.invocationCallOrder[0])
    expect(notifyClient).toHaveBeenCalledTimes(1)
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('still emails Lacey when the database is down, and alerts that the portal missed it', async () => {
    db = null
    const res = await post(payload())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ portal: false, emailed: true })
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyClient).not.toHaveBeenCalled()
    expect(alertOperator.mock.calls[0][0].subject).toContain('email only')
  })

  test('still emails Lacey when the match insert fails', async () => {
    db = dbWith((c) => (c.table === 'matches' && c.op === 'insert' ? { error: { message: 'boom' } } : undefined))
    const res = await post(payload())
    expect(res.status).toBe(200)
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(alertOperator).toHaveBeenCalledTimes(1)
  })

  test('a second brief inside 24 hours is emailed as a follow-up and added to the thread, not dropped', async () => {
    db = dbWith((c) => (c.table === 'matches' && c.op === 'select' ? { data: [{ id: 'prior-match' }] } : undefined))
    const res = await post(payload())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ duplicate: true, portal: true, emailed: true })

    const n = notifyArtist.mock.calls[0][0]
    expect(n.kind).toBe('Inquiry follow-up')
    expect(n.matchId).toBe('prior-match')
    expect(n.subject).toMatch(/^Follow-up:/)

    const msgs = writes(db!.calls, 'match_messages', 'insert')
    expect(msgs).toHaveLength(1)
    expect(msgs[0].payload).toMatchObject({ match_id: 'prior-match', sender: 'client' })
    expect(writes(db!.calls, 'matches', 'insert')).toHaveLength(0)
    expect(notifyClient).not.toHaveBeenCalled()
  })

  test('both copies lost: 500, so the chat shows the client her address, and the operator is told', async () => {
    db = null
    notifyArtist.mockResolvedValue({ emailed: false, error: 'resend down', logId: null })
    const res = await post(payload())
    expect(res.status).toBe(500)
    expect(alertOperator.mock.calls[0][0].subject).toContain('LOST')
  })

  test('an unverified brief is refused and nobody is emailed', async () => {
    const res = await post({ ...payload(), briefToken: 'forged' })
    expect(res.status).toBe(403)
    expect(notifyArtist).not.toHaveBeenCalled()
  })
})
