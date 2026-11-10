# Worksession, Nov 9–10 2026: the daily checks (P1 items 7, 8, 9)

**Brief:** `rawsunart-inquiry-delivery-fixes.md` (Erica, Nov 9), P1 "reassurance for Lacey".
**Branch:** elitetatz `feat/digest-probe-nudge`, PR #46, rebased onto `fix/no-mail-about-her-own-mailbox` (PR #47). Merge #47 first.
**Follows:** `2026-11-09-inquiry-delivery.md` (P0) and `2026-11-10-own-mailbox-rule.md` (#47).

## The rule that shaped it

Erica, Nov 9: **Lacey must never get two emails about the same thing.** The build exists to take admin load off her; stacked mail breaks her trust in it. So: one nudge per waiting lead, the digest folds nudges in rather than repeating them, the probe mails nobody, and nothing here adds per-inquiry mail to her. Operator alerts to Erica are unchanged.

## What this adds

| Brief item | Change |
|---|---|
| 9. 24-hour unanswered nudge | `src/lib/holds.ts`. **A1** is her one email about a wait, now at 24 h (was 36 h): "Waiting a day: {concept}", reply-to the client, "Reply to this email and it goes straight to Jordan (j@example.com)". **A1C** is the client's "still with Lacey" line, kept at 36 h under its own `hold_events` key, because rawsunart.com promises a reply within 48 hours. A2 at 72 h is unchanged. In the 7 PM digest hour A1 and A2 record the hold and tell the client but send her nothing. `waitingOnArtistSince` and `inHerMailbox` are shared with the digest. |
| 7. Daily 7 PM digest, sent even on zero days | `src/lib/digest.ts`, `/api/cron/digest`. One email at 7 PM Eastern: today's inquiries by first name, anyone waiting on her over 24 hours (same rule as the A holds, including #47's mailbox rule), and the morning check. A lead she was really emailed about today (a `sent` Hold A1/A2 row in the delivery log) gets "you were emailed at 10:00 AM" instead of a second reminder. Through `notifyArtist`, so it is logged and a failed send alerts; once per day. |
| 8. Daily synthetic probe | `src/lib/probe.ts`, `src/lib/probe-tag.ts`, `/api/cron/probe`, migration 019 `probe_runs`. At 9 AM Eastern it posts a signed inquiry tagged `test-probe` to the form route, then checks the rows that request left, by the id the route returned: artist-email step logged `skipped`, `matches` row with the tag, a new `inquiry_sources` row. Verdict to `probe_runs`; a miss alerts Erica; its lead is deleted afterwards. |
| Proof of delivery (review finding 3) | `src/lib/delivery.ts`, migration 020. Resend's `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained` arrive on the existing signed webhook (`/api/inbound/email`) and are written onto the `artist_notifications` row by `provider_id` (`delivery_status`, `delivered_at`). Bounce or complaint alerts Erica at once. The hourly cron reports any email to her with no receipt after 15 minutes, once. The digest's line reads "System checked OK at 9:00 AM" only with a passed probe and a delivered receipt inside 26 hours; otherwise "Form and inbox checked at 9:00 AM". No mail to Lacey for any of it. |

## Review round, Nov 10 (four findings, all fixed)

1. **A real inquiry could be muted.** The probe was recognised by `found_via === 'test-probe'`, which is public input (rawsunart.com fills it from `utm_source`). Now the probe signs its run tag with `CRON_SECRET` (`x-probe-key`, HMAC-SHA256, compared with `timingSafeEqual`, tag dated within a day). Without a valid key the label means nothing: the inquiry takes the normal path in full (her email, the client receipt, alerts, the repeat lookup) and its source is stored as `direct`, so `isProbeBrief` can never match a real lead. The probe run also deletes only a row that carries the tag.
2. **The digest could say "you were emailed" when she was not.** It read `hold_events`, which is written in the digest hour even though her email is suppressed then. It now reads the delivery log (`kind` Hold A1/A2, `status = 'sent'`, today).
3. **"System checked OK" overclaimed.** The probe sends no mail, so a dead Resend key left it green. Delivery receipts (above) now back the line, and without one it says only what was checked.
4. **Clients were told "still with Lacey" at 24 h.** Only her nudge was meant to move. Split into A1 (her, 24 h) and A1C (client, 36 h).

Smaller: stale header comments in `probe-tag.ts` and migration 019 rewritten; `/api/cron/holds` uses the shared gate in `src/lib/cron.ts`; the probe's checks match this run's rows (match and log by the returned id, source by a row newer than the last one before the post).

Carried through the rebase onto #47: `notifyArtist({ skip })` replaces the earlier `probe` flag; `waitingOnArtistSince` returns 0 when the last word is in her mailbox; the digest's thread query selects `meta`.

## Schedules (vercel.json)

Vercel crons run in UTC and Eastern moves. Each new cron is scheduled at the two UTC hours that can be its Eastern hour and the route acts only on the matching tick: probe `0 13,14 * * *` (9 AM), digest `0 0,23 * * *` (7 PM). Both take `?force=1` with the cron bearer. The receipt sweep rides the hourly holds cron and runs at every hour, since it writes to the operator only.

## Tests

`npx tsc --noEmit` and `npx eslint` clean. `npx jest`: 37 suites, 291 tests. Repro cases from the review are tests: unsigned / forged / wrong-tag / stale-tag `test-probe` takes the full normal path and is stored as `direct` (`community-inquiry-route.test.ts`); a hold recorded in the digest hour does not produce "you were emailed" (`digest.test.ts`); the system line with and without a fresh receipt (`digest.test.ts`); A1 at 24 h sends the client nothing and A1C at 36 h sends her nothing (`holds.test.ts`); receipts, bounce alert, sweep, and the signed webhook route (`delivery.test.ts`); probe signing and per-run checks (`probe.test.ts`); a mailbox thread is not listed as waiting (`digest.test.ts`).

## Before merge and after deploy

1. Merge #47 first. Migration 018 is already applied in production. **Apply 019 and 020 before merging this.**
2. In Resend, on the webhook that posts to `/api/inbound/email`, add the events `email.delivered`, `email.bounced`, `email.delivery_delayed`, `email.complained`. `RESEND_WEBHOOK_SECRET` must be set in Vercel; until it is, the receipt sweep is off and the digest says "Form and inbox checked".
3. Confirm `CRON_SECRET` is set (it now also signs the probe). `PROBE_INBOX_EMAIL` is optional and receives nothing.
4. **Run the probe once by hand on the first day:** `GET /api/cron/probe?force=1` with `Authorization: Bearer $CRON_SECRET`. Otherwise Lacey's first digest says no system check ran. Expect `ok: true`, no email to anyone, no row left in `matches`.
5. Confirm the digest arrives at 7 PM. The first one will say "Form and inbox checked" (no receipt yet); from the second day, with receipts arriving, "System checked OK".
6. Brief's done-when line: the probe green for 3 days running.

## Known edges

- The receipt sweep runs hourly, so "no receipt after 15 minutes" is reported between 15 and 75 minutes after the send.
- A receipt says her mail server accepted the message, not which folder it landed in.
- Receipts are recorded only for mail to Lacey (rows in `artist_notifications`); client receipts and operator alerts are not tracked.
- The digest's "today" is midnight Eastern computed from the offset at 7 PM; on the two clock-change days the boundary is off by an hour.
