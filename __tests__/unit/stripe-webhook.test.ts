/**
 * @jest-environment node
 */
import Stripe from 'stripe'
import { fakeDb, writes, type Responder } from '../helpers/fake-db'

// The webhook is the only thing that marks a deposit paid and moves money, and
// Stripe retries and double-delivers. These tests pin the guards: signature,
// idempotency, the conditional status flip, the 80% transfer, and 500-to-retry.

const WEBHOOK_SECRET = 'whsec_test_secret'
const real = new Stripe('sk_test_dummy')
const transfersCreate = jest.fn()

jest.mock('@/lib/stripe', () => {
  const actual = jest.requireActual('@/lib/stripe')
  return {
    ...actual,
    // Getters: jest hoists this factory above the constants it reads.
    stripe: { get webhooks() { return real.webhooks }, transfers: { create: (...a: unknown[]) => transfersCreate(...a) } },
  }
})

let respond: Responder = () => undefined
let current = fakeDb()
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => current.db }))

const notifyArtist = jest.fn()
const notifyClient = jest.fn()
jest.mock('@/lib/notify', () => ({
  notifyArtist: (...a: unknown[]) => notifyArtist(...a),
  notifyClient: (...a: unknown[]) => notifyClient(...a),
}))

const track = jest.fn()
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => track(...a) }))

import { POST } from '@/app/api/webhooks/stripe/route'

const MATCH_ID = '11111111-1111-1111-1111-111111111111'
const ARTIST_ID = '22222222-2222-2222-2222-222222222222'

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID, status: 'accepted', artist_id: ARTIST_ID,
    offered_price_cents: 60000, final_price_cents: null, appointment_at: null, proposed_dates: 'Nov 3 or 4',
    payout_target: 'artist', client_name: 'Sam', client_email: 'sam@example.com', client_phone: null,
    client_brief: JSON.stringify({ concept: 'Watercolor hummingbird' }), ai_summary: null, stripe_transfer_id: null,
    ...overrides,
  }
}

function event(type: string, object: Record<string, unknown>) {
  return { id: 'evt_1', object: 'event', type, data: { object } }
}

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return { id: 'pi_1', object: 'payment_intent', amount: 10000, currency: 'usd', latest_charge: 'ch_1', metadata: { match_id: MATCH_ID }, ...overrides }
}

function signedRequest(body: unknown, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(body)
  const sig = real.webhooks.generateTestHeaderString({ payload, secret })
  return new Request('https://test.local/api/webhooks/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': sig } })
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.MATCH_TOKEN_SECRET = 'test-secret'
  transfersCreate.mockReset().mockResolvedValue({ id: 'tr_1' })
  notifyArtist.mockReset().mockResolvedValue(undefined)
  notifyClient.mockReset().mockResolvedValue(undefined)
  track.mockReset().mockResolvedValue(undefined)
  respond = () => undefined
  current = fakeDb((c) => respond(c))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('signature', () => {
  it('refuses a request with no signature header', async () => {
    const res = await POST(new Request('https://test.local', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
    expect(current.calls).toHaveLength(0)
  })

  it('refuses a payload signed with another secret', async () => {
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent()), 'whsec_wrong'))
    expect(res.status).toBe(400)
    expect(current.calls).toHaveLength(0)
  })
})

describe('payment_intent.succeeded', () => {
  function withMatch(m: Record<string, unknown>, artist: Record<string, unknown> | null, flipped = true): Responder {
    return (c) => {
      if (c.table === 'matches' && c.op === 'select') return { data: m }
      if (c.table === 'matches' && c.op === 'update' && c.returning) return { data: flipped ? [{ id: MATCH_ID }] : [] }
      if (c.table === 'artists' && c.op === 'select') return { data: artist }
      return undefined
    }
  }

  it('flips an accepted match to paid only from its current status, and keeps the quote', async () => {
    respond = withMatch(match(), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: null, shop_stripe_account_id: null, shop_name: null })
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(200)

    const [flip] = writes(current.calls, 'matches', 'update')
    expect(flip!.filters).toEqual([['id', MATCH_ID], ['status', 'accepted']])
    expect(flip!.payload).toMatchObject({ status: 'paid', stripe_payment_intent_id: 'pi_1', final_price_cents: 60000 })
    expect((flip!.payload as { booked_at?: string }).booked_at).toEqual(expect.any(String))
  })

  it('marks the match booked when an appointment is already set', async () => {
    respond = withMatch(match({ appointment_at: '2026-11-03T15:00:00Z' }), null)
    await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(writes(current.calls, 'matches', 'update')[0]!.payload).toMatchObject({ status: 'booked' })
  })

  it('sends 80% to the connected account, tied to the charge', async () => {
    respond = withMatch(match(), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: 'acct_lacey', shop_stripe_account_id: null, shop_name: null })
    await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(transfersCreate).toHaveBeenCalledTimes(1)
    expect(transfersCreate.mock.calls[0][0]).toMatchObject({ amount: 8000, currency: 'usd', destination: 'acct_lacey', source_transaction: 'ch_1', transfer_group: MATCH_ID })
    expect(writes(current.calls, 'matches', 'update').some((c) => (c.payload as { stripe_transfer_id?: string }).stripe_transfer_id === 'tr_1')).toBe(true)
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    expect(notifyClient).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('deposit_paid', expect.any(Request), { amount_usd: 100, payout: 'sent', target: 'artist' })
  })

  it('pays the shop account when the match says so', async () => {
    respond = withMatch(match({ payout_target: 'shop' }), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: 'acct_lacey', shop_stripe_account_id: 'acct_shop', shop_name: 'AION Tattoo' })
    await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(transfersCreate.mock.calls[0][0]).toMatchObject({ destination: 'acct_shop' })
  })

  it('holds the money on the platform when no account is connected', async () => {
    respond = withMatch(match(), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: null, shop_stripe_account_id: null, shop_name: null })
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(200)
    expect(transfersCreate).not.toHaveBeenCalled()
    const notes = writes(current.calls, 'match_messages', 'insert').map((c) => (c.payload as { body: string }).body)
    expect(notes.some((b) => b.includes('held by TatzAI'))).toBe(true)
    expect(track).toHaveBeenCalledWith('deposit_paid', expect.any(Request), { amount_usd: 100, payout: 'held', target: 'artist' })
  })

  it('still answers 200 when the transfer itself fails, so Stripe does not re-run the flip', async () => {
    transfersCreate.mockRejectedValueOnce(new Error('account not ready'))
    respond = withMatch(match(), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: 'acct_lacey', shop_stripe_account_id: null, shop_name: null })
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(200)
  })

  it.each(['paid', 'booked', 'completed'])('ignores a repeat delivery for a %s match', async (status) => {
    respond = withMatch(match({ status }), null)
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(200)
    expect(writes(current.calls, 'matches', 'update')).toHaveLength(0)
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(notifyArtist).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })

  it('does nothing more when a concurrent delivery won the flip', async () => {
    respond = withMatch(match(), { id: ARTIST_ID, name: 'Lacey Rawson', stripe_account_id: 'acct_lacey', shop_stripe_account_id: null, shop_name: null }, false)
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(200)
    expect(transfersCreate).not.toHaveBeenCalled()
    expect(notifyArtist).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })

  it('answers 500 when the database write fails, so Stripe retries', async () => {
    respond = (c) => {
      if (c.table === 'matches' && c.op === 'select') return { data: match() }
      if (c.table === 'matches' && c.op === 'update') return { error: { message: 'connection reset' } }
      return undefined
    }
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent())))
    expect(res.status).toBe(500)
    expect(transfersCreate).not.toHaveBeenCalled()
  })

  it('ignores a payment that is not for a match', async () => {
    const res = await POST(signedRequest(event('payment_intent.succeeded', paymentIntent({ metadata: {} }))))
    expect(res.status).toBe(200)
    expect(current.calls).toHaveLength(0)
  })
})

describe('payment_intent.payment_failed', () => {
  it('never un-pays a settled match', async () => {
    respond = (c) => (c.table === 'matches' && c.op === 'select' ? { data: match({ status: 'paid' }) } : undefined)
    await POST(signedRequest(event('payment_intent.payment_failed', paymentIntent())))
    expect(writes(current.calls, 'matches', 'update')).toHaveLength(0)
    expect(writes(current.calls, 'match_messages', 'insert')).toHaveLength(0)
  })

  it('leaves an accepted match retryable and notes the failure', async () => {
    respond = (c) => (c.table === 'matches' && c.op === 'select' ? { data: match() } : undefined)
    await POST(signedRequest(event('payment_intent.payment_failed', paymentIntent({ last_payment_error: { message: 'Card declined' } }))))
    expect(writes(current.calls, 'matches', 'update')).toHaveLength(0)
    const [note] = writes(current.calls, 'match_messages', 'insert')
    expect((note!.payload as { body: string }).body).toContain('Card declined')
  })
})

describe('account.updated', () => {
  it('marks onboarding complete once charges and payouts are enabled', async () => {
    respond = (c) =>
      c.table === 'artists' && c.op === 'select'
        ? { data: [{ id: ARTIST_ID, payout_preference: 'artist', stripe_account_id: 'acct_lacey', shop_stripe_account_id: null, stripe_onboarding_complete: false }] }
        : undefined
    await POST(signedRequest(event('account.updated', { id: 'acct_lacey', object: 'account', charges_enabled: true, payouts_enabled: true })))
    const [upd] = writes(current.calls, 'artists', 'update')
    expect(upd!.payload).toEqual({ stripe_onboarding_complete: true })
  })

  it('ignores an account the artist is not paid through', async () => {
    respond = (c) =>
      c.table === 'artists' && c.op === 'select'
        ? { data: [{ id: ARTIST_ID, payout_preference: 'artist', stripe_account_id: 'acct_lacey', shop_stripe_account_id: 'acct_shop', stripe_onboarding_complete: false }] }
        : undefined
    await POST(signedRequest(event('account.updated', { id: 'acct_shop', object: 'account', charges_enabled: true, payouts_enabled: true })))
    expect(writes(current.calls, 'artists', 'update')).toHaveLength(0)
  })
})
