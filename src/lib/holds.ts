import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { inquiryUrl, appUrl } from '@/lib/tokens'
import { depositLinkFor } from '@/lib/deposit'
import { chatwootReply } from '@/lib/inbound/chatwoot'
import { postFollowup } from '@/lib/slack'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Hold timers: no client sits in silence without a line that says when they
// will hear next, and Lacey hears when a lead has waited on her. Run hourly by
// /api/cron/holds. Pure decision (`dueHolds`) first, then one send per hold per
// lead, recorded in `hold_events` (migration 016) so a second tick sends nothing.
//
//   Hold  State                                        Client                 Lacey
//   A1    waiting on Lacey 36 h (new, or replied)      "still with Lacey"     nudge (email + text)
//   A2    waiting on Lacey 72 h                        "answer by {day}"      nudge + Slack YOUR MOVE
//   B     Lacey asked, client silent 72 h              "answer when ready"    none
//   B14   …14 d                                        none                   one line
//   C     quoted, no deposit 72 h                      "quote good 14 days"   none
//   C14   …14 d                                        none                   "expired; reopen or let go"
//   D     deposit in, no date 72 h                     "pick a date"          none
//   E     date asked, unconfirmed 48 h                 "confirm by {day}"     nudge
//
// Everything is sent only between 9 AM and 8 PM Eastern. A hold whose window
// opened before the cron existed (an old pending lead) is left alone: the
// first run after deploy must not write to every stale lead at once.

export type Hold = 'A1' | 'A2' | 'B' | 'B14' | 'C' | 'C14' | 'D' | 'E'

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** How long after a hold becomes due it may still fire. Older than this is history. */
export const GRACE = 7 * DAY

// [opens, closes) in ms since the wait began. The second of each pair closes the first,
// so an escalation never sends the earlier message after the later one.
export const WINDOW: Record<Hold, [number, number]> = {
  A1: [36 * HOUR, 72 * HOUR],
  A2: [72 * HOUR, 72 * HOUR + GRACE],
  B: [72 * HOUR, 14 * DAY],
  B14: [14 * DAY, 14 * DAY + GRACE],
  C: [72 * HOUR, 14 * DAY],
  C14: [14 * DAY, 14 * DAY + GRACE],
  D: [72 * HOUR, 72 * HOUR + GRACE],
  E: [48 * HOUR, 48 * HOUR + GRACE],
}

export interface HoldMatch {
  id: string
  status: string
  channel: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  external_thread_id: string | null
  ai_summary: string | null
  created_at: string
  updated_at: string | null
  artist_responded_at: string | null
  booked_at: string | null
  appointment_at: string | null
  date_request: string | null
  proposed_dates: string | null
}

export interface HoldMessage {
  match_id: string
  sender: 'artist' | 'client' | 'system'
  body: string
  created_at: string
}

export interface Due {
  hold: Hold
  match: HoldMatch
  /** When the wait began (ISO). */
  since: string
}

export const HOLD_COLUMNS =
  'id, status, channel, client_name, client_email, client_phone, external_thread_id, ai_summary, created_at, updated_at, artist_responded_at, booked_at, appointment_at, date_request, proposed_dates'

const WAITING_ON_ARTIST = ['pending', 'info_requested', 'accepted']
const OPEN = ['pending', 'info_requested', 'accepted', 'paid', 'booked']

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

function inWindow(hold: Hold, since: number, now: number): boolean {
  const age = now - since
  const [open, close] = WINDOW[hold]
  return age >= open && age < close
}

/** Which holds are due for these leads right now. Pure: no I/O. */
export function dueHolds(matches: HoldMatch[], messages: HoldMessage[], now: number): Due[] {
  const byMatch = new Map<string, HoldMessage[]>()
  for (const m of messages) {
    const list = byMatch.get(m.match_id) ?? []
    list.push(m)
    byMatch.set(m.match_id, list)
  }
  const due: Due[] = []
  const push = (hold: Hold, match: HoldMatch, since: number) => {
    if (since > 0 && inWindow(hold, since, now)) due.push({ hold, match, since: new Date(since).toISOString() })
  }

  for (const match of matches) {
    if (!OPEN.includes(match.status)) continue
    const thread = byMatch.get(match.id) ?? []
    let lastArtist = 0
    let lastClient = 0
    let lastDateRequest = 0
    for (const m of thread) {
      const t = ms(m.created_at)
      if (m.sender === 'artist') lastArtist = Math.max(lastArtist, t)
      if (m.sender === 'client') {
        lastClient = Math.max(lastClient, t)
        if (m.body.startsWith('Date request:')) lastDateRequest = Math.max(lastDateRequest, t)
      }
    }
    const artistActed = lastArtist > 0 || Boolean(match.artist_responded_at)
    const lastArtistAt = Math.max(lastArtist, ms(match.artist_responded_at))

    // A: the client is waiting on Lacey — a new lead she has not touched, or a
    // client message newer than her last one, before any deposit.
    if (WAITING_ON_ARTIST.includes(match.status)) {
      const since = !artistActed ? ms(match.created_at) : lastClient > lastArtistAt ? lastClient : 0
      if (since) {
        push('A1', match, since)
        push('A2', match, since)
        continue
      }
    }

    // B: Lacey asked (or wrote) and the client has not answered.
    if (['pending', 'info_requested'].includes(match.status) && lastArtist > 0 && lastArtist >= lastClient) {
      push('B', match, lastArtist)
      push('B14', match, lastArtist)
      continue
    }

    // C: quoted, nothing paid.
    if (match.status === 'accepted') {
      const since = ms(match.artist_responded_at) || lastArtist
      push('C', match, since)
      push('C14', match, since)
      continue
    }

    if (match.status === 'paid' && !match.appointment_at) {
      if (!match.date_request) {
        // D: deposit in, no date named yet.
        push('D', match, ms(match.booked_at) || ms(match.artist_responded_at))
      } else {
        // E: date named, Lacey has not confirmed it.
        push('E', match, lastDateRequest || ms(match.updated_at))
      }
    }
  }
  return due
}

// ---- copy ---------------------------------------------------------------------

const firstName = ARTIST_CONFIG.name.split(' ')[0]
const TZ = 'America/New_York'

/** "Thursday", or "Thursday, Nov 12" when it is more than six days out. */
export function dayWord(atMs: number, now: number): string {
  const d = new Date(atMs)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ })
  if (atMs - now > 6 * DAY) return `${weekday}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })}`
  return weekday
}

export function easternHour(now: number): number {
  return Number(new Date(now).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }))
}

/** Client messages go out 9 AM–8 PM Eastern only. */
export function sendingHours(now: number): boolean {
  const h = easternHour(now)
  return h >= 9 && h < 20
}

interface Copy {
  client?: { subject: string; text: string; sms: string }
  artist?: { subject: string; text: string; sms: string }
  slack?: string
  /** Private note for lead_notes when nothing goes to the client. */
  note?: string
}

export function copyFor(due: Due, now: number): Copy {
  const { hold, match } = due
  const since = ms(due.since)
  const name = match.client_name?.trim() || 'there'
  const concept = match.ai_summary?.trim() || 'your piece'
  const inquiry = inquiryUrl(match.id)
  const dashboard = `${appUrl()}/dashboard`
  const ref = match.id.slice(0, 8)
  const sig = `— ${ARTIST_CONFIG.handle}`
  const who = `${match.client_name?.trim() || 'A client'} · ${concept}`

  switch (hold) {
    case 'A1': {
      const day = dayWord(since + 72 * HOUR, now)
      return {
        client: {
          subject: `Still with ${firstName}`,
          text: `Hey ${name},\n\nYour inquiry (${concept}) is still with ${firstName}. She reads every inquiry herself; you'll hear from her by ${day}.\n\nYour inquiry page: ${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: your inquiry is still with ${firstName}. She reads every one herself; you'll hear from her by ${day}.`,
        },
        artist: {
          subject: `Waiting 36 hours: ${concept}`,
          text: `${who} has waited a day and a half. The client was just told they'll hear from you by ${day}.\n\nReply, ask, or pass from your inbox:\n${dashboard}`,
          sms: `${who} has waited 36 hours. They were told they'll hear by ${day}. Inbox: ${dashboard}`,
        },
      }
    }
    case 'A2': {
      const day = dayWord(since + 7 * DAY, now)
      return {
        client: {
          subject: `${firstName} will answer by ${day}`,
          text: `Hey ${name},\n\nHer books are full this week; she'll answer about ${concept} by ${day}. Reply here if you'd rather not wait:\n${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: ${firstName}'s books are full this week; she'll answer by ${day}. Reply here if you'd rather not wait: ${inquiry}`,
        },
        artist: {
          subject: `Waiting 3 days: ${concept}`,
          text: `${who} has now waited three days. The client was told you'll answer by ${day}.\n\nOne tap closes it either way:\n${dashboard}`,
          sms: `${who} has waited 3 days; told they'll hear by ${day}. Reply or pass: ${dashboard}`,
        },
        slack: `Lead ref ${ref} has waited 72 h with no reply from Lacey; the client was told ${day}. YOUR MOVE: text Lacey to reply or pass it from her inbox (${dashboard}), or nothing.`,
      }
    }
    case 'B':
      return {
        client: {
          subject: `${firstName} asked one thing`,
          text: `Hey ${name},\n\n${firstName} asked one thing before she quotes ${concept}. Answer whenever you're ready; your spot stays open two weeks.\n\n${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: ${firstName} asked one thing before she quotes. Answer whenever you're ready; your spot stays open two weeks: ${inquiry}`,
        },
      }
    case 'B14':
      return {
        artist: {
          subject: `No answer in 14 days: ${concept}`,
          text: `${who}: you asked a question two weeks ago and they never answered. It stays in Waiting; pass it when you want it gone.\n${dashboard}`,
          sms: `${who}: no answer to your question in 14 days. Pass it or leave it: ${dashboard}`,
        },
        note: 'Hold B14: 14 days without an answer to Lacey’s question; Lacey told once.',
      }
    case 'C': {
      const { url: deposit, external } = depositLinkFor(match.id)
      const link = deposit ?? inquiry
      return {
        client: {
          subject: `Your quote from ${firstName} is good for 14 days`,
          text: `Hey ${name},\n\nYour quote for ${concept} is good for 14 days.${match.proposed_dates ? ` Dates she offered: ${match.proposed_dates}.` : ''}\n\nDeposit link${external ? ` (${ARTIST_CONFIG.depositCollectedBy}'s secure checkout)` : ''}:\n${link}\n\nAlready sent it? Then you're set; ${firstName} will confirm.\n\nQuestions? Your inquiry page: ${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: your quote is good for 14 days. Deposit link: ${link} (already paid? you're set)`,
        },
      }
    }
    case 'C14':
      return {
        artist: {
          subject: `Quote expired: ${concept}`,
          text: `${who}: quoted two weeks ago, no deposit. Reopen it with a message, or let it go.\n${dashboard}`,
          sms: `${who}: quote expired (14 days, no deposit). Reopen or let it go: ${dashboard}`,
        },
        note: 'Hold C14: 14 days after the quote with no deposit; Lacey told once.',
      }
    case 'D':
      return {
        client: {
          subject: `Your spot is held — pick a date`,
          text: `Hey ${name},\n\nYour spot for ${concept} is held. Pick a date here${match.proposed_dates ? ` (she offered: ${match.proposed_dates})` : ''}:\n${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: your spot is held. Pick a date here: ${inquiry}`,
        },
      }
    case 'E': {
      const day = dayWord(since + 72 * HOUR, now)
      return {
        client: {
          subject: `${firstName} has your date request`,
          text: `Hey ${name},\n\n${firstName} has your date request for ${concept} and will confirm by ${day}.\n\n${inquiry}\n\n${sig}`,
          sms: `${ARTIST_CONFIG.handle}: ${firstName} has your date request and will confirm by ${day}.`,
        },
        artist: {
          subject: `Date request waiting 2 days: ${concept}`,
          text: `${who} asked for a date two days ago${match.date_request ? ` ("${match.date_request}")` : ''}. The client was told you'll confirm by ${day}.\n\nConfirm or change it:\n${dashboard}`,
          sms: `${who} asked for a date 2 days ago; told you'll confirm by ${day}. ${dashboard}`,
        },
      }
    }
  }
}

// ---- the tick ---------------------------------------------------------------

export interface HoldRun {
  checked: number
  due: number
  sent: { match_id: string; hold: Hold }[]
  skipped: string | null
}

export async function runHolds(db: SupabaseClient, artistId: string, now = Date.now()): Promise<HoldRun> {
  if (!sendingHours(now)) return { checked: 0, due: 0, sent: [], skipped: 'outside 9 AM–8 PM Eastern' }

  const since = new Date(now - 120 * DAY).toISOString()
  const { data: rows, error } = await db
    .from('matches')
    .select(HOLD_COLUMNS)
    .eq('artist_id', artistId)
    .in('status', OPEN)
    .gte('created_at', since)
  if (error) throw new Error(`matches: ${error.message}`)
  const matches = (rows ?? []) as HoldMatch[]
  if (!matches.length) return { checked: 0, due: 0, sent: [], skipped: null }
  const ids = matches.map((m) => m.id)

  const [{ data: msgs }, { data: events }] = await Promise.all([
    db.from('match_messages').select('match_id, sender, body, created_at').in('match_id', ids).order('created_at', { ascending: true }),
    db.from('hold_events').select('match_id, hold').in('match_id', ids),
  ])
  const already = new Set(((events ?? []) as { match_id: string; hold: string }[]).map((e) => `${e.match_id}:${e.hold}`))

  const due = dueHolds(matches, (msgs ?? []) as HoldMessage[], now).filter((d) => !already.has(`${d.match.id}:${d.hold}`))
  const sent: HoldRun['sent'] = []

  for (const d of due) {
    // The record comes first and is the guard: a duplicate key means another
    // tick got here, and this one sends nothing.
    const { error: evErr } = await db.from('hold_events').insert({ match_id: d.match.id, hold: d.hold })
    if (evErr) {
      if ((evErr as { code?: string }).code !== '23505') console.error('hold_events insert:', evErr)
      continue
    }
    const copy = copyFor(d, now)
    try {
      if (copy.client) {
        // The client-visible thread shows what they were told, as the system.
        await db.from('match_messages').insert({ match_id: d.match.id, sender: 'system', body: copy.client.text, channel: 'system', meta: { hold: d.hold } })
        const dm = d.match.external_thread_id?.startsWith('chatwoot:') ? d.match.external_thread_id : null
        if (dm) await chatwootReply(dm, copy.client.text)
        await notifyClient({ email: d.match.client_email, phone: d.match.client_phone, subject: copy.client.subject, text: copy.client.text, sms: copy.client.sms })
      }
      if (copy.note) {
        await db.from('lead_notes').insert({ match_id: d.match.id, author: 'assistant', kind: 'note', body: copy.note })
      }
      if (copy.artist) {
        await notifyArtist({ kind: `Hold ${d.hold}`, ref: d.match.id, matchId: d.match.id, replyTo: d.match.client_email, subject: copy.artist.subject, text: copy.artist.text, sms: copy.artist.sms })
      }
      if (copy.slack) await postFollowup(copy.slack)
    } catch (err) {
      console.error(`hold ${d.hold} for ${d.match.id.slice(0, 8)}:`, err)
    }
    sent.push({ match_id: d.match.id, hold: d.hold })
  }
  return { checked: matches.length, due: due.length, sent, skipped: null }
}
