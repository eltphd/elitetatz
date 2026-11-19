import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET, safeFilename } from '@/lib/attachments'

// Photos on the rawsunart.com inquiry form (F4, Nov 19 2026). Custom work runs
// on references, and until now the form had only a text box.
//
// The order matters, because of two rules that pull against each other:
//
//   - Lacey gets ONE email per inquiry, and the photos have to be in it.
//   - Her email goes out BEFORE anything is written to the database, so a
//     database problem cannot lose an inquiry.
//
// So the photos travel first, on their own, and the inquiry follows:
//
//   1. The browser sends each photo to /api/community/inquiry/photo. It is
//      checked, turned into a JPEG if it is an iPhone HEIC, and put in the
//      private bucket under inquiry-uploads/<day>/. No database row. The
//      browser gets back a signed ticket for it.
//   2. The browser sends the inquiry with its tickets. The route checks each
//      ticket, mints 30-day links, and puts the thumbnails in her one email.
//   3. Once the lead exists, each photo gets its lead_attachments row and
//      shows on the card like any other reference file.
//
// A photo that fails at step 1 never blocks the inquiry: the form is sent
// without it, the client is told to text it, and her email says so too.
//
// A ticket is proof the server itself stored that file: without it, an
// inquiry could name any path in the bucket and be handed a link to it.
// Files uploaded and never claimed by an inquiry are swept after three days.

export const MAX_PHOTOS = 5
/** The size of one photo as it reaches the server. The form shrinks big ones in the browser first. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const PENDING_PREFIX = 'inquiry-uploads'
/** How long the links in her email keep working. The card keeps the photos after that. */
export const EMAIL_LINK_SECONDS = 30 * 24 * 3600
const TICKET_TTL_MS = 2 * 3600 * 1000
const SWEEP_AFTER_DAYS = 3

export type PhotoKind = 'image/jpeg' | 'image/png' | 'image/heic'

/**
 * What the bytes are, read from the bytes. The name and the type the browser
 * claims are not trusted. Only the three kinds the form takes: JPEG, PNG and
 * HEIC/HEIF (an iPhone original).
 */
export function sniffPhoto(bytes: Uint8Array): PhotoKind | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  // ISO base media: bytes 4..7 are "ftyp", then the brand.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase()
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
  }
  return null
}

/**
 * An iPhone HEIC as a JPEG, so it shows as a thumbnail in her mail app and on
 * the card. Most never get here: the form already converts in the browser when
 * the browser can read the file. This is for the ones it cannot (a HEIC picked
 * in Chrome on a laptop). Returns null when the file will not convert.
 */
export async function heicToJpeg(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { default: convert } = await import('heic-convert')
    const out = await convert({ buffer: bytes, format: 'JPEG', quality: 0.86 })
    return new Uint8Array(out)
  } catch (err) {
    console.warn('heic convert:', err instanceof Error ? err.message : err)
    return null
  }
}

// ---- tickets -----------------------------------------------------------------
function secret(): string | null {
  const s = process.env.MATCH_TOKEN_SECRET?.trim()
  if (s) return s
  return process.env.NODE_ENV === 'production' ? null : 'dev-only-secret'
}

/** Photos need the same secret the client links do. Without it the form simply takes none. */
export function photosConfigured(): boolean {
  return secret() !== null
}

export interface Photo {
  /** Where it sits in the private bucket. */
  path: string
  /** The name the client's file had, cleaned, with the extension it has now. */
  name: string
  mime: 'image/jpeg' | 'image/png'
  size: number
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const sign = (payload: string) => {
  const key = secret()
  if (!key) throw new Error('MATCH_TOKEN_SECRET is not set')
  return createHmac('sha256', key).update(`inquiry-photo.${payload}`).digest('base64url').slice(0, 32)
}

export function signPhoto(photo: Photo, now = Date.now()): string {
  const payload = b64(JSON.stringify({ p: photo.path, n: photo.name, m: photo.mime, s: photo.size, e: now + TICKET_TTL_MS }))
  return `${payload}.${sign(payload)}`
}

export function verifyPhoto(ticket: unknown, now = Date.now()): Photo | null {
  if (typeof ticket !== 'string' || ticket.length > 2000 || !photosConfigured()) return null
  const [payload, sig] = ticket.split('.')
  if (!payload || !sig) return null
  const want = Buffer.from(sign(payload))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; n?: unknown; m?: unknown; s?: unknown; e?: unknown }
    if (typeof v.p !== 'string' || !v.p.startsWith(`${PENDING_PREFIX}/`) || v.p.includes('..')) return null
    if (typeof v.e !== 'number' || v.e < now) return null
    if (v.m !== 'image/jpeg' && v.m !== 'image/png') return null
    return { path: v.p, name: typeof v.n === 'string' ? v.n : 'photo', mime: v.m, size: typeof v.s === 'number' ? v.s : 0 }
  } catch {
    return null
  }
}

/** The tickets an inquiry came with, checked, without repeats, five at most. */
export function verifiedPhotos(tickets: unknown, now = Date.now()): Photo[] {
  if (!Array.isArray(tickets)) return []
  const out: Photo[] = []
  const seen = new Set<string>()
  for (const t of tickets.slice(0, 20)) {
    const photo = verifyPhoto(t, now)
    if (!photo || seen.has(photo.path)) continue
    seen.add(photo.path)
    out.push(photo)
    if (out.length === MAX_PHOTOS) break
  }
  return out
}

// ---- storing -----------------------------------------------------------------
export type StoreResult = { ok: true; photo: Photo } | { ok: false; status: number; error: string }

const day = (now: number) => new Date(now).toISOString().slice(0, 10)

/**
 * Check one uploaded file and put it in the private bucket. No database row:
 * it belongs to no lead until an inquiry claims it with the ticket.
 */
export async function storePendingPhoto(db: SupabaseClient, file: { name: string; bytes: Uint8Array }, now = Date.now()): Promise<StoreResult> {
  if (!file.bytes.byteLength) return { ok: false, status: 400, error: 'That file is empty' }
  if (file.bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, status: 413, error: 'That photo is over 10 MB' }
  const kind = sniffPhoto(file.bytes)
  if (!kind) return { ok: false, status: 415, error: 'Photos only: JPG, PNG or HEIC' }

  let bytes = file.bytes
  let mime: Photo['mime'] = kind === 'image/png' ? 'image/png' : 'image/jpeg'
  if (kind === 'image/heic') {
    const jpeg = await heicToJpeg(file.bytes)
    if (!jpeg) return { ok: false, status: 422, error: 'That photo could not be read' }
    bytes = jpeg
    mime = 'image/jpeg'
  }

  const stem = safeFilename(file.name).replace(/\.[A-Za-z0-9]{2,5}$/, '').slice(0, 80) || 'photo'
  const name = `${stem}.${mime === 'image/png' ? 'png' : 'jpg'}`
  const path = `${PENDING_PREFIX}/${day(now)}/${randomUUID()}-${name}`
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false })
  if (error) {
    console.error('inquiry photo upload:', error.message)
    return { ok: false, status: 502, error: 'Could not save that photo' }
  }
  return { ok: true, photo: { path, name, mime, size: bytes.byteLength } }
}

export interface PhotoLink {
  url: string
  name: string
}

/**
 * Links for her email: they open without a sign-in and last 30 days. Never
 * throws; a photo that cannot be linked is left out and counted by the caller.
 */
export async function photoLinks(db: SupabaseClient, photos: Photo[]): Promise<PhotoLink[]> {
  if (!photos.length) return []
  try {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrls(photos.map((p) => p.path), EMAIL_LINK_SECONDS)
    if (error || !data) {
      console.error('inquiry photo links:', error?.message)
      return []
    }
    const out: PhotoLink[] = []
    for (const photo of photos) {
      const item = data.find((d) => d.path === photo.path)
      if (item?.signedUrl) out.push({ url: item.signedUrl, name: photo.name })
    }
    return out
  } catch (err) {
    console.error('inquiry photo links:', err)
    return []
  }
}

/** Put the photos on the lead, so the card shows them. Returns how many rows were written. */
export async function attachPhotos(db: SupabaseClient, matchId: string, messageId: string | null, photos: Photo[]): Promise<number> {
  if (!photos.length) return 0
  const { data, error } = await db
    .from('lead_attachments')
    .insert(photos.map((p) => ({ match_id: matchId, message_id: messageId, storage_path: p.path, filename: p.name, mime: p.mime, size_bytes: p.size, source: 'web' })))
    .select('id')
  if (error) {
    console.error('inquiry photo rows:', error.message)
    return 0
  }
  return Array.isArray(data) ? data.length : photos.length
}

// ---- the sweep ------------------------------------------------------------------
export interface PhotoSweep {
  folders: number
  removed: number
}

/**
 * Remove photos that were uploaded and never claimed by an inquiry: someone
 * picked files and left the page. Only whole days older than three days are
 * looked at, and a file with a lead_attachments row is never touched.
 */
export async function sweepPendingPhotos(db: SupabaseClient, now = Date.now()): Promise<PhotoSweep> {
  const cutoff = day(now - SWEEP_AFTER_DAYS * 86_400_000)
  const { data: folders, error } = await db.storage.from(BUCKET).list(PENDING_PREFIX, { limit: 200 })
  if (error) throw new Error(`list ${PENDING_PREFIX}: ${error.message}`)
  const old = (folders ?? []).map((f) => f.name).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < cutoff)
  let removed = 0
  for (const folder of old.slice(0, 30)) {
    const { data: files } = await db.storage.from(BUCKET).list(`${PENDING_PREFIX}/${folder}`, { limit: 500 })
    const paths = (files ?? []).map((f) => `${PENDING_PREFIX}/${folder}/${f.name}`)
    if (!paths.length) continue
    const { data: kept, error: keptErr } = await db.from('lead_attachments').select('storage_path').in('storage_path', paths)
    // If the lookup fails, nothing in this folder is removed: a photo on a lead must never be lost to a sweep.
    if (keptErr) continue
    const claimed = new Set(((kept ?? []) as { storage_path: string }[]).map((r) => r.storage_path))
    const orphans = paths.filter((p) => !claimed.has(p))
    if (!orphans.length) continue
    const { error: rmErr } = await db.storage.from(BUCKET).remove(orphans)
    if (!rmErr) removed += orphans.length
  }
  return { folders: old.length, removed }
}
