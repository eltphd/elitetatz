/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// The morning probe: post like a client, signed, then prove the rows this run left.
// It mails nobody: the artist-email step is logged as skipped, and that row is the proof.

const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))
jest.mock('@/lib/notify', () => ({ artistInbox: () => 'lacey@rawsunart.com' }))

import { runProbe } from '@/lib/probe'
import { probeKey, verifiedProbe } from '@/lib/probe-tag'

// Tuesday 2026-11-10, 9:00 AM Eastern (EST).
const NOW = Date.parse('2026-11-10T14:00:00Z')

interface Rows { match?: boolean | 'untagged'; source?: boolean; log?: { status: string; error?: string } | null; ref?: string | null }
const has = (c: Call, col: string, val?: unknown) => c.filters.some(([k, v]) => k === col && (val === undefined || v === val))

/** A form route that behaves, and a database holding whichever rows the test grants. */
function world(rows: Rows = {}, routeStatus = 200) {
  let posted: Record<string, unknown> | null = null
  let headers: Record<string, string> = {}
  const ref = rows.ref === undefined ? 'match-p' : rows.ref
  const fetchImpl = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    posted = JSON.parse(String(init?.body))
    headers = init?.headers as Record<string, string>
    const body = routeStatus === 200 ? { ok: true, portal: true, emailed: false, ...(ref ? { ref } : {}) } : { error: 'Could not deliver the inquiry' }
    return new Response(JSON.stringify(body), { status: routeStatus })
  }) as unknown as typeof fetch
  const db = fakeDb((c: Call) => {
    if (c.op !== 'select') return { data: null }
    if (c.table === 'matches')
      return { data: rows.match === false ? null : { id: 'match-p', client_brief: JSON.stringify({ found_via: rows.match === 'untagged' ? 'direct' : 'test-probe' }) } }
    if (c.table === 'inquiry_sources') {
      if (!has(c, 'id>')) return { data: [{ id: 41 }] } // the newest probe source row before this run
      return { data: rows.source === false ? [] : [{ id: 42 }] }
    }
    if (c.table === 'artist_notifications') return { data: rows.log === null ? [] : [rows.log ?? { status: 'skipped', error: 'probe: not sent by design' }] }
    return undefined
  })
  return { db, fetchImpl, posted: () => posted, headers: () => headers, run: (now = NOW, force = false) => runProbe(db.db, { now, force, fetchImpl }) }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  process.env.CRON_SECRET = 'cron-secret'
  delete process.env.PROBE_INBOX_EMAIL
  alertOperator.mockClear()
})

describe('runProbe', () => {
  test('all green: posts the signed, tagged inquiry, finds this run’s three rows, records OK, removes its lead, alerts nobody', async () => {
    const w = world()
    const r = await w.run()
    expect(r).toMatchObject({ ok: true, checks: { posted: true, logged: true, match: true, source: true }, error: null, ref: 'match-p', skipped: null })

    expect(w.fetchImpl).toHaveBeenCalledWith('https://elitetatz.app/api/community/inquiry', expect.objectContaining({ method: 'POST' }))
    const body = w.posted()!
    expect(body).toMatchObject({ email: 'system-probe@elitetatz.invalid', found_via: 'test-probe', name: 'System Probe' })
    expect(String(body.probe_tag)).toMatch(/^probe-2026-11-10-[0-9a-f]{8}$/)
    expect(String(body.concept)).toContain(String(body.probe_tag))
    // The key is the run tag signed with CRON_SECRET, and the route's check accepts it.
    expect(w.headers()['x-probe-key']).toBe(probeKey(String(body.probe_tag)))
    expect(verifiedProbe(body.probe_tag, w.headers()['x-probe-key'], NOW)).toBe(true)

    // Each check is against this run's rows, not "any recent row".
    const selects = w.db.calls.filter((c) => c.op === 'select')
    expect(selects.find((c) => c.table === 'matches')!.filters).toContainEqual(['id', 'match-p'])
    expect(selects.find((c) => c.table === 'artist_notifications')!.filters).toEqual(expect.arrayContaining([['ref', 'match-p'], ['kind', 'Probe inquiry']]))
    expect(selects.filter((c) => c.table === 'inquiry_sources')[1].filters).toEqual(expect.arrayContaining([['source', 'test-probe'], ['id>', 41]]))

    const [rec] = writes(w.db.calls, 'probe_runs', 'insert')
    expect(rec.payload).toMatchObject({ ok: true, error: null, ref: 'match-p', checks: { posted: true, logged: true, match: true, source: true } })

    // Cleanup: the log row is detached first, then the lead goes.
    const detach = writes(w.db.calls, 'artist_notifications', 'update')[0]
    expect(detach.payload).toEqual({ match_id: null })
    expect(detach.filters).toContainEqual(['match_id', 'match-p'])
    const del = writes(w.db.calls, 'matches', 'delete')[0]
    expect(del.filters).toEqual(expect.arrayContaining([['id', 'match-p'], ['client_email', 'system-probe@elitetatz.invalid']]))
    expect(w.db.calls.indexOf(detach)).toBeLessThan(w.db.calls.indexOf(del))

    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('one missing row fails the run, names the miss, records it, and alerts Erica', async () => {
    const w = world({ log: null })
    const r = await w.run()
    expect(r.ok).toBe(false)
    expect(r.checks).toEqual({ posted: true, logged: false, match: true, source: true })
    expect(r.error).toContain('no artist_notifications row for this run')
    expect(writes(w.db.calls, 'probe_runs', 'insert')[0].payload).toMatchObject({ ok: false, checks: { logged: false } })
    // Its lead is still cleaned up.
    expect(writes(w.db.calls, 'matches', 'delete')).toHaveLength(1)
    expect(alertOperator).toHaveBeenCalledTimes(1)
    const alert = alertOperator.mock.calls[0][0]
    expect(alert.subject).toBe('Daily probe FAILED (logged)')
    expect(alert.text).toContain('artist-email step logged NO')
    expect(alert.text).toContain('force=1')
  })

  test('a source row from an earlier run does not count for this one', async () => {
    const r = await world({ source: false }).run()
    expect(r.checks).toEqual({ posted: true, logged: true, match: true, source: false })
    expect(alertOperator.mock.calls[0][0].subject).toBe('Daily probe FAILED (source)')
  })

  test('a probe row that was actually sent is a failure too: a probe must mail nobody', async () => {
    const w = world({ log: { status: 'sent' } })
    const r = await w.run()
    expect(r.ok).toBe(false)
    expect(r.error).toContain('logged as sent, not skipped')
    expect(alertOperator).toHaveBeenCalledTimes(1)
  })

  test('when the route does not recognise the probe (no ref), the run fails and deletes nothing', async () => {
    // The key did not verify, so the route handled it as a real inquiry: that is a failed probe.
    const w = world({ ref: null })
    const r = await w.run()
    expect(r.ok).toBe(false)
    expect(r.checks).toEqual({ posted: true, logged: false, match: false, source: false })
    expect(r.error).toContain('did not treat the request as the probe')
    expect(writes(w.db.calls, 'matches', 'delete')).toHaveLength(0)
    expect(alertOperator).toHaveBeenCalledTimes(1)
  })

  test('a row that does not carry the probe tag is never deleted', async () => {
    const w = world({ match: 'untagged' })
    const r = await w.run()
    expect(r.checks.match).toBe(false)
    expect(writes(w.db.calls, 'matches', 'delete')).toHaveLength(0)
    expect(writes(w.db.calls, 'artist_notifications', 'update')).toHaveLength(0)
  })

  test('when the form route itself fails, none of the run’s rows are looked for and the response is in the alert', async () => {
    const w = world({}, 500)
    const r = await w.run()
    expect(r.checks).toEqual({ posted: false, logged: false, match: false, source: false })
    expect(w.db.calls.filter((c) => c.op === 'select' && c.table !== 'inquiry_sources')).toHaveLength(0)
    expect(alertOperator.mock.calls[0][0].text).toContain('500')
  })

  test('refuses to file the probe under Lacey’s address, and to run unsigned', async () => {
    process.env.PROBE_INBOX_EMAIL = 'Lacey@RawSunArt.com'
    let w = world()
    let r = await w.run()
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/never be filed under her address/)
    expect(w.fetchImpl).not.toHaveBeenCalled()

    delete process.env.PROBE_INBOX_EMAIL
    delete process.env.CRON_SECRET
    w = world()
    r = await w.run()
    expect(r.error).toContain('CRON_SECRET is not set')
    expect(w.fetchImpl).not.toHaveBeenCalled()
    expect(alertOperator).toHaveBeenCalledTimes(2)
  })

  test('only the 9 AM Eastern tick runs; the other cron hour is skipped, and force overrides', async () => {
    const w = world()
    expect((await w.run(Date.parse('2026-11-10T13:00:00Z'))).skipped).toMatch(/9 AM Eastern/) // 8 AM EST
    expect(w.fetchImpl).not.toHaveBeenCalled()
    expect((await w.run(Date.parse('2026-07-15T13:00:00Z'))).ok).toBe(true) // 9 AM EDT
    expect((await world().run(Date.parse('2026-11-10T20:00:00Z'), true)).ok).toBe(true)
  })
})

describe('verifiedProbe', () => {
  const tag = 'probe-2026-11-10-0a1b2c3d'

  test('accepts only the tag’s own key, signed with CRON_SECRET', () => {
    const key = probeKey(tag)!
    expect(verifiedProbe(tag, key, NOW)).toBe(true)
    expect(verifiedProbe(tag, key.replace(/.$/, key.endsWith('0') ? '1' : '0'), NOW)).toBe(false)
    expect(verifiedProbe('probe-2026-11-10-ffffffff', key, NOW)).toBe(false)
    expect(verifiedProbe(tag, null, NOW)).toBe(false)
    expect(verifiedProbe(tag, '', NOW)).toBe(false)
    expect(verifiedProbe(undefined, key, NOW)).toBe(false)
    expect(verifiedProbe('test-probe', key, NOW)).toBe(false)
    process.env.CRON_SECRET = 'another-secret'
    expect(verifiedProbe(tag, key, NOW)).toBe(false)
  })

  test('a key is good for its own day only, and nothing verifies without a secret', () => {
    const key = probeKey(tag)!
    expect(verifiedProbe(tag, key, NOW + 30 * 3_600_000)).toBe(true) // the next day
    expect(verifiedProbe(tag, key, NOW + 5 * 86_400_000)).toBe(false) // replayed next week
    expect(verifiedProbe(tag, key, NOW - 3 * 86_400_000)).toBe(false)
    delete process.env.CRON_SECRET
    expect(probeKey(tag)).toBeNull()
    expect(verifiedProbe(tag, key, NOW)).toBe(false)
  })
})
