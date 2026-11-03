import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Reference files live in one private bucket, one folder per lead, and are
// read only through short-lived signed URLs minted on the server for the
// artist's session or a client's signed inquiry link. Nothing here is public.

export const BUCKET = 'lead-files'
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
// Email signatures and tracking pixels are images too; anything this small is
// not a reference.
export const MIN_IMAGE_BYTES = 8 * 1024

export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
export const ALLOWED_MIMES = new Set([...IMAGE_MIMES, 'application/pdf'])

export interface AttachmentRow {
  id: string
  match_id: string
  message_id: string | null
  storage_path: string
  filename: string
  mime: string | null
  size_bytes: number | null
  source: string
  created_at: string
}

export function safeFilename(name: string): string {
  const base = (name || 'file').split(/[\\/]/).pop() ?? 'file'
  const cleaned = base.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120)
  return cleaned || 'file'
}

export function isImage(mime: string | null | undefined): boolean {
  return Boolean(mime && IMAGE_MIMES.has(mime.toLowerCase()))
}

export function mimeFromName(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
  }
  return map[ext] ?? fallback
}

export interface StoreArgs {
  matchId: string
  messageId?: string | null
  filename: string
  mime?: string | null
  bytes: ArrayBuffer | Uint8Array
  source: string
}

export async function storeAttachment(db: SupabaseClient, a: StoreArgs): Promise<AttachmentRow | null> {
  const size = a.bytes.byteLength
  if (size === 0 || size > MAX_ATTACHMENT_BYTES) return null
  const mime = (a.mime && a.mime !== 'application/octet-stream' ? a.mime : mimeFromName(a.filename)).toLowerCase()
  if (!ALLOWED_MIMES.has(mime)) return null
  if (isImage(mime) && size < MIN_IMAGE_BYTES) return null

  const filename = safeFilename(a.filename)
  const path = `${a.matchId}/${randomUUID()}-${filename}`
  const body = a.bytes instanceof Uint8Array ? a.bytes : new Uint8Array(a.bytes)
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, body, { contentType: mime, upsert: false })
  if (upErr) {
    console.error('attachment upload:', upErr.message)
    return null
  }
  const { data, error } = await db
    .from('lead_attachments')
    .insert({ match_id: a.matchId, message_id: a.messageId ?? null, storage_path: path, filename, mime, size_bytes: size, source: a.source })
    .select('id, match_id, message_id, storage_path, filename, mime, size_bytes, source, created_at')
    .single()
  if (error || !data) {
    console.error('attachment row:', error)
    return null
  }
  return data as AttachmentRow
}

// Download a file an adapter was handed a URL for. Headers are only sent when
// the caller says so (a Chatwoot token must never travel to another host).
export async function fetchBytes(
  url: string,
  opts: { headers?: Record<string, string>; maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ bytes: ArrayBuffer; mime: string | null } | null> {
  const max = opts.maxBytes ?? MAX_ATTACHMENT_BYTES
  try {
    const res = await fetch(url, { headers: opts.headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000), redirect: 'follow' })
    if (!res.ok) return null
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > max) return null
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength > max) return null
    const mime = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? null
    return { bytes, mime }
  } catch {
    return null
  }
}

// One hour is long enough to look at a card; the dashboard renders fresh ones
// on every load.
export async function signAttachments(db: SupabaseClient, rows: AttachmentRow[], seconds = 3600): Promise<Record<string, string>> {
  if (!rows.length) return {}
  const { data } = await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), seconds)
  const out: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) {
      const row = rows.find((r) => r.storage_path === item.path)
      if (row) out[row.id] = item.signedUrl
    }
  }
  return out
}

// For the assistant: the image itself, base64, in the shape the Anthropic API
// takes. Only common web formats under 5 MB (the API's limit).
export async function attachmentAsImageBlock(
  db: SupabaseClient,
  row: AttachmentRow,
): Promise<{ type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } } | null> {
  const mime = (row.mime ?? '').toLowerCase()
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) return null
  if ((row.size_bytes ?? 0) > 5 * 1024 * 1024) return null
  const { data, error } = await db.storage.from(BUCKET).download(row.storage_path)
  if (error || !data) return null
  const buf = Buffer.from(await data.arrayBuffer())
  return { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: buf.toString('base64') } }
}
