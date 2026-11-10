import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { alertOperator } from '@/lib/alert'
import { artistInbox } from '@/lib/notify'
import { appUrl } from '@/lib/tokens'
import { easternHour } from '@/lib/holds'
import { PROBE_SOURCE, PROBE_HEADER, isProbeBrief, probeKey } from '@/lib/probe-tag'

// The daily synthetic probe (Nov 9 brief, item 8). Every morning it does what
// a client does: posts an inquiry to the public form route, signed so the
// route knows it is the probe (src/lib/probe-tag.ts). Then it checks the rows
// that request left, by the id the route returned for this run and no other:
//
//   logged  the artist_notifications row for this inquiry, status 'skipped':
//           the route reached the artist-email step and, by Erica's rule,
//           mailed nobody (a probe never writes to Lacey)
//   match   the matches row, with found_via "test-probe" in its brief
//   source  a new inquiry_sources row with source "test-probe", newer than
//           the last one that existed before this run posted
//
// What this proves: the form route is up, the database takes the lead, the
// source is counted, the route gets as far as her email. What it does not
// prove: that mail is delivered. That comes from Resend's delivery receipts
// on the real emails she gets (src/lib/delivery.ts), and the digest's system
// line is worded by which of the two it actually has.
//
// The verdict is written to probe_runs (migration 019) for the 7 PM digest,
// a miss alerts the operator the same morning, and the probe's own match is
// deleted afterwards so Lacey's inbox never shows it (the delivery-log row
// and the source row stay, detached, as the day's evidence).
//
// Run by /api/cron/probe at 13:00 and 14:00 UTC; the tick on 9 AM Eastern runs.

export const PROBE_HOUR = 9
/** The address stamped on the probe's inquiry. Nothing is ever sent to it. */
const DEFAULT_PROBE_EMAIL = 'system-probe@elitetatz.invalid'

export interface ProbeChecks {
  posted: boolean
  logged: boolean
  match: boolean
  source: boolean
}

export interface ProbeRun {
  ok: boolean
  checks: ProbeChecks
  error: string | null
  /** The match id the form minted, or the probe tag when the route gave none. */
  ref: string | null
  skipped: string | null
}

export interface ProbeOptions {
  now?: number
  force?: boolean
  fetchImpl?: typeof fetch
}

export function probeTag(now: number): string {
  const day = new Date(now).toISOString().slice(0, 10)
  return `probe-${day}-${randomBytes(4).toString('hex')}`
}

export async function runProbe(db: SupabaseClient, opts: ProbeOptions = {}): Promise<ProbeRun> {
  const now = opts.now ?? Date.now()
  const fetchImpl = opts.fetchImpl ?? fetch
  const checks: ProbeChecks = { posted: false, logged: false, match: false, source: false }
  const problems: string[] = []
  if (!opts.force && easternHour(now) !== PROBE_HOUR) {
    return { ok: false, checks, error: null, ref: null, skipped: `not ${PROBE_HOUR} AM Eastern` }
  }

  const tag = probeTag(now)
  const key = probeKey(tag)
  const inbox = (process.env.PROBE_INBOX_EMAIL?.trim() || DEFAULT_PROBE_EMAIL).toLowerCase()
  if (!key) problems.push('CRON_SECRET is not set, so the probe cannot sign its request')
  if (!/^\S+@\S+\.\S+$/.test(inbox)) problems.push('PROBE_INBOX_EMAIL is not a valid address')
  else if (inbox === artistInbox().trim().toLowerCase()) problems.push('PROBE_INBOX_EMAIL is the artist inbox; the probe must never be filed under her address')

  // ---- 1. post, as the form does -------------------------------------------
  let response = ''
  let matchId: string | null = null
  let sourceBefore = 0
  if (!problems.length && key) {
    // The newest probe source row before this run: ours must be newer.
    const { data: prior } = await db.from('inquiry_sources').select('id').eq('source', PROBE_SOURCE).order('id', { ascending: false }).limit(1)
    sourceBefore = Number((Array.isArray(prior) ? prior[0] : prior)?.id ?? 0) || 0
    try {
      const res = await fetchImpl(`${appUrl()}/api/community/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: appUrl(), [PROBE_HEADER]: key },
        body: JSON.stringify({
          name: 'System Probe',
          email: inbox,
          concept: `Daily system check ${tag}. Not a client; this inquiry is removed automatically.`,
          placement: 'none',
          found_via: PROBE_SOURCE,
          probe_tag: tag,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const text = await res.text()
      response = `${res.status} ${text.slice(0, 300)}`
      checks.posted = res.ok
      if (!res.ok) problems.push(`form route answered ${response}`)
      else {
        try { matchId = String((JSON.parse(text) as { ref?: unknown }).ref ?? '') || null } catch { matchId = null }
        if (!matchId) problems.push('the form route did not treat the request as the probe (no ref in its answer): the key did not verify, or the route is an older build')
      }
    } catch (err) {
      response = err instanceof Error ? err.message : String(err)
      problems.push(`form route unreachable: ${response}`)
    }
  }

  // ---- 2. the three rows this run left ------------------------------------
  if (checks.posted && matchId) {
    const { data: row } = await db.from('matches').select('id, client_brief').eq('id', matchId).maybeSingle()
    const found = row as { id: string; client_brief: string | null } | null
    checks.match = Boolean(found && isProbeBrief(found.client_brief))
    if (!found) problems.push('no matches row for this run')
    else if (!checks.match) problems.push('the matches row for this run does not carry found_via "test-probe"')

    const { data: sources } = await db.from('inquiry_sources').select('id').eq('source', PROBE_SOURCE).gt('id', sourceBefore).limit(1)
    checks.source = Array.isArray(sources) && sources.length > 0
    if (!checks.source) problems.push('no new inquiry_sources row with source "test-probe" from this run')

    const { data: logs } = await db
      .from('artist_notifications')
      .select('status, error')
      .eq('ref', matchId)
      .eq('kind', 'Probe inquiry')
      .order('created_at', { ascending: false })
      .limit(1)
    const log = (Array.isArray(logs) ? logs[0] : logs) as { status: string | null; error: string | null } | undefined
    checks.logged = log?.status === 'skipped'
    if (!log) problems.push('no artist_notifications row for this run (the route never reached the artist-email step, or the log insert failed)')
    else if (log.status !== 'skipped') problems.push(`this run's artist-email row was logged as ${log.status ?? 'unknown'}, not skipped; a probe must send nothing`)
  }

  const ok = checks.posted && checks.logged && checks.match && checks.source
  const error = problems.length ? problems.join('; ') : null

  // ---- 3. record, clean up, tell someone -----------------------------------
  try {
    const { error: recErr } = await db.from('probe_runs').insert({ ran_at: new Date(now).toISOString(), ok, checks, error, ref: matchId ?? tag })
    if (recErr) console.warn('probe_runs insert:', recErr.message)
  } catch (err) {
    console.warn('probe_runs insert:', err)
  }

  if (matchId && checks.match) {
    // Keep the delivery-log row as evidence (its match_id would cascade), then
    // remove the probe's lead so it never sits in her inbox or trips a hold.
    // Only a row that carries the probe tag is ever deleted.
    const { error: detachErr } = await db.from('artist_notifications').update({ match_id: null }).eq('match_id', matchId)
    if (detachErr) console.warn('probe cleanup: detach log', detachErr.message)
    const { error: delErr } = await db.from('matches').delete().eq('id', matchId).eq('client_email', inbox)
    if (delErr) console.warn('probe cleanup: delete match', delErr.message)
  }

  if (!ok) {
    await alertOperator({
      subject: `Daily probe FAILED (${(Object.keys(checks) as (keyof ProbeChecks)[]).filter((k) => !checks[k]).join(', ')})`,
      text: `The ${PROBE_HOUR} AM synthetic inquiry did not come through cleanly.

Checks: posted ${checks.posted ? 'yes' : 'NO'}, artist-email step logged ${checks.logged ? 'yes' : 'NO'}, portal row ${checks.match ? 'yes' : 'NO'}, source counted ${checks.source ? 'yes' : 'NO'}.
Problems: ${error ?? 'none recorded'}
Form response: ${response || 'not attempted'}
Tag: ${tag}${matchId ? `, match ${matchId.slice(0, 8)}${checks.match ? ' (removed)' : ''}` : ''}
When: ${new Date(now).toISOString()}

A real inquiry today may be taking the same path. Check Supabase and the function logs for /api/community/inquiry, then run the probe by hand: GET /api/cron/probe?force=1 with the cron bearer.`,
    })
  }

  console.log(`probe: ${ok ? 'OK' : 'FAILED'} ${JSON.stringify(checks)}${error ? ` (${error})` : ''}`)
  return { ok, checks, error, ref: matchId ?? tag, skipped: null }
}
