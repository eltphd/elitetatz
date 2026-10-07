import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken } from './crypto'
import { GoogleAuthError, refreshAccessToken } from './oauth'

// Read-only helpers the assistant uses on an artist's behalf. Every call
// takes the artist id from artistContext() (the signed-in session), never
// from the request, so one artist can never reach another's inbox.
//
// What these return is deliberately thin: sender, subject, date and Google's
// short snippet for mail; title, time and location for events. Full message
// bodies and attachments are not fetched and nothing is stored.

export interface MailHit {
  id: string
  threadId: string
  from: string
  subject: string
  date: string
  snippet: string
}

export interface CalendarItem {
  id: string
  title: string
  start: string
  end: string
  location: string | null
  allDay: boolean
}

export type GoogleResult<T> =
  | { ok: true; data: T; googleEmail: string }
  | { ok: false; status: 404 | 409 | 502; error: string }

async function accessTokenFor(db: SupabaseClient, artistId: string): Promise<{ token: string; email: string } | { error: string; status: 404 | 409 | 502 }> {
  const { data: conn } = await db
    .from('artist_google_connections')
    .select('refresh_token_enc, google_email, needs_reconnect, scopes')
    .eq('artist_id', artistId)
    .maybeSingle()
  if (!conn) return { error: 'Google is not connected', status: 404 }
  if (conn.needs_reconnect) return { error: 'Google access expired. Reconnect on the Connections page.', status: 409 }

  try {
    const t = await refreshAccessToken(decryptToken(conn.refresh_token_enc))
    await db.from('artist_google_connections').update({ last_used_at: new Date().toISOString() }).eq('artist_id', artistId)
    return { token: t.access_token, email: conn.google_email }
  } catch (e) {
    if (e instanceof GoogleAuthError && e.code === 'invalid_grant') {
      // The artist revoked access in their Google account, or the token aged
      // out. Record it and stop trying until they reconnect.
      await db.from('artist_google_connections').update({ needs_reconnect: true, updated_at: new Date().toISOString() }).eq('artist_id', artistId)
      await db.from('artist_google_consent_log').insert({ artist_id: artistId, action: 'expired', scopes: conn.scopes ?? [] })
      return { error: 'Google access expired. Reconnect on the Connections page.', status: 409 }
    }
    return { error: 'Google did not respond', status: 502 }
  }
}

async function gapi<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Google API ${res.status}`)
  return res.json() as Promise<T>
}

const header = (headers: { name: string; value: string }[] | undefined, name: string) =>
  headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

/** Gmail search using Gmail's own query syntax (from:, subject:, newer_than:…). */
export async function searchMail(db: SupabaseClient, artistId: string, query: string, max = 10): Promise<GoogleResult<MailHit[]>> {
  const auth = await accessTokenFor(db, artistId)
  if ('error' in auth) return { ok: false, status: auth.status, error: auth.error }
  try {
    const list = await gapi<{ messages?: { id: string; threadId: string }[] }>(
      auth.token,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults: String(Math.min(Math.max(max, 1), 25)) })}`,
    )
    const hits = await Promise.all(
      (list.messages ?? []).map(async (m) => {
        const msg = await gapi<{ id: string; threadId: string; snippet: string; payload?: { headers?: { name: string; value: string }[] } }>(
          auth.token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        )
        return {
          id: msg.id,
          threadId: msg.threadId,
          from: header(msg.payload?.headers, 'From'),
          subject: header(msg.payload?.headers, 'Subject'),
          date: header(msg.payload?.headers, 'Date'),
          snippet: msg.snippet,
        }
      }),
    )
    return { ok: true, data: hits, googleEmail: auth.email }
  } catch {
    return { ok: false, status: 502, error: 'Gmail did not respond' }
  }
}

/** Events on the artist's primary calendar between now and `days` from now. */
export async function upcomingEvents(db: SupabaseClient, artistId: string, days = 14): Promise<GoogleResult<CalendarItem[]>> {
  const auth = await accessTokenFor(db, artistId)
  if ('error' in auth) return { ok: false, status: auth.status, error: auth.error }
  const now = new Date()
  const until = new Date(now.getTime() + Math.min(Math.max(days, 1), 90) * 86_400_000)
  try {
    const res = await gapi<{ items?: { id: string; summary?: string; location?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }[] }>(
      auth.token,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: until.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
      })}`,
    )
    const data = (res.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? '(no title)',
      start: e.start.dateTime ?? e.start.date ?? '',
      end: e.end.dateTime ?? e.end.date ?? '',
      location: e.location ?? null,
      allDay: !e.start.dateTime,
    }))
    return { ok: true, data, googleEmail: auth.email }
  } catch {
    return { ok: false, status: 502, error: 'Google Calendar did not respond' }
  }
}
