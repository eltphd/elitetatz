/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeDb, type Call } from '../helpers/fake-db'

// Photos on the rawsunart.com inquiry form (F4, Nov 19 2026). They are sent
// ahead of the inquiry so Lacey's one email can show them; a ticket proves
// the server stored each one; a photo that fails never holds the inquiry up.

const heic = jest.fn()
jest.mock('heic-convert', () => ({ __esModule: true, default: (...a: unknown[]) => heic(...a) }))
let db: (SupabaseClient & { calls: Call[] }) | null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))

import {
  sniffPhoto, signPhoto, verifyPhoto, verifiedPhotos, storePendingPhoto, photoLinks, attachPhotos, sweepPendingPhotos,
  MAX_PHOTOS, MAX_PHOTO_BYTES, type Photo,
} from '@/lib/inquiry-photos'
import { POST, OPTIONS } from '@/app/api/community/inquiry/photo/route'
import { signStamp } from '@/lib/tokens'
import { imagesHtml, imagesText } from '@/lib/notify'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 0, 0x48])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52])
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, 0x31])
const SCRIPT = new TextEncoder().encode('<script>alert(1)</script> padding padding')

interface Storage { uploads: { path: string; type: string; size: number }[]; removed: string[]; uploadError?: string; signError?: string; folders?: Record<string, string[]> }

function world(rows?: (c: Call) => { data?: unknown; error?: unknown } | undefined) {
  const s: Storage = { uploads: [], removed: [] }
  const f = fakeDb(rows)
  const bucket = {
    upload: async (path: string, bytes: Uint8Array, opts: { contentType: string }) => {
      if (s.uploadError) return { error: { message: s.uploadError } }
      s.uploads.push({ path, type: opts.contentType, size: bytes.byteLength })
      return { error: null }
    },
    createSignedUrls: async (paths: string[], seconds: number) =>
      s.signError ? { data: null, error: { message: s.signError } } : { data: paths.map((path) => ({ path, signedUrl: `https://files.test/${path}?exp=${seconds}` })), error: null },
    list: async (prefix: string) => {
      const folders = s.folders ?? {}
      if (prefix === 'inquiry-uploads') return { data: Object.keys(folders).map((name) => ({ name })), error: null }
      return { data: (folders[prefix.split('/')[1]] ?? []).map((name) => ({ name })), error: null }
    },
    remove: async (paths: string[]) => { s.removed.push(...paths); return { error: null } },
  }
  const client = Object.assign(f.db as unknown as Record<string, unknown>, { storage: { from: () => bucket }, calls: f.calls }) as unknown as SupabaseClient & { calls: Call[] }
  return { db: client, s, calls: f.calls }
}

const ENV = { ...process.env }
const NOW = Date.parse('2026-11-19T18:00:00Z')
beforeEach(() => {
  process.env = { ...ENV, MATCH_TOKEN_SECRET: 'test-secret' }
  heic.mockReset().mockResolvedValue(JPEG.buffer)
  db = null
})
afterAll(() => { process.env = { ...ENV } })

describe('what counts as a photo', () => {
  it('is read from the bytes, never from the name: JPEG, PNG and iPhone HEIC', () => {
    expect(sniffPhoto(JPEG)).toBe('image/jpeg')
    expect(sniffPhoto(PNG)).toBe('image/png')
    expect(sniffPhoto(HEIC)).toBe('image/heic')
    expect(sniffPhoto(PDF)).toBeNull()
    expect(sniffPhoto(SCRIPT)).toBeNull()
    expect(sniffPhoto(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
})

describe('storing one photo', () => {
  it('a JPEG goes to the private bucket under the day, with no database row', async () => {
    const w = world()
    const r = await storePendingPhoto(w.db, { name: 'My Fern (1).JPG', bytes: JPEG }, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.photo.path).toMatch(/^inquiry-uploads\/2026-11-19\/[0-9a-f-]{36}-My Fern _1_\.jpg$/)
    expect(r.photo).toMatchObject({ name: 'My Fern _1_.jpg', mime: 'image/jpeg', size: JPEG.byteLength })
    expect(w.s.uploads).toEqual([{ path: r.photo.path, type: 'image/jpeg', size: JPEG.byteLength }])
    expect(w.calls).toHaveLength(0)
  })
  it('an iPhone HEIC is stored as a JPEG, so it shows in her mail app', async () => {
    const w = world()
    const r = await storePendingPhoto(w.db, { name: 'IMG_0042.HEIC', bytes: HEIC }, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(heic).toHaveBeenCalledTimes(1)
    expect(r.photo).toMatchObject({ name: 'IMG_0042.jpg', mime: 'image/jpeg' })
    expect(w.s.uploads[0].type).toBe('image/jpeg')
  })
  it('a HEIC that will not convert is refused, not stored as something her mail cannot show', async () => {
    heic.mockRejectedValue(new Error('bad file'))
    const w = world()
    expect(await storePendingPhoto(w.db, { name: 'x.heic', bytes: HEIC }, NOW)).toMatchObject({ ok: false, status: 422 })
    expect(w.s.uploads).toHaveLength(0)
  })
  it('refuses what is not a photo, whatever it is called, and anything empty or over 10 MB', async () => {
    const w = world()
    expect(await storePendingPhoto(w.db, { name: 'fern.jpg', bytes: PDF }, NOW)).toMatchObject({ ok: false, status: 415 })
    expect(await storePendingPhoto(w.db, { name: 'fern.png', bytes: SCRIPT }, NOW)).toMatchObject({ ok: false, status: 415 })
    expect(await storePendingPhoto(w.db, { name: 'fern.jpg', bytes: new Uint8Array(0) }, NOW)).toMatchObject({ ok: false, status: 400 })
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1); big.set(JPEG)
    expect(await storePendingPhoto(w.db, { name: 'big.jpg', bytes: big }, NOW)).toMatchObject({ ok: false, status: 413 })
    expect(w.s.uploads).toHaveLength(0)
  })
  it('says so when storage will not take it', async () => {
    const w = world(); w.s.uploadError = 'bucket down'
    expect(await storePendingPhoto(w.db, { name: 'fern.jpg', bytes: JPEG }, NOW)).toMatchObject({ ok: false, status: 502 })
  })
})

describe('the ticket', () => {
  const photo: Photo = { path: 'inquiry-uploads/2026-11-19/abc-fern.jpg', name: 'fern.jpg', mime: 'image/jpeg', size: 1234 }
  it('proves the server stored that file, for two hours', () => {
    const t = signPhoto(photo, NOW)
    expect(verifyPhoto(t, NOW)).toEqual(photo)
    expect(verifyPhoto(t, NOW + 119 * 60_000)).toEqual(photo)
    expect(verifyPhoto(t, NOW + 121 * 60_000)).toBeNull()
  })
  it('cannot be edited to point at another file, and a made-up one is nothing', () => {
    const [payload, sig] = signPhoto(photo, NOW).split('.')
    const other = Buffer.from(JSON.stringify({ p: 'match-1/someone-elses.jpg', n: 'x.jpg', m: 'image/jpeg', s: 1, e: NOW + 60_000 })).toString('base64url')
    expect(verifyPhoto(`${other}.${sig}`, NOW)).toBeNull()
    expect(verifyPhoto(`${payload}.${'A'.repeat(sig.length)}`, NOW)).toBeNull()
    for (const junk of [null, undefined, 42, '', 'abc', 'a.b', { p: photo.path }]) expect(verifyPhoto(junk, NOW)).toBeNull()
  })
  it('only ever names a file in the pending folder, even when signed with the right key', () => {
    // A leaked key still cannot be used to mint a link to a file on someone's lead.
    expect(verifyPhoto(signPhoto({ ...photo, path: 'match-1/private.jpg' }, NOW), NOW)).toBeNull()
    expect(verifyPhoto(signPhoto({ ...photo, path: 'inquiry-uploads/../match-1/private.jpg' }, NOW), NOW)).toBeNull()
  })
  it('an inquiry carries five at most, each file once, bad ones dropped', () => {
    const many = Array.from({ length: 8 }, (_, i) => signPhoto({ ...photo, path: `inquiry-uploads/2026-11-19/${i}.jpg` }, NOW))
    expect(verifiedPhotos(many, NOW)).toHaveLength(MAX_PHOTOS)
    expect(verifiedPhotos([many[0], many[0], 'junk', many[1]], NOW).map((p) => p.path)).toEqual(['inquiry-uploads/2026-11-19/0.jpg', 'inquiry-uploads/2026-11-19/1.jpg'])
    expect(verifiedPhotos('not a list', NOW)).toEqual([])
    expect(verifiedPhotos(undefined, NOW)).toEqual([])
  })
  it('without the signing secret in production there are no photos at all', () => {
    const t = signPhoto(photo, NOW)
    delete process.env.MATCH_TOKEN_SECRET
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    expect(verifyPhoto(t, NOW)).toBeNull()
  })
})

describe('her email and her card', () => {
  const photos: Photo[] = [
    { path: 'inquiry-uploads/2026-11-19/a-fern.jpg', name: 'fern.jpg', mime: 'image/jpeg', size: 100 },
    { path: 'inquiry-uploads/2026-11-19/b-ankle.png', name: 'ankle.png', mime: 'image/png', size: 200 },
  ]
  it('links open without a sign-in and last 30 days', async () => {
    const links = await photoLinks(world().db, photos)
    expect(links).toEqual([
      { url: 'https://files.test/inquiry-uploads/2026-11-19/a-fern.jpg?exp=2592000', name: 'fern.jpg' },
      { url: 'https://files.test/inquiry-uploads/2026-11-19/b-ankle.png?exp=2592000', name: 'ankle.png' },
    ])
  })
  it('never throws: with storage down there are simply no links', async () => {
    const w = world(); w.s.signError = 'down'
    expect(await photoLinks(w.db, photos)).toEqual([])
    expect(await photoLinks(w.db, [])).toEqual([])
  })
  it('thumbnails she can tap, and plain links for the text part', () => {
    const images = [{ url: 'https://files.test/a.jpg?token=x&y="z"', name: 'fern <1>.jpg' }, { url: 'https://files.test/b.png', name: 'ankle.png' }]
    const html = imagesHtml(images)
    expect(html).toContain('2 photos they sent.')
    expect(html).toContain('<img src="https://files.test/a.jpg?token=x&amp;y=&quot;z&quot;" alt="fern &lt;1&gt;.jpg" width="150"')
    expect((html.match(/<img /g) ?? []).length).toBe(2)
    expect(imagesText(images)).toContain('1. fern <1>.jpg: https://files.test/a.jpg?token=x&y="z"')
    expect(imagesHtml([])).toBe('')
    expect(imagesText([])).toBe('')
  })
  it('each photo gets a row on the lead, pointing at the file where it already is', async () => {
    const w = world((c) => (c.table === 'lead_attachments' ? { data: [{ id: '1' }, { id: '2' }] } : undefined))
    expect(await attachPhotos(w.db, 'match-1', null, photos)).toBe(2)
    expect(w.calls[0].payload).toEqual([
      { match_id: 'match-1', message_id: null, storage_path: photos[0].path, filename: 'fern.jpg', mime: 'image/jpeg', size_bytes: 100, source: 'web' },
      { match_id: 'match-1', message_id: null, storage_path: photos[1].path, filename: 'ankle.png', mime: 'image/png', size_bytes: 200, source: 'web' },
    ])
    expect(await attachPhotos(w.db, 'match-1', null, [])).toBe(0)
    const broken = world((c) => (c.table === 'lead_attachments' ? { error: { message: 'down' } } : undefined))
    expect(await attachPhotos(broken.db, 'match-1', null, photos)).toBe(0)
  })
})

describe('POST /api/community/inquiry/photo', () => {
  let n = 0
  const send = (file: File | null, ts: string | null = signStamp(Date.now() - 10_000)) => {
    const fd = new FormData()
    if (file) fd.append('file', file)
    if (ts) fd.append('ts', ts)
    return POST(new Request('http://x/api/community/inquiry/photo', { method: 'POST', headers: { origin: 'https://rawsunart.com', 'x-forwarded-for': `198.51.100.${++n}` }, body: fd }))
  }
  const jpg = () => new File([JPEG], 'fern.jpg', { type: 'image/jpeg' })

  it('stores the photo and hands back a ticket the inquiry can carry', async () => {
    const w = world(); db = w.db
    const res = await send(jpg())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://rawsunart.com')
    const out = await res.json()
    expect(out).toMatchObject({ ok: true, name: 'fern.jpg' })
    expect(verifyPhoto(out.ticket)).toMatchObject({ name: 'fern.jpg', mime: 'image/jpeg', path: w.s.uploads[0].path })
    // No row, no email: the file belongs to no lead yet.
    expect(w.calls).toHaveLength(0)
  })
  it('needs the page-load stamp: a script that never loaded the page has none', async () => {
    const w = world(); db = w.db
    expect((await send(jpg(), null)).status).toBe(403)
    expect((await send(jpg(), 'made.up')).status).toBe(403)
    expect((await send(jpg(), signStamp(Date.now()))).status).toBe(403) // posted the instant the page loaded
    expect((await send(jpg(), signStamp(Date.now() - 25 * 3600_000))).status).toBe(403) // a stamp from yesterday
    expect(w.s.uploads).toHaveLength(0)
  })
  it('turns away what is not a photo, and says why in words the form can show', async () => {
    const w = world(); db = w.db
    const res = await send(new File([PDF], 'fern.jpg', { type: 'image/jpeg' }))
    expect(res.status).toBe(415)
    expect((await res.json()).error).toBe('Photos only: JPG, PNG or HEIC')
    expect((await send(null)).status).toBe(400)
    expect(w.s.uploads).toHaveLength(0)
  })
  it('with storage down the form is told, so it can send the inquiry without the photo', async () => {
    db = null
    expect((await send(jpg())).status).toBe(503)
    const w = world(); w.s.uploadError = 'down'; db = w.db
    expect((await send(jpg())).status).toBe(502)
  })
  it('answers the browser preflight', () => {
    expect(OPTIONS(new Request('http://x', { method: 'OPTIONS', headers: { origin: 'https://rawsunart.com' } })).status).toBe(204)
  })
})

describe('the sweep', () => {
  it('removes photos nobody claimed after three days, and never one that is on a lead', async () => {
    const w = world((c) => (c.table === 'lead_attachments' ? { data: [{ storage_path: 'inquiry-uploads/2026-11-10/kept.jpg' }] } : undefined))
    w.s.folders = { '2026-11-10': ['kept.jpg', 'orphan.jpg'], '2026-11-15': ['old-orphan.png'], '2026-11-18': ['yesterday.jpg'], '2026-11-19': ['today.jpg'], notes: ['x'] }
    const r = await sweepPendingPhotos(w.db, NOW)
    // Two whole days are old enough to look at; today, yesterday and anything that is not a day are left alone.
    expect(r).toEqual({ folders: 2, removed: 2 })
    expect(w.s.removed.sort()).toEqual(['inquiry-uploads/2026-11-10/orphan.jpg', 'inquiry-uploads/2026-11-15/old-orphan.png'])
    expect(w.s.removed).not.toContain('inquiry-uploads/2026-11-10/kept.jpg')
    expect(w.s.removed.some((p) => p.includes('2026-11-18') || p.includes('2026-11-19'))).toBe(false)
  })
  it('if the lookup fails, nothing in that folder is removed', async () => {
    const w = world((c) => (c.table === 'lead_attachments' ? { error: { message: 'down' } } : undefined))
    w.s.folders = { '2026-11-10': ['a.jpg'] }
    expect(await sweepPendingPhotos(w.db, NOW)).toEqual({ folders: 1, removed: 0 })
    expect(w.s.removed).toEqual([])
  })
})
