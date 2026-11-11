import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyArtist } from '@/lib/notify'
import { alertOperator } from '@/lib/alert'
import { appUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { easternHour, waitingOnArtistSince, DIGEST_HOUR, type HoldMessage } from '@/lib/holds'
import { isProbeBrief } from '@/lib/probe-tag'
import { latestReceipt, RECEIPT_FRESH } from '@/lib/delivery'

// The 7 PM digest (Nov 9 brief, item 7). One email to Lacey every evening,
// zero day or not: who came in today by first name, who has waited on her
// more than a day, and whether the morning system check passed. On a quiet
// day the whole point is the line "Today: 0 new inquiries. System checked OK
// at 9:00 AM." — the form and the inbox are working, and nobody is waiting.
//
// That line only says what was checked. The probe proves the form, the inbox
// and the source count; it mails nobody. That email reaches her is proved by
// a delivery receipt from her mail server on something she was really sent
// (src/lib/delivery.ts), usually last night's digest. With a receipt inside
// the last 26 hours the line reads "System checked OK"; without one it reads
// "Form and inbox checked", which is all that was.
//
// Run by /api/cron/digest at 23:00 and 00:00 UTC; only the tick that lands on
// 7 PM Eastern sends, so the hour holds across the clock change. The send
// goes through notifyArtist, so it is logged like every other email to her
// and a failure alerts the operator. The probe's own inquiry is not counted.
//
// Erica's rule: never two emails to Lacey about the same thing. A lead the
// hold timers already emailed her about today is one line here ("you were
// emailed at 10:00 AM"), not a second reminder, and in this hour the holds
// send her nothing (src/lib/holds.ts), so a digest-and-nudge pair cannot
// happen. "Emailed" is read from the delivery log (a 'sent' Hold A1/A2 row),
// never from hold_events: a hold recorded in the digest hour sent her nothing.

const TZ = 'America/New_York'
const HOUR = 3_600_000
const DAY = 24 * HOUR
export { DIGEST_HOUR }

export interface DigestLead {
  id: string
  status: string
  client_name: string | null
  client_brief: string | null
  ai_summary: string | null
  created_at: string
  artist_responded_at: string | null
}

export interface ProbeRow {
  ran_at: string
  ok: boolean
  error: string | null
}

/** An A1/A2 email that really went to her: a 'sent' row in the delivery log. */
export interface NudgeRow {
  match_id: string
  created_at: string
}

export interface DigestSummary {
  /** "Monday, Nov 9" in Eastern time. */
  dateLabel: string
  newToday: { first: string; concept: string }[]
  /** `nudgedAt` is "10:00 AM" when a hold already emailed her about it today. */
  unanswered: { first: string; concept: string; waited: string; nudgedAt: string | null }[]
  probe: ProbeRow | null
  /** True when her mail server confirmed taking an email from us in the last 26 hours. */
  delivered: boolean
}

const WAITING = ['pending', 'info_requested', 'accepted']

// ---- time -------------------------------------------------------------------

/** Midnight Eastern of the day `now` falls in, as UTC ms. */
export function easternDayStart(now: number): number {
  const d = new Date(now)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  ) as Record<string, string>
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  const offset = wall - Math.floor(now / 1000) * 1000
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset
}

/** "2026-11-09" in Eastern time; the digest's reference for the day. */
export function easternYmd(now: number): string {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: TZ })
}

/** "9:00 AM" in Eastern time. */
export function easternClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
}

function waitedWord(sinceMs: number, now: number): string {
  const h = Math.floor((now - sinceMs) / HOUR)
  if (h < 48) return `${h} hours`
  return `${Math.floor(h / 24)} days`
}

// ---- summary (pure) -----------------------------------------------------------

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || 'A client'
const conceptOf = (lead: DigestLead) => lead.ai_summary?.trim() || 'no concept given'

export function summarize(
  leads: DigestLead[],
  messages: HoldMessage[],
  probe: ProbeRow | null,
  now: number,
  nudges: NudgeRow[] = [],
  lastReceiptAt: string | null = null
): DigestSummary {
  const dayStart = easternDayStart(now)
  const byMatch = new Map<string, HoldMessage[]>()
  for (const m of messages) {
    const list = byMatch.get(m.match_id) ?? []
    list.push(m)
    byMatch.set(m.match_id, list)
  }
  const nudgedAt = new Map<string, number>()
  for (const n of nudges) {
    const t = new Date(n.created_at).getTime()
    if (t >= dayStart) nudgedAt.set(n.match_id, Math.max(nudgedAt.get(n.match_id) ?? 0, t))
  }
  const real = leads.filter((l) => !isProbeBrief(l.client_brief))
  const newToday = real
    .filter((l) => new Date(l.created_at).getTime() >= dayStart)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((l) => ({ first: firstName(l.client_name), concept: conceptOf(l) }))
  const unanswered = real
    .filter((l) => WAITING.includes(l.status))
    .map((l) => ({ lead: l, since: waitingOnArtistSince(l, byMatch.get(l.id) ?? []) }))
    .filter(({ since }) => since > 0 && now - since >= DAY)
    .sort((a, b) => a.since - b.since)
    .map(({ lead, since }) => ({
      first: firstName(lead.client_name),
      concept: conceptOf(lead),
      waited: waitedWord(since, now),
      nudgedAt: nudgedAt.has(lead.id) ? easternClock(nudgedAt.get(lead.id)!) : null,
    }))
  return {
    dateLabel: new Date(now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' }),
    newToday,
    unanswered,
    probe,
    delivered: Boolean(lastReceiptAt) && now - new Date(lastReceiptAt as string).getTime() <= RECEIPT_FRESH,
  }
}

// ---- copy ---------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function probeLine(probe: ProbeRow | null, delivered = false): string {
  if (!probe) return 'No system check ran today; Erica has been told.'
  const at = easternClock(new Date(probe.ran_at).getTime())
  if (!probe.ok) return `The system check at ${at} did not pass; Erica has been told and is on it.`
  // "System" is claimed only when email delivery to her was confirmed too.
  return delivered ? `System checked OK at ${at}.` : `Form and inbox checked at ${at}.`
}

export function digestCopy(s: DigestSummary): { subject: string; text: string } {
  const dashboard = `${appUrl()}/dashboard`
  const names = s.newToday.map((n) => n.first)
  const newLine = `Today: ${plural(s.newToday.length, 'new inquiry', 'new inquiries')}${names.length ? ` (${names.join(', ')})` : ''}.`
  const waitLine = s.unanswered.length ? ` ${plural(s.unanswered.length, 'has', 'have')} waited on you over 24 hours.` : ''
  const headline = `${newLine}${waitLine} ${probeLine(s.probe, s.delivered)}`

  const subject = `${ARTIST_CONFIG.handle} today: ${plural(s.newToday.length, 'new inquiry', 'new inquiries')}${
    s.unanswered.length ? `, ${s.unanswered.length} waiting on you` : ''
  }`

  const sections: string[] = [headline]
  if (s.newToday.length) {
    sections.push(`Came in today:\n${s.newToday.map((n) => `• ${n.first} · ${n.concept}`).join('\n')}`)
  }
  if (s.unanswered.length) {
    sections.push(
      `Waiting on you:\n${s.unanswered
        .map((u) => `• ${u.first} · ${u.concept} · waiting ${u.waited}${u.nudgedAt ? ` · you were emailed at ${u.nudgedAt}` : ''}`)
        .join('\n')}\n\nEach one is already in your email as its own message; reply there and it reaches them. This is the only reminder tonight.`
    )
  } else {
    sections.push('Nothing is waiting on you.')
  }
  sections.push(`Your inbox: ${dashboard}`)
  sections.push(`${s.dateLabel}. This note comes every evening at 7, quiet days included, so you know the form and the inbox are working.`)
  return { subject, text: sections.join('\n\n') }
}

// ---- the run ------------------------------------------------------------------

export interface DigestRun {
  sent: boolean
  skipped: string | null
  newToday: number
  unanswered: number
  probe: 'ok' | 'failed' | 'none'
  /** Whether a delivery receipt from her mail server backs the system line. */
  delivery: 'confirmed' | 'unconfirmed'
}

export async function runDigest(db: SupabaseClient, artistId: string, opts: { now?: number; force?: boolean } = {}): Promise<DigestRun> {
  const now = opts.now ?? Date.now()
  const none: DigestRun = { sent: false, skipped: null, newToday: 0, unanswered: 0, probe: 'none', delivery: 'unconfirmed' }
  if (!opts.force && easternHour(now) !== DIGEST_HOUR) return { ...none, skipped: `not ${DIGEST_HOUR - 12} PM Eastern` }

  const ref = `digest-${easternYmd(now)}`
  if (!opts.force) {
    const { data: already } = await db
      .from('artist_notifications')
      .select('id')
      .eq('kind', 'Daily digest')
      .eq('ref', ref)
      .eq('status', 'sent')
      .limit(1)
    if (Array.isArray(already) && already.length) return { ...none, skipped: 'already sent today' }
  }

  const dayStartIso = new Date(easternDayStart(now)).toISOString()
  const { data: rows, error } = await db
    .from('matches')
    .select('id, status, client_name, client_brief, ai_summary, created_at, artist_responded_at')
    .eq('artist_id', artistId)
    .gte('created_at', new Date(now - 120 * DAY).toISOString())
    .or(`created_at.gte.${dayStartIso},status.in.(${WAITING.join(',')})`)
  if (error) throw new Error(`matches: ${error.message}`)
  const leads = (rows ?? []) as DigestLead[]

  const waitingIds = leads.filter((l) => WAITING.includes(l.status) && !isProbeBrief(l.client_brief)).map((l) => l.id)
  // `meta` carries the mailbox mark the holds read; the nudges are the A1/A2
  // emails that really went to her today, from the delivery log.
  const [{ data: msgs }, { data: nudges }] = waitingIds.length
    ? await Promise.all([
        db.from('match_messages').select('match_id, sender, body, created_at, meta').in('match_id', waitingIds).order('created_at', { ascending: true }),
        db
          .from('artist_notifications')
          .select('match_id, created_at')
          .in('match_id', waitingIds)
          .in('kind', ['Hold A1', 'Hold A2'])
          .eq('status', 'sent')
          .gte('created_at', dayStartIso),
      ])
    : [{ data: [] }, { data: [] }]

  // The morning probe's verdict (migration 019). A missing table or row reads
  // as "no check ran", which is itself something to say.
  let probe: ProbeRow | null = null
  try {
    const { data, error: probeErr } = await db.from('probe_runs').select('ran_at, ok, error').gte('ran_at', dayStartIso).order('ran_at', { ascending: false }).limit(1)
    if (probeErr) console.warn('digest: probe_runs', probeErr.message)
    const row = Array.isArray(data) ? data[0] : data
    probe = (row as ProbeRow | undefined) ?? null
  } catch (err) {
    console.warn('digest: probe_runs', err)
  }

  const lastReceiptAt = await latestReceipt(db)
  const summary = summarize(leads, (msgs ?? []) as HoldMessage[], probe, now, (nudges ?? []) as NudgeRow[], lastReceiptAt)
  const copy = digestCopy(summary)

  if (!probe) {
    await alertOperator({
      subject: 'No probe result today',
      text: `The 7 PM digest found no probe_runs row for ${easternYmd(now)}. Either /api/cron/probe did not run (check the Vercel cron log and CRON_SECRET), it threw before writing its result, or migration 019 is not applied. Lacey's digest says a check did not run.`,
    })
  }

  const notice = await notifyArtist({ kind: 'Daily digest', ref, subject: copy.subject, text: copy.text, artistId })
  return {
    sent: notice.emailed,
    skipped: null,
    newToday: summary.newToday.length,
    unanswered: summary.unanswered.length,
    probe: probe ? (probe.ok ? 'ok' : 'failed') : 'none',
    delivery: summary.delivered ? 'confirmed' : 'unconfirmed',
  }
}
