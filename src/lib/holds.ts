import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { inquiryUrl, appUrl, handledUrl } from '@/lib/tokens'
import { depositLinkFor } from '@/lib/deposit'
import { chatwootReply } from '@/lib/inbound/chatwoot'
import { postFollowup } from '@/lib/slack'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { isProbeBrief } from '@/lib/probe-tag'
import { handledElsewhere } from '@/lib/handled'

export { handledElsewhere, HANDLED_NOTE } from '@/lib/handled'

// Hold timers: Lacey hears when a lead has waited on her. Run hourly by
// /api/cron/holds. Pure decision (`dueHolds`) first, then one send per hold per
// lead, recorded in `hold_events` (migration 016) so a second tick sends nothing.
//
//   Hold  State                                        Client (only if switched on)   Lacey
//   A1    waiting on Lacey 24 h (new, or replied)      never                          one email, reply-to the client (+ text)
//   A2    waiting on Lacey 72 h                        never                          nudge + Slack YOUR MOVE
//   B     Lacey asked, client silent 72 h              "answer when ready"            none
//   B14   …14 d                                        none                           one line
//   C     quoted, no deposit 72 h                      "quote good 14 days"           none
//   C14   …14 d                                        none                           "expired; reopen or let go"
//   D     deposit in, no date 72 h                     "pick a date"                  none
//   E     date asked, unconfirmed 48 h                 "confirm by {day}"             nudge
//
// THE RULE (Erica, Nov 18 2026): the portal does not write to a client on a
// timer. It only sees what happens inside it. Lacey answers people by text,
// by phone, in Messenger and at the shop, and to the portal all of that looks
// like silence. On Nov 11 and 13 it told a client "still with Lacey" and then
// "her books are full this week" after she had already sent that client a
// deposit request. That cannot happen again, so:
//
//   - The two "you are still waiting" notes to a client (the old A1C at 36 h
//     and the client half of A2) are gone. There is no switch for them.
//   - The other timed client notes (B, C, D, E) are off unless
//     HOLD_CLIENT_NOTES names them ("C,D"). Each is only true if the portal
//     has seen everything, which today it has not.
//   - A lead she has dealt with somewhere else is not timed at all: her own
//     note on the card, or one tap on "I already handled this" (on the card,
//     in the reminder, in the digest), stops the reminders until the client
//     writes again somewhere the portal sees (`handledElsewhere`).
//
// Everything is sent only between 9 AM and 8 PM Eastern. A hold whose window
// opened before the cron existed (an old pending lead) is left alone: the
// first run after deploy must not write to every stale lead at once.
//
// Erica's rule (Nov 9): Lacey never gets two emails about the same thing. A1
// is her one email about a wait, reply-to the client, so answering it from
// her mail app is the reply. A2 at 72 h is the single escalation. During the
// 7 PM digest hour A1 and A2 still write their record but send her nothing:
// the digest carries the lead in one line instead. The daily probe's inquiry
// is never a hold: it is not a client.

export type Hold = 'A1' | 'A2' | 'B' | 'B14' | 'C' | 'C14' | 'D' | 'E'

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** How long after a hold becomes due it may still fire. Older than this is history. */
export const GRACE = 7 * DAY

// [opens, closes) in ms since the wait began. The second of each pair closes the first,
// so an escalation never sends the earlier message after the later one.
export const WINDOW: Record<Hold, [number, number]> = {
  A1: [24 * HOUR, 72 * HOUR],
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
  /** JSON text; only read to recognise the daily probe. */
  client_brief?: string | null
}

export interface HoldMessage {
  match_id: string
  sender: 'artist' | 'client' | 'system'
  body: string
  created_at: string
  /** `mailbox` is set on a message that lives in her own mailbox (inbound/ingest.ts). */
  meta?: Record<string, unknown> | null
}

/** One of her private notes on a lead (lead_notes, author 'artist'). */
export interface HoldNote {
  match_id: string
  created_at: string
  body?: string | null
}

export interface Due {
  hold: Hold
  match: HoldMatch
  /** When the wait began (ISO). */
  since: string
}

export const HOLD_COLUMNS =
  'id, status, channel, client_name, client_email, client_phone, external_thread_id, ai_summary, created_at, updated_at, artist_responded_at, booked_at, appointment_at, date_request, proposed_dates, client_brief'

const WAITING_ON_ARTIST = ['pending', 'info_requested', 'accepted']
const OPEN = ['pending', 'info_requested', 'accepted', 'paid', 'booked']

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

function inWindow(hold: Hold, since: number, now: number): boolean {
  const age = now - since
  const [open, close] = WINDOW[hold]
  return age >= open && age < close
}

/**
 * Has the conversation moved into her mailbox? True when the last word (not
 * counting system lines) is a client email that reached her directly, or her
 * own reply from her mail app. Whoever answers next can do it there without
 * the portal seeing it, so the portal does not time what it cannot see.
 *
 * The same holds for a message she pasted in herself with "Add a lead"
 * (meta.pasted_by): a Messenger or Instagram DM, a text, a talk at the shop.
 * The conversation lives where she got it. The portal is not connected to
 * that place, cannot reach that client, and never sees her answer. On Nov 12
 * 2026 she pasted a Messenger message in to use the wording helper, and was
 * then reminded twice and listed nightly about her own pasted note.
 */
export function inHerMailbox(thread: Pick<HoldMessage, 'sender' | 'created_at' | 'meta'>[]): boolean {
  let lastWord: Pick<HoldMessage, 'sender' | 'created_at' | 'meta'> | null = null
  for (const m of thread) {
    if (m.sender !== 'system' && (!lastWord || ms(m.created_at) >= ms(lastWord.created_at))) lastWord = m
  }
  const meta = (lastWord?.meta ?? null) as { mailbox?: unknown; pasted_by?: unknown } | null
  return Boolean(meta && (meta.mailbox || meta.pasted_by))
}

/**
 * When the client started waiting on Lacey, in ms: the inquiry itself while
 * she has not touched it, or their last message when it is newer than her
 * last one. 0 when the ball is not in her court, when the thread has moved
 * into her mailbox (see inHerMailbox), or when she has noted it as handled
 * somewhere else (see handledElsewhere). Shared with the digest, so its
 * "waiting on you" list is exactly the leads the A holds would time.
 */
export function waitingOnArtistSince(
  match: Pick<HoldMatch, 'status' | 'created_at' | 'artist_responded_at'>,
  thread: Pick<HoldMessage, 'sender' | 'created_at' | 'meta'>[],
  notes: Pick<HoldNote, 'created_at'>[] = []
): number {
  if (!WAITING_ON_ARTIST.includes(match.status)) return 0
  if (inHerMailbox(thread)) return 0
  if (handledElsewhere(thread, notes)) return 0
  let lastArtist = 0
  let lastClient = 0
  // The newest message that lives outside the portal: in her mailbox, or
  // pasted in by her. Up to that point the conversation was hers to carry
  // somewhere else.
  let lastOutside = 0
  for (const m of thread) {
    const t = ms(m.created_at)
    if (m.sender === 'artist') lastArtist = Math.max(lastArtist, t)
    if (m.sender === 'client') lastClient = Math.max(lastClient, t)
    const meta = (m.meta ?? null) as { mailbox?: unknown; pasted_by?: unknown } | null
    if (m.sender !== 'system' && meta && (meta.mailbox || meta.pasted_by)) lastOutside = Math.max(lastOutside, t)
  }
  // Her note counts as her having acted, and so does a stretch of the
  // conversation the portal could not see: when the client writes again
  // after either, the wait is counted from their new message, not from the
  // day the inquiry first arrived.
  let lastNote = 0
  for (const n of notes) lastNote = Math.max(lastNote, ms(n.created_at))
  const artistActed = lastArtist > 0 || Boolean(match.artist_responded_at) || lastNote > 0 || lastOutside > 0
  const lastArtistAt = Math.max(lastArtist, ms(match.artist_responded_at), lastNote, lastOutside)
  return !artistActed ? ms(match.created_at) : lastClient > lastArtistAt ? lastClient : 0
}

/** Which holds are due for these leads right now. Pure: no I/O. */
export function dueHolds(matches: HoldMatch[], messages: HoldMessage[], now: number, notes: HoldNote[] = []): Due[] {
  const byMatch = new Map<string, HoldMessage[]>()
  for (const m of messages) {
    const list = byMatch.get(m.match_id) ?? []
    list.push(m)
    byMatch.set(m.match_id, list)
  }
  const notesBy = new Map<string, HoldNote[]>()
  for (const n of notes) {
    const list = notesBy.get(n.match_id) ?? []
    list.push(n)
    notesBy.set(n.match_id, list)
  }
  const due: Due[] = []
  const push = (hold: Hold, match: HoldMatch, since: number) => {
    if (since > 0 && inWindow(hold, since, now)) due.push({ hold, match, since: new Date(since).toISOString() })
  }

  for (const match of matches) {
    if (!OPEN.includes(match.status)) continue
    if (isProbeBrief(match.client_brief)) continue
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

    // The conversation has moved into her mailbox: the last word is a client
    // email that reached her directly, or her own reply from her mail app.
    // Whoever answers next can do it there without the portal seeing it, so
    // the portal does not time what it cannot see. A wrong "still with Lacey"
    // to a client she already answered, or a nudge to her about it, costs
    // more trust than a missed reminder. The timers pick up again the moment
    // either side writes somewhere the portal does see (the inquiry page, the
    // form, a DM, or her inbox here). Quotes, deposits and dates (C, D, E)
    // are her own taps in the portal and stay timed.
    //
    // The same goes for a lead she has noted as handled somewhere else (a
    // text, a call, Messenger, a deposit request from the shop): the portal
    // saw none of it, so it times none of it.
    const inMailbox = inHerMailbox(thread) || Boolean(handledElsewhere(thread, notesBy.get(match.id)))
    if (inMailbox && ['pending', 'info_requested'].includes(match.status)) continue

    // A: the client is waiting on Lacey — a new lead she has not touched, or a
    // client message newer than her last one, before any deposit.
    if (WAITING_ON_ARTIST.includes(match.status) && !inMailbox) {
      const since = waitingOnArtistSince(match, thread, notesBy.get(match.id))
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
/** The hour (Eastern) the daily digest goes to Lacey; A1 and A2 leave her email to it then. */
export const DIGEST_HOUR = 19

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

/**
 * A client's idea as one short line, for a subject or a list. A form inquiry
 * stores their whole message as the concept, line breaks included.
 */
export function oneLine(text: string | null | undefined, max = 80): string {
  const one = (text ?? '').replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one
}

/** Client messages go out 9 AM–8 PM Eastern only. */
export function sendingHours(now: number): boolean {
  const h = easternHour(now)
  return h >= 9 && h < 20
}

/** The timed client notes that can be switched on. The "still waiting" notes are not among them. */
const SWITCHABLE: Hold[] = ['B', 'C', 'D', 'E']

/**
 * Which timed notes to a client are switched on: HOLD_CLIENT_NOTES, a comma
 * list of B, C, D, E. Unset means none, which is the default on purpose (see
 * THE RULE at the top of this file).
 */
export function clientNotesOn(raw: string | undefined = process.env.HOLD_CLIENT_NOTES): Set<Hold> {
  const on = new Set<Hold>()
  for (const part of (raw ?? '').split(',')) {
    const h = part.trim().toUpperCase() as Hold
    if (SWITCHABLE.includes(h)) on.add(h)
  }
  return on
}

/** "Already handled it?" and the one-tap link, for the end of a reminder to her. */
export function handledLine(matchId: string, first: string): string {
  const url = handledUrl(matchId)
  return url ? `Already answered ${first} another way (text, call, Messenger, at the shop)? Tap here and the reminders stop:\n${url}` : ''
}

interface Copy {
  client?: { subject: string; text: string; sms: string }
  artist?: { subject: string; text: string; sms: string }
  slack?: string
  /** Private note for lead_notes when nothing goes to the client. */
  note?: string
}

/** `tellClient` is true when this hold's client note is switched on; her copy only says "the client was told" when it was. */
export function copyFor(due: Due, now: number, tellClient = false): Copy {
  const { hold, match } = due
  const since = ms(due.since)
  const name = match.client_name?.trim() || 'there'
  const concept = oneLine(match.ai_summary) || 'your piece'
  const inquiry = inquiryUrl(match.id)
  const dashboard = `${appUrl()}/dashboard`
  const ref = match.id.slice(0, 8)
  const sig = `— ${ARTIST_CONFIG.handle}`
  const who = `${match.client_name?.trim() || 'A client'} · ${concept}`

  switch (hold) {
    case 'A1': {
      // Her one email about this wait. Reply-to is the client (notifyArtist),
      // so answering it from her mail app is the reply. Nothing goes to the
      // client about the wait, now or later.
      const first = match.client_name?.trim().split(' ')[0] || 'the client'
      const email = match.client_email?.trim()
      const handled = handledLine(match.id, first)
      return {
        artist: {
          subject: `Waiting a day: ${concept}`,
          text: `${who} wrote a day ago and the portal has not seen an answer.\n\n${
            email
              ? `Reply to this email and it goes straight to ${first} (${email}); that is the whole answer.`
              : `This one came in without an email address; answer from your inbox.`
          }\nOr from your inbox: ${dashboard}\n\nNothing has been sent to ${first} about the wait, and nothing will be.${handled ? `\n\n${handled}` : ''}`,
          sms: `${who} has waited 24 hours. Reply to the email, or from your inbox: ${dashboard}`,
        },
      }
    }
    case 'A2': {
      const first = match.client_name?.trim().split(' ')[0] || 'the client'
      const handled = handledLine(match.id, first)
      return {
        artist: {
          subject: `Waiting 3 days: ${concept}`,
          text: `${who} wrote three days ago and the portal has not seen an answer. Nothing has been sent to ${first} about the wait. This is the last reminder about it.\n\nReply or pass from your inbox:\n${dashboard}${handled ? `\n\n${handled}` : ''}`,
          sms: `${who} has waited 3 days. Last reminder. Reply or pass: ${dashboard}`,
        },
        slack: `Lead ref ${ref} has waited 72 h with no reply from Lacey that the portal can see. Nothing was sent to the client. YOUR MOVE: check with Lacey whether she answered another way; she can reply, pass, or mark it handled from her inbox (${dashboard}).`,
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
          text: `${who} asked for a date two days ago${match.date_request ? ` ("${match.date_request}")` : ''}.${tellClient ? ` The client was told you'll confirm by ${day}.` : ' Nothing has been sent to them about the wait.'}\n\nConfirm or change it:\n${dashboard}`,
          sms: `${who} asked for a date 2 days ago${tellClient ? `; told you'll confirm by ${day}` : ''}. ${dashboard}`,
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

  const [{ data: msgs }, { data: events }, { data: nts }] = await Promise.all([
    db.from('match_messages').select('match_id, sender, body, created_at, meta').in('match_id', ids).order('created_at', { ascending: true }),
    db.from('hold_events').select('match_id, hold').in('match_id', ids),
    // Her own notes: a note newer than the last word means she handled it elsewhere.
    db.from('lead_notes').select('match_id, created_at').in('match_id', ids).eq('author', 'artist'),
  ])
  const already = new Set(((events ?? []) as { match_id: string; hold: string }[]).map((e) => `${e.match_id}:${e.hold}`))

  const due = dueHolds(matches, (msgs ?? []) as HoldMessage[], now, (nts ?? []) as HoldNote[]).filter((d) => !already.has(`${d.match.id}:${d.hold}`))
  const sent: HoldRun['sent'] = []
  // In the digest hour the digest is her one email; an A nudge now would pair with it.
  const digestHour = easternHour(now) === DIGEST_HOUR
  const tell = clientNotesOn()

  for (const d of due) {
    // A timed note to a client goes only when its hold is switched on, and
    // never for a wait on Lacey (A1, A2 have no client side at all).
    const tellClient = tell.has(d.hold)
    const copy = copyFor(d, now, tellClient)
    if (!tellClient) delete copy.client
    // Nothing to send and nothing to note: leave no record, so switching the
    // note on later still finds this hold unsent.
    if (!copy.client && !copy.artist && !copy.note && !copy.slack) continue
    // The record comes first and is the guard: a duplicate key means another
    // tick got here, and this one sends nothing.
    const { error: evErr } = await db.from('hold_events').insert({ match_id: d.match.id, hold: d.hold })
    if (evErr) {
      if ((evErr as { code?: string }).code !== '23505') console.error('hold_events insert:', evErr)
      continue
    }
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
      if (copy.artist && !(digestHour && (d.hold === 'A1' || d.hold === 'A2'))) {
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
