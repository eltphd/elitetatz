import type { SupabaseClient } from '@supabase/supabase-js'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// One lead model for every way a client can reach the artist. The web form and
// the concierge write to `matches` directly; email, Instagram, Facebook and
// SMS arrive through the inbound adapters in src/lib/inbound and end up in the
// same table, the same thread and the same inbox card.

export { CHANNELS, CHANNEL_LABEL, CHANNEL_SHORT, isChannel, channelLabel } from '@/lib/channel-types'
export type { Channel } from '@/lib/channel-types'
import { CHANNEL_LABEL, type Channel } from '@/lib/channel-types'

export const OPEN_STATUSES = ['pending', 'info_requested', 'accepted', 'paid', 'booked']
export const CLOSED_STATUSES = ['rejected', 'completed', 'cancelled']

// Outside thread ids: "chatwoot:<conversation id>", "sms:<E.164>", "email:<address>".
export function threadId(kind: 'chatwoot' | 'sms' | 'email', ref: string): string {
  return `${kind}:${ref.trim().toLowerCase()}`
}

// Where a reply from the inbox actually goes, in words for the reply box.
export function replyRoute(lead: { channel: string; client_email?: string | null; client_phone?: string | null; external_thread_id?: string | null }): string {
  const parts: string[] = []
  if (lead.external_thread_id?.startsWith('chatwoot:')) {
    parts.push(lead.channel === 'facebook' ? 'Messenger' : lead.channel === 'instagram' ? 'Instagram DM' : 'their chat')
  }
  if (lead.client_email) parts.push('email')
  if (lead.client_phone) parts.push('text')
  if (!parts.length) return 'nowhere yet: this lead has no contact details'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export interface OpenLead {
  id: string
  status: string
  channel: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  external_thread_id: string | null
  ai_summary: string | null
}

const LEAD_COLUMNS = 'id, status, channel, client_name, client_email, client_phone, external_thread_id, ai_summary'

// The lead a new message belongs to: the same outside thread first, then the
// same email address, then the same phone number, among this artist's leads
// that are still open and recent. A closed lead never reopens by itself; a
// message from that person starts a fresh one.
export async function findOpenLead(
  db: SupabaseClient,
  artistId: string,
  by: { externalThreadId?: string | null; email?: string | null; phone?: string | null },
  withinDays = 120,
): Promise<OpenLead | null> {
  const since = new Date(Date.now() - withinDays * 86_400_000).toISOString()
  const tries: Array<[string, string]> = []
  if (by.externalThreadId) tries.push(['external_thread_id', by.externalThreadId])
  if (by.email) tries.push(['client_email', by.email.trim().toLowerCase()])
  if (by.phone) tries.push(['client_phone', by.phone])
  for (const [col, val] of tries) {
    const { data } = await db
      .from('matches')
      .select(LEAD_COLUMNS)
      .eq('artist_id', artistId)
      .eq(col, val)
      .in('status', OPEN_STATUSES)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    const row = Array.isArray(data) ? (data[0] as OpenLead | undefined) : (data as OpenLead | null)
    if (row) return row
  }
  return null
}

export interface NewLead {
  channel: Channel
  name?: string | null
  email?: string | null
  phone?: string | null
  externalThreadId?: string | null
  /** One line for the card and the email subject. */
  concept: string
  /** Anything else the adapter read out of the first message. Merged into the brief. */
  brief?: Record<string, unknown>
}

export async function openLead(
  db: SupabaseClient,
  artist: { id: string; payout_preference?: string | null },
  lead: NewLead,
): Promise<{ id: string } | null> {
  const now = new Date().toISOString()
  const brief: Record<string, unknown> = {
    concept: lead.concept,
    client_name: lead.name ?? '',
    client_email: lead.email ?? '',
    client_phone: lead.phone ?? '',
    source: `inbound-${lead.channel}`,
    ...(lead.brief ?? {}),
  }
  const { data, error } = await db
    .from('matches')
    .insert({
      artist_id: artist.id,
      status: 'pending',
      client_brief: JSON.stringify(brief),
      ai_summary: lead.concept.slice(0, 200),
      offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
      placement: typeof brief.placement === 'string' && brief.placement ? brief.placement : null,
      client_name: lead.name || null,
      client_email: lead.email ? lead.email.trim().toLowerCase() : null,
      client_phone: lead.phone || null,
      channel: lead.channel,
      external_thread_id: lead.externalThreadId ?? null,
      payout_target: artist.payout_preference ?? 'artist',
      last_client_message_at: now,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('openLead:', error)
    return null
  }
  await db.from('match_messages').insert({
    match_id: data.id,
    sender: 'system',
    body: `Inquiry arrived by ${CHANNEL_LABEL[lead.channel].toLowerCase()}.`,
    channel: lead.channel,
  })
  return { id: data.id }
}

export interface ClientMessage {
  body: string
  channel: Channel
  /** Id in the source system; a second delivery with the same id is a no-op. */
  externalId?: string | null
  meta?: Record<string, unknown> | null
}

export async function appendClientMessage(
  db: SupabaseClient,
  matchId: string,
  msg: ClientMessage,
): Promise<{ id: string; duplicate: boolean } | null> {
  if (msg.externalId) {
    const { data: existing } = await db.from('match_messages').select('id').eq('external_id', msg.externalId).limit(1)
    const row = Array.isArray(existing) ? existing[0] : existing
    if (row && typeof row === 'object' && 'id' in row) return { id: String((row as { id: string }).id), duplicate: true }
  }
  const { data, error } = await db
    .from('match_messages')
    .insert({ match_id: matchId, sender: 'client', body: msg.body, channel: msg.channel, external_id: msg.externalId ?? null, meta: msg.meta ?? null })
    .select('id')
    .single()
  if (error || !data) {
    // A race on the unique external id is a duplicate, not a failure.
    if (error && (error as { code?: string }).code === '23505' && msg.externalId) return { id: '', duplicate: true }
    console.error('appendClientMessage:', error)
    return null
  }
  const now = new Date().toISOString()
  await db.from('matches').update({ updated_at: now, last_client_message_at: now }).eq('id', matchId)
  return { id: data.id, duplicate: false }
}

export async function artistForInbound(db: SupabaseClient): Promise<{ id: string; payout_preference: string | null } | null> {
  const { data } = await db.from('artists').select('id, payout_preference').eq('name', ARTIST_CONFIG.name).single()
  return (data as { id: string; payout_preference: string | null } | null) ?? null
}
