/**
 * @jest-environment node
 */
import { fakeDb } from '../helpers/fake-db'

const run = jest.fn().mockResolvedValue({ checked: 0, due: 0, sent: [], skipped: null })
jest.mock('@/lib/holds', () => ({ runHolds: (...a: unknown[]) => run(...a) }))
const sweep = jest.fn().mockResolvedValue({ unconfirmed: 0, skipped: null })
jest.mock('@/lib/delivery', () => ({ sweepReceipts: (...a: unknown[]) => sweep(...a) }))
let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))
jest.mock('@/lib/channels', () => ({ artistForInbound: async () => ({ id: 'artist-1', payout_preference: null }) }))

import { GET } from '@/app/api/cron/holds/route'

const get = (auth?: string) => GET(new Request('http://x/api/cron/holds', { headers: auth ? { authorization: auth } : {} }))

describe('GET /api/cron/holds', () => {
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

  test('runs the holds for the artist with the right bearer', async () => {
    const res = await get('Bearer cron-secret')
    expect(res.status).toBe(200)
    expect(run).toHaveBeenCalledWith(db.db, 'artist-1')
    expect(await res.json()).toMatchObject({ sent: [], receipts: { unconfirmed: 0 } })
  })

  test('the receipt sweep runs on every tick, and a sweep that throws does not stop the holds', async () => {
    await get('Bearer cron-secret')
    expect(sweep).toHaveBeenCalledWith(db.db)
    sweep.mockRejectedValueOnce(new Error('boom'))
    const res = await get('Bearer cron-secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: [], receipts: { error: 'Receipt sweep failed' } })
    expect(run).toHaveBeenCalledTimes(2)
  })
})
