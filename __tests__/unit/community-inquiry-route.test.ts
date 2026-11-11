/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// The rule under test: every form inquiry reaches Lacey's email, whatever
// else fails, and nothing real is turned away silently.

const notifyArtist = jest.fn()
const notifyClient = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/notify', () => ({
  notifyArtist: (...a: unknown[]) => notifyArtist(...a),
  notifyClient: (...a: unknown[]) => notifyClient(...a),
}))
const alertOperator = jest.fn().mockResolvedValue({ emailed: true, slacked: false })
jest.mock('@/lib/alert', () => ({ alertOperator: (...a: unknown[]) => alertOperator(...a) }))
let turnstile = true
jest.mock('@/lib/turnstile', () => ({ passesTurnstile: async () => turnstile }))
let db: ReturnType<typeof fakeDb> | null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => (db ? db.db : null) }))

import { POST } from '@/app/api/community/inquiry/route'
import { probeKey } from '@/lib/probe-tag'

const ARTIST = { id: 'artist-1', payout_preference: null }
const form = {
  name: 'Ana Ruiz',
  email: 'Ana@Example.com',
  concept: 'Small watercolor fern on the ankle',
  placement: 'outer ankle',
  size: '2 inches',
  style: 'watercolor',
  budget: '$400–$700',
  location: 'columbus',
  reference: 'Something like the fern print in my kitchen',
  found_via: 'instagram',
  turnstileToken: 'tok',
}

const post = (body: unknown, ip = '203.0.113.9', extraHeaders: Record<string, string> = {}) =>
  POST(new Request('http://x/api/community/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://rawsunart.com', 'x-forwarded-for': ip, ...extraHeaders },
    body: JSON.stringify(body),
  }))

// What /api/cron/probe sends: the label, a run tag dated today, and the tag signed with CRON_SECRET.
const probeTag = () => `probe-${new Date().toISOString().slice(0, 10)}-0a1b2c3d`
const probeForm = (tag = probeTag()) => ({ ...form, name: 'System Probe', email: 'system-probe@elitetatz.invalid', concept: `Daily system check ${tag}`, found_via: 'test-probe', probe_tag: tag })
const signed = (tag = probeTag()) => ({ 'x-probe-key': probeKey(tag)! })

// Each test posts from its own IP so the per-IP limit never trips across tests.
let ipN = 0
const nextIp = () => `203.0.113.${++ipN}`

// The usual database: the artist exists, no inquiry from this person today.
const normalDb = (extra?: (c: Call) => { data?: unknown; error?: unknown } | undefined) =>
  fakeDb((c: Call) => {
    if (c.table === 'artists') return { data: ARTIST }
    if (c.table === 'matches' && c.op === 'select') return { data: [] }
    return extra?.(c)
  })

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  process.env.MATCH_TOKEN_SECRET = 'a'.repeat(64)
  process.env.CRON_SECRET = 'cron-secret'
  turnstile = true
  db = normalDb()
  notifyArtist.mockReset().mockResolvedValue({ emailed: true, logId: 'log-1' })
  notifyClient.mockClear()
  alertOperator.mockClear()
})

describe('rawsunart.com inquiry form', () => {
  test('emails Lacey first, with the whole form and the client as reply-to, then saves, counts and confirms', async () => {
    const res = await post(form, nextIp())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, portal: true, emailed: true })

    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.replyTo).toBe('ana@example.com')
    expect(notice.kind).toBe('New inquiry')
    expect(notice.subject).not.toContain('possible bot')
    for (const line of ['From: Ana Ruiz', 'Email: ana@example.com', 'Idea: Small watercolor fern', 'Placement: outer ankle', 'Budget: $400–$700', 'Found you via: instagram', 'Notes: Something like the fern'])
      expect(notice.text).toContain(line)
    expect(notice.matchId).toBeNull() // not written yet when the email went

    // The email went before the match was written.
    const calls = db!.calls
    const matchInsertAt = calls.findIndex((c) => c.table === 'matches' && c.op === 'insert')
    expect(matchInsertAt).toBeGreaterThan(-1)
    expect(notifyArtist.mock.invocationCallOrder[0]).toBeLessThan(0 + Number.MAX_SAFE_INTEGER)

    const [match] = writes(calls, 'matches', 'insert')
    const row = match.payload as Record<string, unknown>
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(row.client_email).toBe('ana@example.com')
    expect(JSON.parse(String(row.client_brief))).toMatchObject({ found_via: 'instagram', bot_check: 'passed', budget_min_cents: 40000, budget_max_cents: 70000 })
    expect(notice.ref).toBe(row.id)

    // The log row written before the match gets the match attached.
    const [attach] = writes(calls, 'artist_notifications', 'update')
    expect(attach.payload).toEqual({ match_id: row.id })
    expect(attach.filters).toContainEqual(['id', 'log-1'])

    // Exactly one source row, server-side.
    expect(writes(calls, 'inquiry_sources', 'insert')).toHaveLength(1)
    expect(writes(calls, 'inquiry_sources', 'insert')[0].payload).toEqual({ artist_handle: 'rawsunart', source: 'instagram' })

    expect(notifyClient).toHaveBeenCalledTimes(1)
    expect(notifyClient.mock.calls[0][0].email).toBe('ana@example.com')
    expect(notifyClient.mock.calls[0][0].text).toContain(`https://elitetatz.app/inquiry/${row.id}?t=`)
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('a failed bot check is accepted and tagged, never a 403', async () => {
    turnstile = false
    const res = await post(form, nextIp())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, portal: true, emailed: true, unverified: true })
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.subject).toMatch(/^\[possible bot\] Inquiry:/)
    expect(notice.kind).toBe('New inquiry (unverified)')
    const [match] = writes(db!.calls, 'matches', 'insert')
    expect(JSON.parse(String((match.payload as Record<string, unknown>).client_brief)).bot_check).toBe('failed')
    const sys = writes(db!.calls, 'match_messages', 'insert')[0].payload as Array<{ body: string }>
    expect(sys[0].body).toContain('bot check did not pass')
  })

  test('the honeypot still gets a fake success and nothing is sent or saved', async () => {
    const res = await post({ ...form, _gotcha: 'http://spam' }, nextIp())
    expect(res.status).toBe(200)
    expect(notifyArtist).not.toHaveBeenCalled()
    expect(db!.calls).toHaveLength(0)
  })

  test('when the match insert fails, Lacey still has the email and Erica is told', async () => {
    db = normalDb((c) => (c.table === 'matches' && c.op === 'insert' ? { error: { message: 'connection refused' } } : undefined))
    const res = await post(form, nextIp())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, portal: false, emailed: true })
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyClient).not.toHaveBeenCalled() // no inquiry page to point at
    expect(alertOperator).toHaveBeenCalledTimes(1)
    expect(alertOperator.mock.calls[0][0].subject).toContain('email only')
    expect(alertOperator.mock.calls[0][0].text).toContain('connection refused')
    // The alert never carries the client's details.
    expect(alertOperator.mock.calls[0][0].text).not.toContain('Ana')
    expect(alertOperator.mock.calls[0][0].text).not.toContain('example.com')
  })

  test('with no database at all, the email still goes', async () => {
    db = null
    const res = await post(form, nextIp())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, portal: false, emailed: true })
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(alertOperator).toHaveBeenCalledTimes(1)
  })

  test('both copies lost: 500 so the site opens the mail app, and Erica is told', async () => {
    db = null
    notifyArtist.mockResolvedValue({ emailed: false, error: 'resend 500: boom', logId: null })
    const res = await post(form, nextIp())
    expect(res.status).toBe(500)
    expect(alertOperator).toHaveBeenCalledTimes(1)
    expect(alertOperator.mock.calls[0][0].subject).toContain('LOST both ways')
  })

  test('a second form from the same person today joins their open inquiry and still emails Lacey', async () => {
    db = fakeDb((c: Call) => {
      if (c.table === 'artists') return { data: ARTIST }
      if (c.table === 'matches' && c.op === 'select') return { data: [{ id: 'match-prior' }] }
      return undefined
    })
    const res = await post({ ...form, concept: 'Forgot to say: I can do weekdays' }, nextIp())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, portal: true, emailed: true, duplicate: true })
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.kind).toBe('Inquiry follow-up')
    expect(notice.matchId).toBe('match-prior')
    expect(notice.replyTo).toBe('ana@example.com')
    expect(notice.text).toContain('I can do weekdays')
    expect(writes(db!.calls, 'matches', 'insert')).toHaveLength(0)
    expect(writes(db!.calls, 'inquiry_sources', 'insert')).toHaveLength(0)
    const [msg] = writes(db!.calls, 'match_messages', 'insert')
    expect(msg.payload).toMatchObject({ match_id: 'match-prior', sender: 'client' })
    expect(notifyClient).not.toHaveBeenCalled()
  })

  test('the signed daily probe walks the same path, mails nobody, gets no receipt, and is always a fresh inquiry', async () => {
    notifyArtist.mockResolvedValue({ emailed: false, skipped: true, logId: 'log-1' })
    const res = await post(probeForm(), nextIp(), signed())
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toMatchObject({ ok: true, portal: true, emailed: false })

    // Her email step is reached and told to send nothing.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice).toMatchObject({ kind: 'Probe inquiry', skip: 'probe: not sent by design' })
    expect(notice.subject).toMatch(/^\[test-probe\] Inquiry:/)

    // No "did this person write today?" lookup: yesterday's probe must not turn today's into a follow-up.
    expect(db!.calls.filter((c) => c.table === 'matches' && c.op === 'select')).toHaveLength(0)
    const [match] = writes(db!.calls, 'matches', 'insert')
    const row = match.payload as Record<string, unknown>
    expect(JSON.parse(String(row.client_brief))).toMatchObject({ found_via: 'test-probe' })
    expect(writes(db!.calls, 'inquiry_sources', 'insert')[0].payload).toEqual({ artist_handle: 'rawsunart', source: 'test-probe' })
    // Only the probe is told which row it made.
    expect(out.ref).toBe(row.id)

    expect(notifyClient).not.toHaveBeenCalled()
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('"test-probe" without a valid key is a real inquiry: emailed, receipted, stored as direct, never muted', async () => {
    // A visitor who arrived with ?utm_source=test-probe, or anyone posting the label.
    const cases: Array<[string, Record<string, unknown>, Record<string, string>]> = [
      ['no key at all', { ...form, found_via: 'test-probe' }, {}],
      ['a made-up key', probeForm(), { 'x-probe-key': 'f'.repeat(64) }],
      ['a real key for a different tag', probeForm(), signed(`probe-${new Date().toISOString().slice(0, 10)}-ffffffff`)],
      ['a real key for a stale tag', probeForm('probe-2026-01-01-0a1b2c3d'), signed('probe-2026-01-01-0a1b2c3d')],
    ]
    for (const [name, body, headers] of cases) {
      db = normalDb()
      notifyArtist.mockClear(); notifyClient.mockClear()
      const res = await post(body, nextIp(), headers)
      const out = await res.json()
      expect({ name, out }).toEqual({ name, out: { ok: true, portal: true, emailed: true } }) // no ref
      const notice = notifyArtist.mock.calls[0][0]
      expect(notice.skip ?? null).toBeNull()
      expect(notice.kind).toBe('New inquiry')
      expect(notice.subject).not.toContain('test-probe')
      expect(notice.text).toContain('Found you via: direct')
      const [match] = writes(db!.calls, 'matches', 'insert')
      const brief = String((match.payload as Record<string, unknown>).client_brief)
      expect(JSON.parse(brief).found_via).toBe('direct')
      expect(brief).not.toContain('test-probe')
      expect(writes(db!.calls, 'inquiry_sources', 'insert')[0].payload).toEqual({ artist_handle: 'rawsunart', source: 'direct' })
      expect(notifyClient).toHaveBeenCalledTimes(1) // the client gets their receipt
      // And the repeat lookup runs, as for any client.
      expect(db!.calls.filter((c) => c.table === 'matches' && c.op === 'select')).toHaveLength(1)
    }
  })

  test('an unsigned "test-probe" whose portal write fails still alerts, like any inquiry', async () => {
    db = normalDb((c) => (c.table === 'matches' && c.op === 'insert' ? { error: { message: 'connection refused' } } : undefined))
    const res = await post({ ...form, found_via: 'test-probe' }, nextIp())
    expect(await res.json()).toEqual({ ok: true, portal: false, emailed: true })
    expect(alertOperator).toHaveBeenCalledTimes(1)
  })

  test('with no CRON_SECRET nothing can be a probe', async () => {
    const headers = signed()
    delete process.env.CRON_SECRET
    const res = await post(probeForm(), nextIp(), headers)
    expect(await res.json()).toEqual({ ok: true, portal: true, emailed: true })
    expect(notifyArtist.mock.calls[0][0].skip ?? null).toBeNull()
  })

  test('a signed probe whose portal write fails is not alerted by the route: the probe run reads the rows and reports once', async () => {
    notifyArtist.mockResolvedValue({ emailed: false, skipped: true, logId: 'log-1' })
    db = normalDb((c) => (c.table === 'matches' && c.op === 'insert' ? { error: { message: 'connection refused' } } : undefined))
    // Nothing was mailed (by design) and nothing was saved: a 500, so the probe sees it.
    expect((await post(probeForm(), nextIp(), signed())).status).toBe(500)
    expect(alertOperator).not.toHaveBeenCalled()
  })

  test('400 when the name, email or idea is missing', async () => {
    expect((await post({ ...form, email: 'nope' }, nextIp())).status).toBe(400)
    expect((await post({ ...form, concept: '' }, nextIp())).status).toBe(400)
    expect(notifyArtist).not.toHaveBeenCalled()
  })
})
