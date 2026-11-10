/**
 * @jest-environment node
 */
import { fakeDb } from '../helpers/fake-db'

const run = jest.fn()
jest.mock('@/lib/probe', () => ({ runProbe: (...a: unknown[]) => run(...a) }))
let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))

import { GET } from '@/app/api/cron/probe/route'

const get = (auth?: string, q = '') => GET(new Request(`http://x/api/cron/probe${q}`, { headers: auth ? { authorization: auth } : {} }))
const green = { ok: true, checks: { posted: true, email: true, match: true, source: true }, error: null, ref: 'm', skipped: null }

describe('GET /api/cron/probe', () => {
  beforeEach(() => { db = fakeDb(); run.mockReset().mockResolvedValue(green); process.env.CRON_SECRET = 'cron-secret' })

  test('does not exist without CRON_SECRET, and refuses a wrong bearer', async () => {
    delete process.env.CRON_SECRET
    expect((await get('Bearer cron-secret')).status).toBe(503)
    process.env.CRON_SECRET = 'cron-secret'
    expect((await get('Bearer nope')).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  test('a green run is 200, a failed run is 500 so the cron log shows it, a skipped tick is 200', async () => {
    expect((await get('Bearer cron-secret')).status).toBe(200)
    expect(run).toHaveBeenCalledWith(db.db, { force: false })
    run.mockResolvedValue({ ...green, ok: false, checks: { ...green.checks, source: false }, error: 'no source row' })
    expect((await get('Bearer cron-secret', '?force=1')).status).toBe(500)
    expect(run).toHaveBeenLastCalledWith(db.db, { force: true })
    run.mockResolvedValue({ ...green, ok: false, skipped: 'not 9 AM Eastern' })
    expect((await get('Bearer cron-secret')).status).toBe(200)
  })
})
