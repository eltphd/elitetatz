import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { threadId } from '@/lib/channels'
import { toE164 } from '@/lib/sms'
import { ingest, type IngestOutcome, type NormalizedInbound } from '@/lib/inbound/ingest'

// Texts to the studio line, by way of a Dialpad webhook + SMS event
// subscription. Dialpad signs each delivery as a JWT (HS256) with the secret
// given when the webhook was created; the raw body is the token. Outbound
// texts from the inbox already go through lib/sms.ts, so with this the whole
// text conversation sits on the lead.
//
// Env: DIALPAD_WEBHOOK_SECRET (set when creating the webhook), plus the
// existing DIALPAD_API_TOKEN / DIALPAD_FROM_NUMBER for replies.

/* eslint-disable @typescript-eslint/no-explicit-any */

const b64url = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export function verifyDialpadJwt(token: string, secret: string, now = Date.now()): Record<string, unknown> | null {
  const parts = token.trim().split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  let headerObj: any
  try { headerObj = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) } catch { return null }
  if (headerObj?.alg !== 'HS256') return null
  const expected = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest())
  const a = Buffer.from(s)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload: any
  try { payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) } catch { return null }
  if (typeof payload?.exp === 'number' && payload.exp * 1000 < now - 60_000) return null
  return payload
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

function ownNumbers(): Set<string> {
  const set = new Set<string>()
  for (const v of [process.env.DIALPAD_FROM_NUMBER, process.env.ARTIST_SMS_NUMBER, ARTIST_CONFIG.smsNumber]) {
    const e = toE164(v)
    if (e) set.add(e)
  }
  return set
}

// Dialpad's SMS event: id, direction ('inbound' | 'outbound'), from_number,
// to_number, text, created_date, mms (boolean), mms_url (string or list).
export function parseDialpadSms(payload: unknown): NormalizedInbound | null {
  const p = payload as any
  if (!p || typeof p !== 'object') return null
  const direction = str(p.direction).toLowerCase()
  if (direction && direction !== 'inbound') return null
  const id = str(p.id) || str(p.message_id)
  const from = toE164(str(p.from_number) || str(p.from))
  if (!id || !from) return null
  if (ownNumbers().has(from)) return null

  const urls: string[] = Array.isArray(p.mms_url) ? p.mms_url.map(str).filter(Boolean) : str(p.mms_url) ? [str(p.mms_url)] : []
  const attachments = urls.slice(0, 10).map((url, i) => ({ url, filename: url.split('?')[0].split('/').pop() || `mms-${i + 1}.jpg`, mime: null }))

  const contactName = str(p.contact?.name) || str(p.sender_name) || null
  return {
    channel: 'sms',
    externalId: `dialpad:${id}`,
    externalThreadId: threadId('sms', from),
    senderName: contactName,
    email: null,
    phone: from,
    text: str(p.text) || str(p.body),
    subject: null,
    attachments,
    meta: { to: str(p.to_number) || null },
  }
}

export async function handleInboundSms(db: SupabaseClient, payload: unknown): Promise<IngestOutcome | { outcome: 'ignored'; reason: string }> {
  const normalized = parseDialpadSms(payload)
  if (!normalized) return { outcome: 'ignored', reason: 'not an inbound client text' }
  return ingest(db, normalized)
}
