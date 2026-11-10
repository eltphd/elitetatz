import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { ingest, recordArtistReply, type IngestOutcome, type NormalizedInbound } from '@/lib/inbound/ingest'

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

/**
 * The domain the intake address lives on (inbox.rawsunart.com). Resend
 * receives every address on that domain, so every address there is the
 * portal's own, whatever INBOUND_EMAIL_ADDRESS is set to today. That keeps an
 * older intake address working after the setting is renamed: a forward sent
 * to the old one is still read as a forward, not as a reply to a client.
 */
export function intakeDomain(): string | null {
  const addr = process.env.INBOUND_EMAIL_ADDRESS ? bareAddress(process.env.INBOUND_EMAIL_ADDRESS) : ''
  const domain = addr.split('@')[1]
  return domain || null
}

/** Is this address one of ours: a listed address, or anything on the intake domain? */
export function isOurs(address: string, own: Set<string> = ownAddresses()): boolean {
  const a = bareAddress(address)
  if (own.has(a)) return true
  const domain = intakeDomain()
  return Boolean(domain) && a.endsWith(`@${domain}`)
}

// The artist's own mailbox: where she reads and answers clients. Narrower than
// ownAddresses() on purpose. The sending address, the operator's copy and the
// intake address are ours but they are not her inbox, so mail seen there is
// not mail she has seen.
export function artistMailboxes(): Set<string> {
  const set = new Set<string>()
  const add = (v: string | undefined | null) => { if (v) set.add(bareAddress(v)) }
  add(ARTIST_CONFIG.email)
  add(process.env.ARTIST_NOTIFICATION_EMAIL)
  return set
}

const ADDRESS = /[^\s<>,;:"'()]+@[^\s<>,;:"'()]+\.[^\s<>,;:"'()]+/g

/**
 * Did this message pass through the artist's own mailbox before it reached us?
 * If so she already has it, and emailing her about it would be a second email
 * about the same thing (Erica's rule, Nov 9 2026: never).
 *
 *   'forwarded'  she sent it to us herself (a forward from her address)
 *   'delivered'  it was addressed or delivered to her and came on to us:
 *                her mail's auto-forward (To is still her; Gmail adds
 *                X-Forwarded-For), or a client who wrote to her and to us
 *   null         it came to us only (the client wrote to the intake address,
 *                or the operator forwarded it): she needs her one email
 */
export function alreadyInArtistMailbox(mail: ReceivedEmail): 'forwarded' | 'delivered' | null {
  const hers = artistMailboxes()
  if (hers.has(bareAddress(mail.from))) return 'forwarded'
  const fields = [
    ...(Array.isArray(mail.to) ? mail.to : []),
    header(mail, 'to'),
    header(mail, 'cc'),
    header(mail, 'delivered-to'),
    header(mail, 'x-original-to'),
    header(mail, 'x-forwarded-for'),
  ]
  for (const field of fields) {
    for (const addr of String(field ?? '').toLowerCase().match(ADDRESS) ?? []) {
      if (hers.has(addr)) return 'delivered'
    }
  }
  return null
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

  if (isOurs(from, own)) {
    const fwd = unwrapForward(text)
    if (!fwd) return { ignored: 'own-address' }
    from = fwd.from
    subject = fwd.subject ?? subject
    text = fwd.body
    if (isOurs(from, own)) return { ignored: 'own-address' }
  } else {
    // A client replying to Lacey's forwarded copy of something: still unwrap.
    const fwd = unwrapForward(text)
    if (fwd && !isOurs(fwd.from, own) && bareAddress(fwd.from) === bareAddress(from)) text = fwd.body
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
    // Read from the envelope as it arrived, before any forward was unwrapped.
    artistHasIt: alreadyInArtistMailbox(mail),
  }
}

export interface ArtistReply {
  externalId: string
  /** Who she wrote to, ours and hers left out: the client, almost always one address. */
  clients: string[]
  text: string
  subject: string | null
  /** True when the receiving server vouched for the sender (DMARC or aligned DKIM pass). */
  verified: boolean
}

function recipients(mail: ReceivedEmail): string[] {
  const fields = [...(Array.isArray(mail.to) ? mail.to : []), header(mail, 'to'), header(mail, 'cc')]
  const out = new Set<string>()
  for (const field of fields) for (const addr of String(field ?? '').toLowerCase().match(ADDRESS) ?? []) out.add(addr)
  return [...out]
}

// The receiving server's verdict on who really sent this. Her address is easy
// to type into a From line, so her words are only shown in a client's thread
// when the mail passed DMARC, or DKIM signed by her own domain.
function senderVerified(mail: ReceivedEmail): boolean {
  const results = header(mail, 'authentication-results').toLowerCase()
  if (!results) return false
  if (/\bdmarc=pass\b/.test(results)) return true
  const domain = bareAddress(mail.from).split('@')[1] ?? ''
  return Boolean(domain) && /\bdkim=pass\b/.test(results) && results.includes(`header.d=${domain}`)
}

/**
 * Her own reply to a client, copied to us because the intake address sits
 * beside the client's in the Reply-To of what we sent her (lib/notify.ts,
 * artistReplyTo). It is from her mailbox and written to someone who is not
 * us. A forward is different: it is addressed to us alone, and stays on the
 * forward path even when her mail app marks replies "Original Message".
 */
export function readArtistReply(mail: ReceivedEmail): ArtistReply | null {
  if (isAutomated(mail)) return null
  if (!artistMailboxes().has(bareAddress(mail.from))) return null
  const own = ownAddresses()
  const clients = recipients(mail).filter((a) => !isOurs(a, own))
  if (!clients.length) return null
  return {
    externalId: `resend:${mail.id}`,
    clients,
    text: stripQuoted(textBody(mail)),
    subject: mail.subject ?? null,
    verified: senderVerified(mail),
  }
}

export async function handleInboundEmail(db: SupabaseClient, emailId: string): Promise<IngestOutcome> {
  const mail = await fetchReceived(emailId)
  const reply = readArtistReply(mail)
  if (reply) return recordArtistReply(db, reply)
  const attachments = await listAttachments(emailId)
  const normalized = normalizeEmail(mail, attachments)
  if ('ignored' in normalized) return { outcome: 'ignored', reason: normalized.ignored }
  return ingest(db, normalized)
}
