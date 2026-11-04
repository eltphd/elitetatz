/**
 * @jest-environment node
 */
import { fakeDb, writes } from '../helpers/fake-db'

let db: ReturnType<typeof fakeDb>
let ctx: { ok: true; artist: { id: string }; db: unknown } | { ok: false; status: number; error: string }
jest.mock('@/lib/artist-session', () => ({ artistContext: async () => ctx }))

import { POST } from '@/app/api/dashboard/walkthrough/route'

const post = (body: unknown) =>
  POST(new Request('http://x/api/dashboard/walkthrough', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }))

describe('POST /api/dashboard/walkthrough', () => {
  beforeEach(() => {
    db = fakeDb()
    ctx = { ok: true, artist: { id: 'artist-1' }, db: db.db }
  })

  test('401 when not signed in, and nothing is written', async () => {
    ctx = { ok: false, status: 401, error: 'Unauthorized' }
    expect((await post({ dismissed: true })).status).toBe(401)
    expect(db.calls).toHaveLength(0)
  })

  test('400 on bad JSON or a non-boolean', async () => {
    expect((await post('{nope')).status).toBe(400)
    expect((await post({ dismissed: 'yes' })).status).toBe(400)
    expect((await post({})).status).toBe(400)
    expect(db.calls).toHaveLength(0)
  })

  test('records the dismissal on the signed-in artist\'s own row', async () => {
    const res = await post({ dismissed: true })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.dismissedAt).toBe('string')
    const [up] = writes(db.calls, 'artists', 'update')
    expect(up.filters).toEqual([['id', 'artist-1']])
    expect(up.payload).toEqual({ walkthrough_dismissed_at: body.dismissedAt })
  })

  test('clears it when asked to show the walkthrough again', async () => {
    const res = await post({ dismissed: false })
    expect(await res.json()).toEqual({ ok: true, dismissedAt: null })
    const [up] = writes(db.calls, 'artists', 'update')
    expect(up.payload).toEqual({ walkthrough_dismissed_at: null })
  })

  test('500 with the database message when the write fails', async () => {
    db = fakeDb(() => ({ error: { message: 'column does not exist' } }))
    ctx = { ok: true, artist: { id: 'artist-1' }, db: db.db }
    const res = await post({ dismissed: true })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'column does not exist' })
  })
})
