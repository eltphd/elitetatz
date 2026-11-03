import { timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { threadId, type Channel } from '@/lib/channels'
import { toE164 } from '@/lib/sms'
import { ingest, type IngestOutcome, type NormalizedInbound } from '@/lib/inbound/ingest'

// Instagram DMs and Facebook Messenger reach the inbox through Chatwoot
// (github.com/chatwoot/chatwoot, self-hosted or cloud), which holds the Meta
// app approval and fires a webhook per message. Chatwoot is the pipe, not the
// place: Lacey never opens it. Replies from the inbox go back through its API
// so the client sees them where they wrote.
//
// Env: CHATWOOT_URL (https://app.chatwoot.com or your host), CHATWOOT_ACCOUNT_ID,
// CHATWOOT_API_TOKEN (an agent or bot token), CHATWOOT_WEBHOOK_SECRET (any
// long random string, appended to the webhook URL as ?key=…).

/* eslint-disable @typescript-eslint/no-explicit-any */

export function chatwootConfigured(): boolean {
  return Boolean(process.env.CHATWOOT_URL && process.env.CHATWOOT_ACCOUNT_ID && process.env.CHATWOOT_API_TOKEN)
}

export function verifyWebhookKey(given: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

function channelOf(payload: any): Channel {
  const type: string = payload?.inbox?.channel_type ?? payload?.conversation?.channel ?? ''
  const extra = payload?.conversation?.additional_attributes ?? {}
  if (/Instagram/i.test(type) || extra?.type === 'instagram_direct_message') return 'instagram'
  if (/Facebook/i.test(type)) return 'facebook'
  if (/Email/i.test(type)) return 'email'
  if (/Sms|Twilio/i.test(type)) return 'sms'
  if (/WebWidget|Api/i.test(type)) return 'web'
  return 'manual'
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

// Chatwoot posts `message_created` for every message. Only an incoming, public
// message from the contact is a client message; our own replies and private
// notes come back through the same hook and are ignored.
export function parseChatwootEvent(payload: unknown): NormalizedInbound | null {
  const p = payload as any
  if (!p || typeof p !== 'object') return null
  if (p.event !== 'message_created') return null
  const type = p.message_type ?? p.message?.message_type
  if (type !== 'incoming' && type !== 0) return null
  if (p.private === true) return null
  const conversationId = p.conversation?.id ?? p.conversation_id
  const messageId = p.id ?? p.message?.id
  if (!conversationId || !messageId) return null

  const sender = p.sender ?? p.conversation?.meta?.sender ?? {}
  const channel = channelOf(p)
  const email = str(sender.email).toLowerCase() || null
  const phone = toE164(str(sender.phone_number)) ?? null
  const social = sender.additional_attributes?.social_profiles ?? {}
  const handle = str(social.instagram) || str(social.facebook) || str(sender.identifier)
  const name = str(sender.name) || (handle ? `@${handle.replace(/^@/, '')}` : null)

  const attachments = (Array.isArray(p.attachments) ? p.attachments : [])
    .map((a: any) => {
      const url = str(a.data_url) || str(a.file_url) || str(a.thumb_url)
      if (!url) return null
      const fileType = str(a.file_type)
      const ext = str(a.extension) || (url.split('?')[0].split('.').pop() ?? '')
      const mime = fileType === 'image' ? (ext && /^(png|webp|gif)$/i.test(ext) ? `image/${ext.toLowerCase()}` : 'image/jpeg') : fileType === 'file' && /pdf/i.test(ext) ? 'application/pdf' : null
      return { url, filename: url.split('?')[0].split('/').pop() || `${fileType || 'file'}.${ext || 'bin'}`, mime }
    })
    .filter(Boolean) as NormalizedInbound['attachments']

  return {
    channel,
    externalId: `chatwoot:msg:${messageId}`,
    externalThreadId: threadId('chatwoot', String(conversationId)),
    senderName: name,
    email,
    phone,
    text: str(p.content),
    subject: null,
    attachments,
    meta: { handle: handle || null, chatwoot_conversation: conversationId, chatwoot_inbox: p.inbox?.name ?? null },
  }
}

export async function handleChatwootEvent(db: SupabaseClient, payload: unknown): Promise<IngestOutcome | { outcome: 'ignored'; reason: string }> {
  const normalized = parseChatwootEvent(payload)
  if (!normalized) return { outcome: 'ignored', reason: 'not an incoming client message' }
  return ingest(db, normalized)
}

// A reply from the inbox, delivered where the client wrote. Best effort; the
// caller already saved the message on the thread and emailed when it could.
export async function chatwootReply(externalThreadId: string, text: string): Promise<boolean> {
  if (!chatwootConfigured() || !externalThreadId.startsWith('chatwoot:')) return false
  const conversationId = externalThreadId.slice('chatwoot:'.length)
  const base = process.env.CHATWOOT_URL!.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', api_access_token: process.env.CHATWOOT_API_TOKEN! },
      body: JSON.stringify({ content: text.slice(0, 4000), message_type: 'outgoing', private: false }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) console.warn(`chatwoot reply ${res.status}`)
    return res.ok
  } catch (err) {
    console.warn('chatwoot reply failed', err)
    return false
  }
}
