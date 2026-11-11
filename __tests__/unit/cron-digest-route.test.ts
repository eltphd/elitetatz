/**
 * @jest-environment node
 */
import { fakeDb } from '../helpers/fake-db'

const run = jest.fn().mockResolvedValue({ sent: true, skipped: null, newToday: 0, unanswered: 0, probe: 'ok' })
jest.mock('@/lib/digest', () => ({ runDigest: (...a: unknown[]) => run(...a) }))
let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))
jest.mock('@/lib/channels', () => ({ artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }) }))

import { GET } from '@/app/api/cron/digest/route'

const get = (auth?: string, q = '') => GET(new Request(`http://x/api/cron/digest${q}`, { headers: auth ? { authorization: auth } : {} }))

describe('GET /api/cron/digest', () => {
  beforeEach(() => { db = fakeDb(); run.mockClear(); process.env.CRON_SECRET = 'cron-secret' })

  test('does not exist without CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    expect((await get('Bearer cron-secret')).status).toBe(503)
    expect(run).not.toHaveBeenCalled()
  })

  test('refuses a missing or wrong bearer', async () => {
    expect((await get()).status).toBe(401)
    expect((await get('Bearer nope')).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  test('runs the digest for the artist; ?force=1 passes through', async () => {
    const res = await get('Bearer cron-secret')
    expect(res.status).toBe(200)
    expect(run).toHaveBeenCalledWith(db.db, 'artist-1', { force: false })
    expect(await res.json()).toMatchObject({ sent: true })
    await get('Bearer cron-secret', '?force=1')
    expect(run).toHaveBeenLastCalledWith(db.db, 'artist-1', { force: true })
  })
})
