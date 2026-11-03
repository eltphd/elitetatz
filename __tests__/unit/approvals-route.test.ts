/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

const notify = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notify(...a) }))

let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))
jest.mock('@/lib/channels', () => ({ artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }) }))

import { POST, GET } from '@/app/api/approvals/route'

const post = (body: unknown, key?: string) =>
  POST(new Request('http://x/api/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-operator-key': key } : {}) }, body: JSON.stringify(body) }))
const get = (key: string, secret = 'secret-123') => GET(new Request(`http://x/api/approvals?key=${key}`, { headers: { 'x-operator-key': secret } }))

describe('operator approvals route', () => {
  beforeEach(() => {
    db = fakeDb()
    process.env.OPERATOR_API_KEY = 'secret-123'
    notify.mockClear()
  })

  test('503 when not configured', async () => {
    delete process.env.OPERATOR_API_KEY
    expect((await post({ kind: 'email_campaign', key: 'k', title: 't', body_text: 'x' }, 'secret-123')).status).toBe(503)
  })

  test('401 with a wrong or missing key, and nobody is notified', async () => {
    expect((await post({ kind: 'email_campaign', key: 'k', title: 't', body_text: 'x' }, 'nope')).status).toBe(401)
    expect((await post({ kind: 'email_campaign', key: 'k', title: 't', body_text: 'x' })).status).toBe(401)
    expect(notify).not.toHaveBeenCalled()
    expect(db.calls).toHaveLength(0)
  })

  test('400 on a bad kind or a missing body', async () => {
    expect((await post({ kind: 'tweet', key: 'k', title: 't', body_text: 'x' }, 'secret-123')).status).toBe(400)
    expect((await post({ kind: 'blog_post', key: 'k', title: 't' }, 'secret-123')).status).toBe(400)
  })

  test('upserts as pending on (artist, key) and notifies Lacey only', async () => {
    db = fakeDb((c: Call) => (c.table === 'approvals' && c.op === 'upsert' ? { data: { id: 'ap-1', status: 'pending' } } : undefined))
    const res = await post({ kind: 'email_campaign', key: 'rsa-reconnect-1', title: 'Reconnect', subject: 's', body_html: '<p>hi</p>', body_text: 'hi', audience_count: '197' }, 'secret-123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 'ap-1', status: 'pending' })
    const [up] = writes(db.calls, 'approvals', 'upsert')
    expect(up.payload).toMatchObject({ artist_id: 'artist-1', kind: 'email_campaign', key: 'rsa-reconnect-1', status: 'pending', audience_count: 197, artist_notes: null, decided_at: null })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].subject).toContain('Reconnect')
    expect(notify.mock.calls[0][0].text).toContain('https://elitetatz.vercel.app/dashboard/approvals')
    expect(notify.mock.calls[0][0].sms).toContain('https://elitetatz.vercel.app/dashboard/approvals')
  })

  test('GET reads the decision back by key, scoped to the artist', async () => {
    db = fakeDb((c: Call) => {
      if (c.table !== 'approvals') return undefined
      const key = c.filters.find(([k]) => k === 'key')?.[1]
      return key === 'rsa-reconnect-1' ? { data: { id: 'ap-1', kind: 'email_campaign', key, title: 'Reconnect', status: 'approved', decided_at: '2026-11-04T00:00:00Z', artist_notes: null } } : { data: null }
    })
    const res = await get('rsa-reconnect-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ key: 'rsa-reconnect-1', status: 'approved' })
    expect(db.calls[0].filters).toContainEqual(['artist_id', 'artist-1'])
    expect((await get('nope')).status).toBe(404)
    expect((await get('rsa-reconnect-1', 'wrong')).status).toBe(401)
  })
})
