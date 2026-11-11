import { createHmac, timingSafeEqual } from 'crypto'

// The daily synthetic probe (brief item 8, Nov 9 2026) submits one inquiry a
// day through the real form route. It mails nobody: the artist-email step is
// logged as skipped, there is no client receipt, and its lead is deleted once
// the rows are checked. Everything that counts or nudges reads the tag below
// so the probe never looks like a client: the hold timers skip it, the digest
// and the scorecard leave it out of their totals.
//
// The tag alone proves nothing. `found_via` comes from the public form body,
// which rawsunart.com fills from utm_source, so anyone can send "test-probe".
// A request is a probe only when it also carries a key the probe run signed
// with CRON_SECRET (verifiedProbe). An unsigned "test-probe" is a real
// inquiry: the form route takes it down the normal path in full and stores
// its source as "direct", so isProbeBrief can never match a real lead.

export const PROBE_SOURCE = 'test-probe'
/** Header the probe run sends: HMAC-SHA256 of its run tag, keyed with CRON_SECRET. */
export const PROBE_HEADER = 'x-probe-key'

const DAY = 86_400_000
const TAG = /^probe-(\d{4}-\d{2}-\d{2})-[0-9a-f]{8}$/

/** The key for a run tag, or null when there is no CRON_SECRET to sign with. */
export function probeKey(tag: string): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return null
  return createHmac('sha256', secret).update(`probe.${tag}`).digest('hex')
}

/** True only for a request the probe run itself signed, for a tag dated within a day of now. */
export function verifiedProbe(tag: unknown, key: string | null | undefined, now = Date.now()): boolean {
  if (typeof tag !== 'string' || !key) return false
  const m = tag.match(TAG)
  if (!m) return false
  const day = Date.parse(`${m[1]}T00:00:00Z`)
  if (!Number.isFinite(day) || now - day < -DAY || now - day > 2 * DAY) return false
  const expected = probeKey(tag)
  if (!expected) return false
  const a = Buffer.from(key.trim())
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** True when a match's client_brief (JSON text) was written by a verified probe. */
export function isProbeBrief(brief: string | null | undefined): boolean {
  if (!brief) return false
  try {
    const parsed = JSON.parse(brief) as { found_via?: unknown }
    return parsed?.found_via === PROBE_SOURCE
  } catch {
    // Not JSON (an older concierge brief): a plain tag match is the fallback.
    return brief.includes(`"found_via":"${PROBE_SOURCE}"`)
  }
}
