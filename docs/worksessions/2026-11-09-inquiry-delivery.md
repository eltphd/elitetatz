# Worksession, Nov 9 2026: every client message reaches Lacey's email

**Brief:** `rawsunart-inquiry-delivery-fixes.md` (Erica, Nov 9, P0).
**Branches:** elitetatz `fix/every-message-reaches-lacey`; rawsunart-web `fix/inquiries-email-lacey`.

## What the audit got right, and one thing it missed

The brief's finding 2 said nothing shows the portal emails Lacey on an inquiry. The code did call `notifyArtist` on every form inquiry, and production has `ARTIST_NOTIFICATION_EMAIL=lacey@rawsunart.com` and a Resend key. So the portal was configured to email her. What was missing is everything that would let anyone *know* it worked:

- the send was fire-and-forget: a false return was logged to Vercel and nowhere else, and Vercel keeps runtime logs for one day on this plan
- it ran after the database write, so a Supabase outage dropped the email too
- the email had no reply-to, so answering it from her mail app went to club@rawsunart.com
- a failed Turnstile check returned 403 and the inquiry was gone
- `artist_notifications` had zero rows because nothing wrote there except the deposit webhook

Production data today: 1 match (Erica's Oct 6 concierge test), 1 `inquiry_sources` row, 0 `artist_notifications`, 0 `inbound_events`, 0 `hold_events`. No real client has come through the form since it went live on Oct 7. SMS (Dialpad) and Slack are not configured in production, so email is the only channel that exists today.

## Done in elitetatz (this branch)

| Brief item | Change |
|---|---|
| 1. Email Lacey on every accepted inquiry, before/independent of the DB write, with full form, reply-to the client, portal link; log each attempt | `api/community/inquiry/route.ts` rewritten: validate → email Lacey → write portal → count source → client receipt. The match id is minted up front so the email can carry a ref before the row exists. `lib/notify.ts` logs every attempt to `artist_notifications` (migration 018: `status`, `error`, `provider_id`, `recipient` masked, `kind`, `ref`) and attaches the match id once it is written. |
| 2. Email Lacey on every later client message | Already in place for inquiry-page replies, date requests, reference uploads, inbound email/SMS/DM, deposits and hold timers. Each now passes the match and the client's address as reply-to. Concierge chats only become a message when the brief is submitted (`/api/brief`), which emails her; a chat the client abandons is not a message to her. |
| 3. Never reject a real inquiry silently | Turnstile failure no longer returns 403. The inquiry is accepted, the email subject starts with `[possible bot]`, the brief carries `bot_check: failed`, and the thread's system line says so. Honeypot is unchanged (fake success, nothing sent). Rate limits unchanged (5 per IP per 10 min, 100 per day). |
| 4. Record the source server-side | Was already in the route since Oct 7. The rawsunart-web fix branch had restored the client ping, which would have double-counted; removed it there. The old `/api/community/inquiry-source` route stays for cached copies of the page. |
| 5. Reply-To | `sendEmailDetailed` defaults reply-to to lacey@rawsunart.com for everything (Collectors Club welcome, approvals, client mail). Artist emails use the client's address instead. Operator alerts and CC copies set none. Auto-forwarding of mail that lands at club@rawsunart.com is a mailbox setting, not code: see "Still to do". |
| 6. Alert on delivery failure | `lib/alert.ts`: a failed artist email, a portal write that failed while the email went, or both lost, each email `OPERATOR_EMAIL` (set in production) and post to Slack when `SLACK_FOLLOWUPS_WEBHOOK` is set, inside the same request. The alert names the kind, ref and error, never the client. Resend calls now time out at 15 s instead of hanging. |

Also: a repeat form from the same email within 24 hours used to be swallowed (ok, no email). It now joins the open inquiry as a client message and emails Lacey as "Inquiry follow-up". If the artist row or the database cannot be read, the email still goes and the response says `portal: false`. If both the email and the portal fail, the route returns 500 and rawsunart.com opens the client's mail app addressed to her.

Tests: `__tests__/unit/community-inquiry-route.test.ts` (8 cases: happy path, failed bot check, honeypot, DB insert failure, no DB, both lost, repeat, validation) and `__tests__/unit/notify.test.ts` (5 cases: logged sent, logged failed + alert without client details, log failure never breaks the send, CC copy, client reply-to). Full suite: 201 passing.

## Done in rawsunart-web (fix branch, one commit added)

Removed the restored client-side `inquiry-source` ping so each inquiry is counted once, by the portal. The Formspree path, the parallel send, the mailto fallback and the site check are as the brief describes.

## Still to do before this counts as delivered

1. **Apply migration 018 to the production database.** The auto-mode classifier refused to run it from the session. Until it runs, the delivery log insert fails (the warning is in the function log) and the send still goes; nothing else depends on it. SQL is in `supabase/migrations/018_delivery_log.sql`.
2. **Formspree checks** from the brief (target address is lacey@rawsunart.com; plan limit; over-limit alert). Dashboard-only.
3. **Mailbox forwarding**: anything arriving at club@rawsunart.com forwards to lacey@rawsunart.com. Google Workspace / mail host setting.
4. **Live test after both deploys**: one inquiry from rawsunart.com, then check (a) two emails in Lacey's inbox (Formspree and portal) with the client as reply-to, (b) the thread in the portal, (c) one `inquiry_sources` row, (d) one `artist_notifications` row with `status = 'sent'`. Then a second test with Turnstile broken (wrong token) to see `[possible bot]` arrive.
5. **Deliverability** (SPF, DKIM, DMARC for rawsunart.com in Resend) and Lacey adding club@rawsunart.com to contacts.

## P1 (this week), not started

Daily 7 PM digest, daily synthetic probe tagged `test-probe`, 24-hour unanswered nudge (the hold-timer cron already sends A1 at 36 h; move it to 24 h or add a one-tap reply link), deliverability check. Each is a cron route plus a template; none changes the P0 path above.
