/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// The rawsunart.com form since Nov 19 2026 (dev file F4, F6, F7): reference
// photos in her one email, an optional phone with a text-consent box, and one
// confirmation to the client with a copy of what they sent.

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
let db: (SupabaseClient & { calls: Call[] }) | null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import { POST, cleanPhone, TEXT_OK_WORDING } from '@/app/api/community/inquiry/route'
import { signPhoto, type Photo } from '@/lib/inquiry-photos'
import { probeKey } from '@/lib/probe-tag'

const ARTIST = { id: 'artist-1', payout_preference: null }
const form = {
  name: 'Ana Ruiz', email: 'ana@example.com', concept: 'Small watercolor fern on the ankle', placement: 'outer ankle',
  size: 'Small (under 3")', style: 'Watercolor', budget: '$400–$700', location: 'columbus', reference: 'Like the print in my kitchen',
  found_via: 'instagram', turnstileToken: 'tok',
}
const photo = (n: number, ext = 'jpg'): Photo => ({ path: `inquiry-uploads/2026-11-19/uuid-${n}-ref.${ext}`, name: `ref-${n}.${ext}`, mime: ext === 'png' ? 'image/png' : 'image/jpeg', size: 1000 + n })

let ipN = 0
const post = (body: unknown, extra: Record<string, string> = {}) =>
  POST(new Request('http://x/api/community/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://rawsunart.com', 'x-forwarded-for': `192.0.2.${++ipN}`, ...extra },
    body: JSON.stringify(body),
  }))

interface Opts { signError?: boolean; attachError?: boolean; matchError?: boolean }
function world(opts: Opts = {}) {
  const f = fakeDb((c: Call) => {
    if (c.table === 'artists') return { data: ARTIST }
    if (c.table === 'matches' && c.op === 'select') return { data: [] }
    if (c.table === 'matches' && c.op === 'insert' && opts.matchError) return { error: { message: 'connection refused' } }
    if (c.table === 'lead_attachments' && c.op === 'insert') return opts.attachError ? { error: { message: 'down' } } : { data: (c.payload as unknown[]).map((_, i) => ({ id: `att-${i}` })) }
    return undefined
  })
  const bucket = {
    createSignedUrls: async (paths: string[], seconds: number) =>
      opts.signError ? { data: null, error: { message: 'storage down' } } : { data: paths.map((path) => ({ path, signedUrl: `https://files.test/${path}?exp=${seconds}` })), error: null },
  }
  return Object.assign(f.db as unknown as Record<string, unknown>, { storage: { from: () => bucket }, calls: f.calls }) as unknown as SupabaseClient & { calls: Call[] }
}
const brief = () => JSON.parse(String((writes(db!.calls, 'matches', 'insert')[0].payload as Record<string, unknown>).client_brief)) as Record<string, unknown>

let writesWhenEmailed = -1
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://elitetatz.app'
  process.env.MATCH_TOKEN_SECRET = 'a'.repeat(64)
  process.env.CRON_SECRET = 'cron-secret'
  delete process.env.ARTIST_SMS_NUMBER
  turnstile = true
  db = world()
  writesWhenEmailed = -1
  notifyArtist.mockReset().mockImplementation(async () => {
    writesWhenEmailed = db ? db.calls.filter((c) => c.op !== 'select').length : 0
    return { emailed: true, logId: 'log-1' }
  })
  notifyClient.mockReset().mockResolvedValue(undefined)
  alertOperator.mockClear()
})

describe('F4: reference photos', () => {
  it('two photos reach her inbox once, as thumbnails, and sit on the card', async () => {
    const res = await post({ ...form, photos: [signPhoto(photo(1)), signPhoto(photo(2, 'png'))] })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, portal: true, emailed: true, photos: 2, receipt: true })

    // One email to her, with both photos in it.
    expect(notifyArtist).toHaveBeenCalledTimes(1)
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.images).toEqual([
      { url: 'https://files.test/inquiry-uploads/2026-11-19/uuid-1-ref.jpg?exp=2592000', name: 'ref-1.jpg' },
      { url: 'https://files.test/inquiry-uploads/2026-11-19/uuid-2-ref.png?exp=2592000', name: 'ref-2.png' },
    ])
    expect(notice.text).toContain('Photos: 2 photos, below')
    // Still sent before anything was written: a database problem cannot lose the inquiry.
    expect(writesWhenEmailed).toBe(0)

    // The card: a row per photo, pointing at the file where it already is.
    const [rows] = writes(db!.calls, 'lead_attachments', 'insert')
    expect(rows.payload).toEqual([
      expect.objectContaining({ storage_path: 'inquiry-uploads/2026-11-19/uuid-1-ref.jpg', filename: 'ref-1.jpg', mime: 'image/jpeg', source: 'web' }),
      expect.objectContaining({ storage_path: 'inquiry-uploads/2026-11-19/uuid-2-ref.png', filename: 'ref-2.png', mime: 'image/png', source: 'web' }),
    ])
    const matchId = (writes(db!.calls, 'matches', 'insert')[0].payload as { id: string }).id
    expect((rows.payload as { match_id: string }[]).every((r) => r.match_id === matchId)).toBe(true)
    expect(brief()).toMatchObject({ photos: 2, has_reference: true })
    const sys = (writes(db!.calls, 'match_messages', 'insert')[0].payload as { body: string }[])[0]
    expect(sys.body).toContain('2 photos attached.')

    // The client is told they arrived.
    expect(notifyClient).toHaveBeenCalledTimes(1)
    expect(notifyClient.mock.calls[0][0].text).toContain('Photos: 2 received')
    expect(alertOperator).not.toHaveBeenCalled()
  })

  it('photos that failed to upload never hold the inquiry: it is delivered, she is told, and the client is told to text them', async () => {
    const res = await post({ ...form, photos: [], photos_failed: 2 })
    expect(await res.json()).toMatchObject({ ok: true, portal: true, emailed: true, photos: 0 })
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.images).toEqual([])
    expect(notice.text).toContain('Photos: 2 photos did not come through; Ana was told to text them to 614-858-5574')
    expect(notifyClient.mock.calls[0][0].text).toContain('2 photos did not attach. Text them to 614-858-5574 and they will reach Lacey.')
    expect(brief()).toMatchObject({ photos_failed: 2 })
    expect(writes(db!.calls, 'lead_attachments', 'insert')).toHaveLength(0)
  })

  it('one arrived and one did not: both are said, in her email and in the client’s', async () => {
    await post({ ...form, photos: [signPhoto(photo(1))], photos_failed: 1 })
    expect(notifyArtist.mock.calls[0][0].text).toContain('Photos: 1 photo, below. 1 photo did not come through; Ana was told to text it to 614-858-5574')
    const text = notifyClient.mock.calls[0][0].text as string
    expect(text).toContain('Photos: 1 received')
    expect(text).toContain('One photo did not attach. Text it to 614-858-5574 and it will reach Lacey.')
  })

  it('a ticket that is forged, expired or names a file outside the upload folder is nothing', async () => {
    const stale = signPhoto(photo(1), Date.now() - 3 * 3600_000)
    const outside = signPhoto({ ...photo(2), path: 'some-match-id/private.jpg' })
    const res = await post({ ...form, photos: ['made.up', stale, outside, 42, null] })
    expect(await res.json()).toMatchObject({ ok: true, photos: 0 })
    expect(notifyArtist.mock.calls[0][0].images).toEqual([])
    expect(notifyArtist.mock.calls[0][0].text).toContain('Photos: none')
    expect(writes(db!.calls, 'lead_attachments', 'insert')).toHaveLength(0)
  })

  it('no more than five, however many tickets arrive', async () => {
    const res = await post({ ...form, photos: Array.from({ length: 9 }, (_, i) => signPhoto(photo(i))) })
    expect((await res.json()).photos).toBe(5)
    expect(notifyArtist.mock.calls[0][0].images).toHaveLength(5)
  })

  it('when links cannot be made her email still goes and says where the photos are', async () => {
    db = world({ signError: true })
    const res = await post({ ...form, photos: [signPhoto(photo(1))] })
    expect(await res.json()).toMatchObject({ ok: true, emailed: true, photos: 1 })
    const notice = notifyArtist.mock.calls[0][0]
    expect(notice.images).toEqual([])
    expect(notice.text).toContain('Photos: 1 photo, on the card in your inbox (links could not be made for this email)')
    expect(writes(db!.calls, 'lead_attachments', 'insert')).toHaveLength(1)
  })

  it('a photo that cannot be put on the card is not quiet: Erica is told, and the inquiry is still whole', async () => {
    db = world({ attachError: true })
    const res = await post({ ...form, photos: [signPhoto(photo(1))] })
    expect(await res.json()).toMatchObject({ ok: true, portal: true, emailed: true })
    expect(alertOperator).toHaveBeenCalledTimes(1)
    expect(alertOperator.mock.calls[0][0].subject).toContain('Inquiry photos not on the card')
    expect(alertOperator.mock.calls[0][0].text).not.toContain('Ana')
  })

  it('with the portal write failing, her email still has the photos and the alert says they have no lead', async () => {
    db = world({ matchError: true })
    const res = await post({ ...form, photos: [signPhoto(photo(1))] })
    expect(await res.json()).toMatchObject({ ok: true, portal: false, emailed: true })
    expect(notifyArtist.mock.calls[0][0].images).toHaveLength(1)
    expect(alertOperator.mock.calls[0][0].text).toContain('It came with 1 photo')
  })

  it('the daily probe carries no photos', async () => {
    const tag = `probe-${new Date().toISOString().slice(0, 10)}-0a1b2c3d`
    notifyArtist.mockResolvedValue({ emailed: false, skipped: true, logId: 'log-1' })
    await post({ ...form, name: 'System Probe', email: 'system-probe@elitetatz.invalid', found_via: 'test-probe', probe_tag: tag, photos: [signPhoto(photo(1))], photos_failed: 3 }, { 'x-probe-key': probeKey(tag)! })
    expect(notifyArtist.mock.calls[0][0].images).toEqual([])
    expect(writes(db!.calls, 'lead_attachments', 'insert')).toHaveLength(0)
  })
})

describe('F7: an optional phone, and a box that starts unticked', () => {
  it('a number with the box ticked: her email says she may text, and the consent is stored with the time and the words', async () => {
    await post({ ...form, phone: '(614) 555-0100', text_ok: true })
    expect(notifyArtist.mock.calls[0][0].text).toContain('Phone: (614) 555-0100 (ticked "OK to text me about this inquiry")')
    const b = brief()
    expect(b).toMatchObject({ contact_phone: '(614) 555-0100', text_ok: true, text_ok_wording: TEXT_OK_WORDING })
    expect(new Date(String(b.text_ok_at)).getTime()).toBeGreaterThan(Date.now() - 60_000)
  })

  it('a number with the box left alone: she may call, and is told not to text', async () => {
    await post({ ...form, phone: '614-555-0100' })
    expect(notifyArtist.mock.calls[0][0].text).toContain('Phone: 614-555-0100 (did not tick "OK to text": call or email, do not text)')
    const b = brief()
    expect(b).toMatchObject({ contact_phone: '614-555-0100', text_ok: false })
    expect(b.text_ok_at).toBeUndefined()
    expect(notifyClient.mock.calls[0][0].text).toContain('Phone: 614-555-0100 (no texts)')
  })

  it('nothing automatic can text the number: it is never put where the portal texts from', async () => {
    await post({ ...form, phone: '614-555-0100', text_ok: 'on' })
    const row = writes(db!.calls, 'matches', 'insert')[0].payload as Record<string, unknown>
    expect(row).not.toHaveProperty('client_phone')
    expect(brief()).not.toHaveProperty('client_phone')
    // Her own notice and the client's confirmation go by email only.
    expect(notifyClient.mock.calls[0][0]).not.toHaveProperty('phone')
    expect(notifyClient.mock.calls[0][0]).not.toHaveProperty('sms')
  })

  it('a ticked box with no number, or something that is not a number, is no consent at all', async () => {
    await post({ ...form, text_ok: true })
    expect(notifyArtist.mock.calls[0][0].text).toContain('Phone: not given')
    expect(brief()).not.toHaveProperty('contact_phone')
    expect(brief()).not.toHaveProperty('text_ok')
    await post({ ...form, phone: 'call me maybe', text_ok: true })
    expect(notifyArtist.mock.calls[1][0].text).toContain('Phone: not given')
  })

  it('cleanPhone keeps what was typed when it has enough digits to be a number', () => {
    expect(cleanPhone(' 614.555.0100 ')).toBe('614.555.0100')
    expect(cleanPhone('+1 (614) 555-0100')).toBe('+1 (614) 555-0100')
    expect(cleanPhone('614-555-0100 <script>')).toBe('614-555-0100')
    expect(cleanPhone('12345')).toBe('')
    expect(cleanPhone('')).toBe('')
    expect(cleanPhone(null)).toBe('')
    expect(cleanPhone('1'.repeat(30))).toBe('')
  })
})

describe('F6: one confirmation, with a copy of what they sent', () => {
  it('says what happens next, repeats their inquiry, and gives their page', async () => {
    await post(form)
    expect(notifyClient).toHaveBeenCalledTimes(1)
    const sent = notifyClient.mock.calls[0][0]
    expect(sent.email).toBe('ana@example.com')
    const text = sent.text as string
    expect(text).toContain('Hey Ana,')
    expect(text).toContain('Got it. Lacey reads every inquiry herself and replies within two days (she is in the studio Wednesday to Saturday).')
    for (const line of ['What you sent:', 'Idea: Small watercolor fern on the ankle', 'Placement: outer ankle', 'Size: Small (under 3")', 'Style: Watercolor', 'Budget: $400–$700', 'Where: The studio (AION Tattoo)', 'Notes: Like the print in my kitchen', 'Phone: not given', 'Photos: none'])
      expect(text).toContain(line)
    expect(text).toContain('Want to add a photo? Text it to 614-858-5574.')
    expect(text).toMatch(/Your inquiry page: https:\/\/elitetatz\.app\/inquiry\/[0-9a-f-]{36}\?t=/)
    // What she sees and how she was found are not the client's business.
    expect(text).not.toContain('Found you via')
    expect(text).not.toContain('dashboard')
  })

  it('their own words go back without links, so the form cannot mail a stranger a link under her name', async () => {
    await post({ ...form, concept: 'See https://evil.example/login and www.evil.example now', reference: 'http://evil.example' })
    const text = notifyClient.mock.calls[0][0].text as string
    expect(text).toContain('Idea: See evil.example/login and evil.example now')
    expect(text).not.toMatch(/https?:\/\/evil/)
    expect(text).not.toContain('www.evil')
    // Her copy is untouched: she needs to see exactly what was written.
    expect(notifyArtist.mock.calls[0][0].text).toContain('Idea: See https://evil.example/login and www.evil.example now')
  })

  it('when the bot check did not pass, the confirmation carries no copy of the message at all', async () => {
    turnstile = false
    await post({ ...form, concept: 'Buy cheap pills at evil.example' })
    expect(notifyClient).toHaveBeenCalledTimes(1)
    const text = notifyClient.mock.calls[0][0].text as string
    expect(text).toContain('Got it.')
    expect(text).not.toContain('What you sent')
    expect(text).not.toContain('pills')
  })

  it('a confirmation that fails to send does not fail the inquiry', async () => {
    notifyClient.mockRejectedValue(new Error('resend down'))
    const res = await post(form)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, portal: true, emailed: true, receipt: false })
  })
})
