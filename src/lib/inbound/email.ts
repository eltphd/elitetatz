import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { ingest, type IngestOutcome, type NormalizedInbound } from '@/lib/inbound/ingest'

// Email into the inbox, by way of Resend's receiving API (the same mechanism
// that answers hello@woopsi.ink). Lacey's Gmail forwards an inquiry, or a
// client writes to the inbound address directly; either way the message, the
// real sender and the attached reference photos land on a lead.
//
// Env: RESEND_API_KEY, RESEND_WEBHOOK_SECRET (whsec_…), INBOUND_EMAIL_ADDRESS
// (the address Lacey forwards to; mail from the studio's own addresses is
// only read when it wraps a forwarded message).

// ---- Resend webhook signature (Svix scheme) ---------------------------------
export function verifyResendSignature(headers: Headers, rawBody: string, secret: string, now = Date.now()): boolean {
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sig = headers.get('svix-signature')
  if (!id || !ts || !sig) return false
  const age = Math.abs(now / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 5 * 60) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest()
  for (const part of sig.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    const given = Buffer.from(value, 'base64')
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true
  }
  return false
}

// ---- Resend receiving API ---------------------------------------------------
export interface ReceivedEmail {
  id: string
  from: string
  to: string[]
  subject: string | null
  text: string | null
  html: string | null
  message_id?: string | null
  headers?: Record<string, string> | { name: string; value: string }[] | null
  attachments?: ReceivedAttachment[] | null
}

export interface ReceivedAttachment {
  id?: string
  filename?: string | null
  content_type?: string | null
  size?: number | null
  download_url?: string | null
}

function resendKey(): string {
  const k = process.env.RESEND_API_KEY
  if (!k) throw new Error('RESEND_API_KEY is not set')
  return k
}

async function resendGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${resendKey()}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`resend receiving ${res.status}`)
  return (await res.json()) as T
}

export async function fetchReceived(id: string): Promise<ReceivedEmail> {
  return resendGet<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(id)}`)
}

// The list call may or may not carry download URLs; the detail call does.
export async function listAttachments(emailId: string): Promise<Array<{ url: string; filename: string; mime: string | null }>> {
  let items: ReceivedAttachment[] = []
  try {
    const listed = await resendGet<{ data?: ReceivedAttachment[] } | ReceivedAttachment[]>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments`)
    items = Array.isArray(listed) ? listed : listed.data ?? []
  } catch {
    return []
  }
  const out: Array<{ url: string; filename: string; mime: string | null }> = []
  for (const a of items.slice(0, 10)) {
    let url = a.download_url ?? null
    if (!url && a.id) {
      try {
        const detail = await resendGet<ReceivedAttachment>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(a.id)}`)
        url = detail.download_url ?? null
      } catch { /* skip this one */ }
    }
    if (url) out.push({ url, filename: a.filename || 'attachment', mime: a.content_type ?? null })
  }
  return out
}

// ---- Reading the message ----------------------------------------------------
export function header(mail: ReceivedEmail, name: string): string {
  const h = mail.headers
  if (!h) return ''
  const want = name.toLowerCase()
  if (Array.isArray(h)) return h.find((x) => x.name.toLowerCase() === want)?.value ?? ''
  for (const [k, v] of Object.entries(h)) if (k.toLowerCase() === want) return v
  return ''
}

/** Bare, lower-cased address out of "Name <addr>" or "addr". */
export function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim().toLowerCase().replace(/^mailto:/, '')
}

/** The display name out of "Name <addr>", or the part before @ as a last resort. */
export function displayName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/)
  if (m) return m[1].trim()
  const addr = bareAddress(from)
  const local = addr.split('@')[0] ?? ''
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Bounces, auto-replies and list mail never become leads. */
export function isAutomated(mail: ReceivedEmail): boolean {
  const from = bareAddress(mail.from)
  if (/^(mailer-daemon|postmaster|no-?reply|donotreply|notifications?|noreply)@/i.test(from)) return true
  const auto = header(mail, 'auto-submitted').toLowerCase()
  if (auto && auto !== 'no') return true
  if (/bulk|junk|list|auto_reply/i.test(header(mail, 'precedence'))) return true
  if (header(mail, 'x-auto-response-suppress')) return true
  if (header(mail, 'list-id') || header(mail, 'list-unsubscribe')) return true
  if (/^(auto|automatic)[\s-]*reply|out of (the )?office/i.test(mail.subject ?? '')) return true
  return false
}

export function ownAddresses(): Set<string> {
  const set = new Set<string>()
  const add = (v: string | undefined | null) => { if (v) set.add(bareAddress(v)) }
  add(ARTIST_CONFIG.email)
  add(ARTIST_CONFIG.fromEmail)
  add(process.env.ARTIST_NOTIFICATION_EMAIL)
  add(process.env.ARTIST_NOTIFICATION_CC)
  add(process.env.INBOUND_EMAIL_ADDRESS)
  add(process.env.DEFAULT_FROM_EMAIL)
  add(process.env.COMMUNITY_FROM_EMAIL)
  return set
}

// Plain text out of the message: the text part, else the HTML with tags gone.
export function textBody(mail: Pick<ReceivedEmail, 'text' | 'html'>): string {
  if (mail.text && mail.text.trim()) return mail.text.replace(/\r\n/g, '\n').trim()
  const html = mail.html ?? ''
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface Forwarded { from: string; subject: string | null; body: string }

// Lacey forwards an inquiry from her own inbox: the real sender is inside the
// message. Gmail's "---------- Forwarded message ---------" and Apple Mail's
// "Begin forwarded message:" are both read; the header block gives From and
// Subject, and the body is what follows it.
export function unwrapForward(text: string): Forwarded | null {
  const marker = text.match(/-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:|-{3,}\s*Original Message\s*-{3,}/i)
  if (!marker || marker.index == null) return null
  const after = text.slice(marker.index + marker[0].length).replace(/^\s+/, '')
  const lines = after.split('\n')
  let from = ''
  let subject: string | null = null
  let i = 0
  for (; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].trim()
    if (!line) { if (from) break; else continue }
    const m = line.match(/^\*?(From|Subject|Date|To|Cc|Sent|Reply-To)\*?\s*:\s*\*?(.*)$/i)
    if (!m) { if (from) break; else continue }
    if (/^from$/i.test(m[1])) from = m[2].replace(/\*/g, '').trim()
    if (/^subject$/i.test(m[1])) subject = m[2].replace(/\*/g, '').trim() || null
  }
  if (!from || !/@/.test(from)) return null
  const body = lines.slice(i).join('\n').trim()
  return { from, subject, body }
}

// Cut the quoted history off a reply so only the new words reach the thread.
export function stripQuoted(text: string): string {
  const cuts = [
    /^\s*On .{3,120}? wrote:\s*$/m,
    /^\s*-{3,}\s*Original Message\s*-{3,}\s*$/m,
    /^\s*From:\s.+\n\s*(Sent|Date):\s.+/m,
    /^\s*_{10,}\s*$/m,
    /^\s*Le .{3,120}? a écrit\s*:\s*$/m,
  ]
  let end = text.length
  for (const re of cuts) {
    const m = text.match(re)
    if (m && m.index != null && m.index < end) end = m.index
  }
  let out = text.slice(0, end)
  // Drop trailing quoted lines (">") and a bare signature separator.
  out = out.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n')
  const sig = out.search(/^\s*--\s*$/m)
  if (sig > 40) out = out.slice(0, sig)
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

export function normalizeEmail(mail: ReceivedEmail, attachments: Array<{ url: string; filename: string; mime: string | null }>): NormalizedInbound | { ignored: string } {
  if (isAutomated(mail)) return { ignored: 'automated' }

  let from = mail.from
  let subject = mail.subject ?? null
  let text = textBody(mail)
  const own = ownAddresses()

  if (own.has(bareAddress(from))) {
    const fwd = unwrapForward(text)
    if (!fwd) return { ignored: 'own-address' }
    from = fwd.from
    subject = fwd.subject ?? subject
    text = fwd.body
    if (own.has(bareAddress(from))) return { ignored: 'own-address' }
  } else {
    // A client replying to Lacey's forwarded copy of something: still unwrap.
    const fwd = unwrapForward(text)
    if (fwd && !own.has(bareAddress(fwd.from)) && bareAddress(fwd.from) === bareAddress(from)) text = fwd.body
  }

  const email = bareAddress(from)
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ignored: 'no-sender' }

  return {
    channel: 'email',
    externalId: `resend:${mail.id}`,
    externalThreadId: null,
    senderName: displayName(from),
    email,
    phone: null,
    text: stripQuoted(text),
    subject,
    attachments,
    meta: { message_id: mail.message_id ?? null },
  }
}

export async function handleInboundEmail(db: SupabaseClient, emailId: string): Promise<IngestOutcome> {
  const mail = await fetchReceived(emailId)
  const attachments = await listAttachments(emailId)
  const normalized = normalizeEmail(mail, attachments)
  if ('ignored' in normalized) return { outcome: 'ignored', reason: normalized.ignored }
  return ingest(db, normalized)
}
