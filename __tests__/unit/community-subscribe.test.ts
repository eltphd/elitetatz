/**
 * @jest-environment node
 */
import { fakeDb, writes, type Responder } from '../helpers/fake-db'
import { signStamp } from '@/lib/tokens'

// Collectors Club sign-up, called from rawsunart.com. The first eight rows were
// bots, so the route stacks honeypot, signed stamp, Turnstile and address
// hygiene, and logs every refusal. These tests pin each layer and the
// once-only welcome email.

let respond: Responder = () => undefined
let current = fakeDb()
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => current.db }))

const sendEmail = jest.fn()
jest.mock('@/lib/resend', () => {
  const actual = jest.requireActual('@/lib/resend')
  return { ...actual, sendEmail: (...a: unknown[]) => sendEmail(...a) }
})

const track = jest.fn()
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => track(...a) }))

import { POST } from '@/app/api/community/subscribe/route'

const MEMBER_ID = '33333333-3333-3333-3333-333333333333'
let ipSeq = 0

function post(body: Record<string, unknown>) {
  // A fresh address per request: the route allows 5 an hour per IP.
  ipSeq += 1
  return POST(
    new Request('https://test.local/api/community/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${ipSeq}`, 'user-agent': 'jest' },
    })
  )
}

const ageAStamp = () => signStamp(Date.now() - 10_000)
const rejections = () => writes(current.calls, 'join_rejections', 'insert').map((c) => (c.payload as { reason: string }).reason)
const memberWrites = () => current.calls.filter((c) => c.table === 'community_members' && c.op !== 'select')

beforeEach(() => {
  process.env.MATCH_TOKEN_SECRET = 'test-secret'
  delete process.env.TURNSTILE_SECRET_KEY
  sendEmail.mockReset().mockResolvedValue(true)
  track.mockReset().mockResolvedValue(undefined)
  respond = () => undefined
  current = fakeDb((c) => respond(c))
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('bot layers', () => {
  it('gives a filled honeypot a fake success and writes nothing', async () => {
    const res = await post({ email: 'sam@example.com', website: 'http://spam.example', ts: ageAStamp() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(memberWrites()).toHaveLength(0)
    expect(rejections()).toEqual(['honeypot'])
    expect(sendEmail).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })

  it('asks for a reload when the page stamp is missing', async () => {
    const res = await post({ email: 'sam@example.com' })
    expect(res.status).toBe(400)
    expect(rejections()).toEqual(['stamp_missing'])
  })

  it('fakes success for a post made seconds after the page loaded', async () => {
    const res = await post({ email: 'sam@example.com', ts: signStamp(Date.now()) })
    expect(res.status).toBe(200)
    expect(memberWrites()).toHaveLength(0)
    expect(rejections()).toEqual(['stamp_fast'])
  })

  it('fakes success for a forged stamp', async () => {
    const res = await post({ email: 'sam@example.com', ts: `${(Date.now() - 10_000).toString(36)}.not-a-signature` })
    expect(res.status).toBe(200)
    expect(memberWrites()).toHaveLength(0)
    expect(rejections()).toEqual(['stamp_forged'])
  })

  it('refuses with 403 when Turnstile rejects the token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'ts_secret'
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ success: false, 'error-codes': ['invalid-input-response'] }))
    const res = await post({ email: 'sam@example.com', ts: ageAStamp(), turnstileToken: 'tok' })
    expect(res.status).toBe(403)
    expect(rejections()).toEqual(['turnstile'])
    expect(memberWrites()).toHaveLength(0)
  })

  it('refuses a Turnstile token minted for another form', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'ts_secret'
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ success: true, action: 'inquiry', hostname: 'rawsunart.com' }))
    const res = await post({ email: 'sam@example.com', ts: ageAStamp(), turnstileToken: 'tok' })
    expect(res.status).toBe(403)
  })
})

describe('address hygiene', () => {
  it.each([
    ['info@rawsunart.com', 'role'],
    ['someone@mailinator.com', 'disposable'],
  ])('refuses %s as %s', async (email, reason) => {
    const res = await post({ email, ts: ageAStamp() })
    expect(res.status).toBe(400)
    expect(rejections()).toEqual([reason])
    expect(memberWrites()).toHaveLength(0)
  })

  it('refuses something that is not an email', async () => {
    const res = await post({ email: 'not an email', ts: ageAStamp() })
    expect(res.status).toBe(400)
    expect(rejections()).toEqual(['invalid_email'])
  })
})

describe('a real sign-up', () => {
  it('saves the member and sends one welcome with a confirm link', async () => {
    respond = (c) => {
      if (c.table === 'community_members' && c.op === 'select') return { data: null }
      if (c.table === 'community_members' && c.op === 'insert') return { data: { id: MEMBER_ID } }
      return undefined
    }
    const res = await post({ email: ' Sam@Example.com ', name: 'Sam Lee', source: 'hell-city-qr', ts: ageAStamp() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, memberId: MEMBER_ID })

    const [insert] = writes(current.calls, 'community_members', 'insert')
    expect(insert!.payload).toEqual({ artist_handle: 'rawsunart', email: 'sam@example.com', name: 'Sam Lee', source: 'hell-city-qr' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('sam@example.com')
    expect(sendEmail.mock.calls[0][0].text).toContain(`/api/community/confirm?id=${MEMBER_ID}`)
    expect(writes(current.calls, 'community_members', 'update').some((c) => 'welcome_sent_at' in (c.payload as object))).toBe(true)
    expect(rejections()).toEqual([])
    expect(track).toHaveBeenCalledWith('club_joined', expect.any(Request), { source: 'hell-city-qr' })
  })

  it('does not stamp welcome_sent_at when the email did not go out', async () => {
    sendEmail.mockResolvedValue(false)
    respond = (c) => {
      if (c.table === 'community_members' && c.op === 'select') return { data: null }
      if (c.table === 'community_members' && c.op === 'insert') return { data: { id: MEMBER_ID } }
      return undefined
    }
    await post({ email: 'sam@example.com', ts: ageAStamp() })
    expect(writes(current.calls, 'community_members', 'update')).toHaveLength(0)
  })

  it('never re-welcomes or resurrects someone who unsubscribed', async () => {
    respond = (c) =>
      c.table === 'community_members' && c.op === 'select'
        ? { data: { id: MEMBER_ID, unsubscribed_at: '2026-10-01T00:00:00Z', welcome_sent_at: '2026-09-01T00:00:00Z', confirmed_at: null } }
        : undefined
    const res = await post({ email: 'sam@example.com', ts: ageAStamp() })
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
    expect(writes(current.calls, 'community_members', 'insert')).toHaveLength(0)
    const [upd] = writes(current.calls, 'community_members', 'update')
    expect(upd!.payload).not.toHaveProperty('unsubscribed_at')
  })

  it('does not send a second welcome to an existing member', async () => {
    respond = (c) =>
      c.table === 'community_members' && c.op === 'select'
        ? { data: { id: MEMBER_ID, unsubscribed_at: null, welcome_sent_at: '2026-09-01T00:00:00Z', confirmed_at: '2026-09-01T00:05:00Z' } }
        : undefined
    await post({ email: 'sam@example.com', ts: ageAStamp() })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('rate limit', () => {
  it('turns away the sixth post from one address within the hour', async () => {
    const send = () =>
      POST(new Request('https://test.local/api/community/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: 'sam@example.com', website: 'x' }),
        headers: { 'x-forwarded-for': '198.51.100.7' },
      }))
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(200)
    expect((await send()).status).toBe(429)
  })
})
