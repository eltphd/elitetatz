import type { SupabaseClient } from '@supabase/supabase-js'
import { appendClientMessage, artistForInbound, findOpenLead, openLead, CHANNEL_LABEL, type Channel } from '@/lib/channels'
import { fetchBytes, storeAttachment } from '@/lib/attachments'
import { notifyArtist } from '@/lib/notify'
import { appUrl } from '@/lib/tokens'

// The one path every inbound channel takes once its adapter has read the
// message: record the event (so a retry is a no-op), find the lead it belongs
// to or open one, append the client's words, keep their files, tell the artist.
// Nothing is ever sent to the client from here: the artist's first reply from
// the inbox is the first thing they hear back.

export interface NormalizedInbound {
  channel: Channel
  /** Id in the source system, unique per message. */
  externalId: string
  /** Outside conversation this message belongs to, when the source has one. */
  externalThreadId?: string | null
  senderName?: string | null
  email?: string | null
  phone?: string | null
  text: string
  subject?: string | null
  attachments: Array<{ url: string; filename?: string | null; mime?: string | null; headers?: Record<string, string> }>
  /** Anything else worth keeping with the message (subject, handle, raw sender). */
  meta?: Record<string, unknown>
  /**
   * Set by an adapter when the message already sits in the artist's own
   * mailbox ('forwarded' by her, or 'delivered' to her on its way to us). The
   * lead and the thread are kept exactly the same; she is just not emailed a
   * second copy of something she holds. Only email can set this: a DM or a
   * text never passed through her inbox, so those always get their one email.
   */
  artistHasIt?: 'forwarded' | 'delivered' | null
}

export type IngestOutcome =
  | { outcome: 'duplicate' }
  | { outcome: 'ignored'; reason: string }
  | { outcome: 'appended' | 'opened'; matchId: string; attachments: number }
  | { outcome: 'artist_reply'; matchId: string }
  | { outcome: 'error'; error: string }

const DUPLICATE = '23505'

export async function recordEvent(db: SupabaseClient, channel: string, externalId: string): Promise<'new' | 'duplicate' | 'error'> {
  const { error } = await db.from('inbound_events').insert({ channel, external_id: externalId }).select('id').single()
  if (!error) return 'new'
  if ((error as { code?: string }).code === DUPLICATE) return 'duplicate'
  console.error('inbound_events insert:', error)
  return 'error'
}

async function finishEvent(db: SupabaseClient, channel: string, externalId: string, patch: Record<string, unknown>) {
  await db.from('inbound_events').update({ processed_at: new Date().toISOString(), ...patch }).eq('channel', channel).eq('external_id', externalId)
}

// Subject first, else the first sentence of the message, else a label.
export function conceptFrom(subject: string | null | undefined, text: string, channel: Channel): string {
  const s = (subject ?? '').replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, '').trim()
  if (s && !/^(hi|hello|hey|inquiry|tattoo|booking|question|appointment|tattoo inquiry|new inquiry)[.!]?$/i.test(s)) return s.slice(0, 120)
  const firstLine = text.split(/\n+/).map((l) => l.trim()).find((l) => l.length > 3) ?? ''
  const sentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? ''
  const pick = (sentence.length >= 12 ? sentence : firstLine).slice(0, 120)
  return pick || `New ${CHANNEL_LABEL[channel].toLowerCase()}`
}

export async function ingest(db: SupabaseClient, msg: NormalizedInbound): Promise<IngestOutcome> {
  const recorded = await recordEvent(db, msg.channel, msg.externalId)
  if (recorded === 'duplicate') return { outcome: 'duplicate' }
  if (recorded === 'error') return { outcome: 'error', error: 'could not record event' }

  try {
    const artist = await artistForInbound(db)
    if (!artist) throw new Error('artist not configured')

    const text = msg.text.trim()
    const existing = await findOpenLead(db, artist.id, { externalThreadId: msg.externalThreadId, email: msg.email, phone: msg.phone })

    let matchId: string
    let outcome: 'appended' | 'opened'
    if (existing) {
      matchId = existing.id
      outcome = 'appended'
      // A thread the lead did not have yet (a client who filled the form, then DMed).
      if (msg.externalThreadId && !existing.external_thread_id) {
        await db.from('matches').update({ external_thread_id: msg.externalThreadId }).eq('id', matchId)
      }
      if (msg.phone && !existing.client_phone) await db.from('matches').update({ client_phone: msg.phone }).eq('id', matchId)
      if (msg.email && !existing.client_email) await db.from('matches').update({ client_email: msg.email.toLowerCase() }).eq('id', matchId)
    } else {
      const opened = await openLead(db, artist, {
        channel: msg.channel,
        name: msg.senderName,
        email: msg.email,
        phone: msg.phone,
        externalThreadId: msg.externalThreadId,
        concept: conceptFrom(msg.subject, text, msg.channel),
        brief: { has_reference: msg.attachments.length > 0, ...(msg.subject ? { subject: msg.subject } : {}) },
      })
      if (!opened) throw new Error('could not open lead')
      matchId = opened.id
      outcome = 'opened'
    }

    const body = text || (msg.attachments.length ? `(${msg.attachments.length} file${msg.attachments.length === 1 ? '' : 's'}, no text)` : '(empty message)')
    const appended = await appendClientMessage(db, matchId, {
      body,
      channel: msg.channel,
      externalId: msg.externalId,
      meta: {
        ...(msg.meta ?? {}),
        ...(msg.subject ? { subject: msg.subject } : {}),
        ...(msg.senderName ? { from: msg.senderName } : {}),
        // The hold timers read this: a message that sits in her mailbox can be
        // answered from there without our seeing it, so it is never timed.
        ...(msg.artistHasIt ? { mailbox: msg.artistHasIt } : {}),
      },
    })
    if (!appended) throw new Error('could not append message')
    if (appended.duplicate) {
      await finishEvent(db, msg.channel, msg.externalId, { match_id: matchId, outcome: 'duplicate' })
      return { outcome: 'duplicate' }
    }

    let stored = 0
    for (const a of msg.attachments.slice(0, 10)) {
      const got = await fetchBytes(a.url, { headers: a.headers })
      if (!got) continue
      const row = await storeAttachment(db, {
        matchId,
        messageId: appended.id || null,
        filename: a.filename || `reference-${stored + 1}`,
        mime: a.mime || got.mime,
        bytes: got.bytes,
        source: msg.channel,
      })
      if (row) stored += 1
    }

    const dashboard = `${appUrl()}/dashboard`
    const who = msg.senderName || msg.email || msg.phone || 'a client'
    const via = CHANNEL_LABEL[msg.channel]
    const excerpt = text.replace(/\s+/g, ' ').slice(0, 240)
    const files = stored ? ` · ${stored} file${stored === 1 ? '' : 's'} attached` : ''
    await notifyArtist({
      kind: outcome === 'opened' ? `New ${via.toLowerCase()} inquiry` : `${via} reply`,
      ref: matchId,
      matchId,
      replyTo: msg.email ?? null,
      skip:
        msg.artistHasIt === 'forwarded' ? 'already in her mailbox: she forwarded this message herself'
        : msg.artistHasIt === 'delivered' ? 'already in her mailbox: it was delivered to her address on its way here'
        : null,
      subject: outcome === 'opened' ? `${via}: ${who} — ${conceptFrom(msg.subject, text, msg.channel)}` : `${who} replied by ${via.toLowerCase()}`,
      text: `${outcome === 'opened' ? `New inquiry by ${via.toLowerCase()}` : `Reply by ${via.toLowerCase()}`} from ${who}${files}.

"${excerpt}${text.length > 240 ? '…' : ''}"

It is in your inbox, with the files: ${dashboard}
Ref ${matchId.slice(0, 8)}.`,
      sms: `${outcome === 'opened' ? 'New' : 'Reply'} via ${via}: ${who}${files}. ${dashboard}`,
    })

    await finishEvent(db, msg.channel, msg.externalId, { match_id: matchId, outcome })
    return { outcome, matchId, attachments: stored }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`ingest ${msg.channel}:`, error)
    await finishEvent(db, msg.channel, msg.externalId, { outcome: 'error', error: error.slice(0, 500) })
    return { outcome: 'error', error }
  }
}

// Her own reply to a client, sent from her mail app and copied to the intake
// address (lib/notify.ts, artistReplyTo). It goes on the lead as her message
// and counts as her answer, so the hold timers stop: no nudge to her about
// someone she already wrote back to, and no "still with Lacey" to that client.
// Nothing is sent to anyone from here, and no lead is ever opened from her
// outgoing mail: a reply to someone the portal does not know is left alone.
export async function recordArtistReply(
  db: SupabaseClient,
  reply: { externalId: string; clients: string[]; text: string; subject: string | null; verified: boolean },
): Promise<IngestOutcome> {
  const recorded = await recordEvent(db, 'email', reply.externalId)
  if (recorded === 'duplicate') return { outcome: 'duplicate' }
  if (recorded === 'error') return { outcome: 'error', error: 'could not record event' }

  try {
    const artist = await artistForInbound(db)
    if (!artist) throw new Error('artist not configured')

    let lead: Awaited<ReturnType<typeof findOpenLead>> = null
    for (const email of reply.clients.slice(0, 5)) {
      lead = await findOpenLead(db, artist.id, { email })
      if (lead) break
    }
    if (!lead) {
      await finishEvent(db, 'email', reply.externalId, { outcome: 'ignored', error: 'artist reply: no open lead for the recipient' })
      return { outcome: 'ignored', reason: 'artist-reply-no-lead' }
    }

    // Her words go in the thread (which the client can see on their inquiry
    // page) only when the receiving server vouched for the sender. Otherwise
    // the fact of the reply is recorded and the text is left in her mail.
    const body = reply.verified && reply.text.trim() ? reply.text.trim().slice(0, 4000) : 'Replied by email.'
    const now = new Date().toISOString()
    const { error } = await db.from('match_messages').insert({
      match_id: lead.id,
      sender: 'artist',
      body,
      channel: 'email',
      external_id: reply.externalId,
      meta: { mailbox: 'reply', verified: reply.verified, ...(reply.subject ? { subject: reply.subject } : {}) },
    })
    if (error) {
      // The same message delivered twice is not a failure.
      if ((error as { code?: string }).code === DUPLICATE) {
        await finishEvent(db, 'email', reply.externalId, { match_id: lead.id, outcome: 'duplicate' })
        return { outcome: 'duplicate' }
      }
      throw new Error(`artist reply insert: ${error.message}`)
    }
    await db.from('matches').update({ artist_responded_at: now, updated_at: now }).eq('id', lead.id)
    await finishEvent(db, 'email', reply.externalId, { match_id: lead.id, outcome: 'artist_reply' })
    return { outcome: 'artist_reply', matchId: lead.id }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('artist reply:', error)
    await finishEvent(db, 'email', reply.externalId, { outcome: 'error', error: error.slice(0, 500) })
    return { outcome: 'error', error }
  }
}
