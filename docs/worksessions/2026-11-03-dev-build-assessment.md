# EliteTatz dev build: assessment and strategic brief · 2026-11-03 (evening)

**For:** Erica and the dev team. **Follows:** "EliteTatz Dev Build: state, context, and the next PRs" (6:05 PM, same day). Everything below was checked against the three repos, Supabase project `twyrxtzjictiysxqjmhu`, the Vercel team "Erica's projects" (Pro plan) and the live sites between 6:30 and 8:30 PM Eastern.

**Bottom line.** The five PRs from the 6:05 PM brief are built and open (four in elitetatz, one in woopsi-ink), `elitetatz.app` is attached and serving, and rawsunart.com has a stacked PR that moves every link to the new address. Nothing was sent to anyone: the Reconnect approval is still `pending`, 197 contacts are eligible, 0 have been sent, and the inbox holds one lead (pending since Oct 7). Between the code and the first automatic send stand one migration, nine environment values, three console settings and Lacey's tap, all listed in the runbook at the end.

## 1. What happened after the 6:05 PM brief

| PR | Repo | What | State |
|---|---|---|---|
| [#29](https://github.com/eltphd/elitetatz/pull/29) | elitetatz | PR A: hold timers (migration 016, hourly cron, `src/lib/holds.ts`, Slack line) | open, 22 suites / 155 tests green |
| [#30](https://github.com/eltphd/elitetatz/pull/30) | elitetatz | PR C: approval notice always carries a full link (email and SMS); `found_via` kept on the brief | open |
| [#31](https://github.com/eltphd/elitetatz/pull/31) | elitetatz | PR D: logo mark on the dashboard header and login, wordmark on `/artists` | open, loaded in the browser |
| [#32](https://github.com/eltphd/elitetatz/pull/32) | elitetatz | `elitetatz.app` as the default app URL; CORS and Turnstile allowlists | open |
| [#28](https://github.com/eltphd/woopsi-ink/pull/28) | woopsi-ink | PR B: scheduled Reconnect send (cron, idempotency keys, day-3 report, thin CLI) | open, 23 tests green |
| [#29](https://github.com/eltphd/woopsi-ink/pull/29) | woopsi-ink | Collectors Club default points at `elitetatz.app` | open |
| [#12](https://github.com/eltphd/rawsunart-web/pull/12) | rawsunart-web | PR E: Article schema and tracked clicks | **not merged**: the merge was blocked by this session's permissions; CI green, mergeable, one click for Erica |
| [#13](https://github.com/eltphd/rawsunart-web/pull/13) | rawsunart-web | every `elitetatz.vercel.app` reference on rawsunart.com becomes `elitetatz.app` | open, stacked on #12 |
| [#33](https://github.com/eltphd/elitetatz/pull/33) | elitetatz | this brief in `docs/worksessions` | open |

**Domain.** `elitetatz.app` (bought on Vercel, Nov 3, auto-renew, Vercel nameservers) is attached to the elitetatz project and serves (`/artists` → 200); `www.elitetatz.app` redirects 308 to the apex. `NEXT_PUBLIC_APP_URL` on Production now reads `https://elitetatz.app`. It is a build-time value, so it takes effect on the next production deployment, which is whichever elitetatz PR merges first. The `vercel.app` host keeps serving; every link already in Lacey's mail keeps working.

## 2. The three repositories

**eltphd/elitetatz** (Next.js 16, Vercel project `elitetatz`, Supabase project `twyrxtzjictiysxqjmhu`). The engine. Client side: concierge (`/agent`), inquiry page, deposit page, Collectors Club endpoints. Artist side: the lead inbox (`/dashboard`), approvals, connections, by-hand leads, PWA. Operator side: `/api/approvals`, `scripts/submit-approval.mjs`, the weekly `scorecard.sql`. Inbound adapters for email (Resend), Instagram and Messenger (Chatwoot), SMS (Dialpad). After PR A: the hourly holds cron. Serves rawsunart.com's forms and woopsi.ink's drop notifications over CORS. Tests: Jest, 22 suites / 155 tests; CI runs `tsc`, lint and tests on every PR. Live at `elitetatz.app` and `elitetatz.vercel.app`.

**eltphd/woopsi-ink** (Next.js 16, Vercel project `woopsi-ink`, its own Supabase project for orders). The store: cards, prints, wall art, Stripe checkout, Prodigi fulfilment, the 70% maker split to Lacey. It also hosts the RawSunArt Reconnect send because it already holds Lacey's Resend and service keys: after PR B, `src/lib/rsa-reconnect.ts` (the email and the send), two cron routes, and the CLI as a fallback over the same module. Tests: node:test, 23 tests. No CI workflow; Vercel builds on push.

**eltphd/rawsunart-web** (static HTML on Vercel, `rawsunart.com`). The indexable surface: home with the inquiry form, tattoos, originals, blog, for-artists, keep/goodbye. Forms and the concierge button call elitetatz; `found_via` (from `utm_source`) rides along. CI runs a site check against the live site.

## 3. Functionality assessment

### Verified live tonight

| Check | Result |
|---|---|
| `rawsunart.com/keep?t=…`, `/goodbye?t=…`, `/?utm_source=reconnect1` | 200, 200, 200 |
| Reconnect hero image `rawsunart.com/images/email/reconnect-cardinal.jpg` | 200 |
| `found_via` path: sessionStorage from `utm_source` → form payload → `inquiry_sources` row | wired; after PR C also kept on the brief |
| `elitetatz.app/artists`, `www.elitetatz.app` | 200; 308 to apex |
| `elitetatz.vercel.app/demo/inbox` (production) | 404, as intended |
| `elitetatz.vercel.app/icon-512-maskable.png` | 200 |
| `/dashboard/approvals` signed out | 307 to login, as intended |
| Supabase `approvals` | one row, `rsa-reconnect-1`, `pending`, audience 197 |
| Supabase `rsa_contacts` eligible for run 1 | 197; all 197 without `send_token` (minted at send time; expected) |
| Supabase `matches` open | 1, `pending`, created Oct 7 |
| Vercel plan | Pro: 15-minute and hourly crons allowed (Hobby would have rejected both schedules) |
| elitetatz env on Vercel | `NEXT_PUBLIC_APP_URL` (now elitetatz.app), Google trio, `OPERATOR_*`, Turnstile pair, `MATCH_TOKEN_SECRET`, `ARTIST_NOTIFICATION_*`, `RESEND_API_KEY`, `SINGLE_ARTIST_MODE`, Supabase trio, `ANTHROPIC_API_KEY`; **missing** `CRON_SECRET`, `SLACK_FOLLOWUPS_WEBHOOK`, every inbound-channel variable, `GOOGLE_REVIEW_URL` |
| woopsi-ink env on Vercel | `RESEND_API_KEY`, `FROM_EMAIL`, Stripe, Blob, Supabase (store); **missing** `CRON_SECRET`, `RSA_SUPABASE_URL`, `RSA_SUPABASE_SERVICE_ROLE_KEY`, `RSA_RESEND_API_KEY`, `RSA_MAIL_STREET`, `SLACK_FOLLOWUPS_WEBHOOK` |
| Slack `#followups-needed` | exists (C073VRVPXM2); no webhook configured yet |
| Local clones | elitetatz and woopsi-ink on `origin/main`; the woopsi-ink sibling change was identical to `d5ff19f` and was reconciled without loss |

### Points of failure found and removed

| Where | What would have gone wrong | What the PR does instead |
|---|---|---|
| Holds, first run | Every lead already past 36 h (the Oct 7 one, and any backlog after a connection step) would get "you'll hear by Thursday" at once | A hold fires only within 7 days of opening; older ones are history |
| Holds, "mark stale" | Closing the card at 14 days buries a late client reply (the inbox groups closed leads first) | Statuses never change; Lacey gets one line and a private note |
| Holds, repeat sends | A retried tick or two instances would send twice | `hold_events` row is written before the send; duplicate key means stop |
| Holds, timing | Nudges to Lacey at 3 AM | Quiet hours (9 AM–8 PM Eastern) apply to her as well as clients |
| Holds, Slack | "reply PASS {ref}" presumed a Slack listener that does not exist | The line says what to do: text Lacey, or the inbox link |
| Approval notice | A missing `NEXT_PUBLIC_APP_URL` produced a bare `/dashboard/approvals` in her email (it happened once) | `appUrl()` with a fallback; the SMS carries the link too |
| Reconnect, overlap | Two cron runs 15 minutes apart could both pick the same rows; the brief wanted `for update skip locked` (a new column and a migration) | Resend idempotency key per contact; stamp guarded by `is null`; no migration |
| Reconnect, bad key | A wrong key or an unverified domain would fail 197 times | The first refusal (4xx) aborts the run and posts one line |
| Reconnect, env | Approved but unconfigured would 503 silently every 15 minutes | Skips and reports once an hour with the variable names |
| Reconnect, wrong key | woopsi-ink's own `RESEND_API_KEY` (store account) would be used for Lacey's mail | `RSA_RESEND_API_KEY` is read first |
| Reconnect, clock | `13-16 UTC` was 9–11 AM only in daylight time; in November it is 8–11 AM | `14-16 UTC` (9:00–11:45 AM EST, Tue–Thu) |
| Reconnect, two copies | The CLI and the cron would have drifted | One module; the CLI is a thin fallback |
| Domain | Turnstile and CORS would have refused the new host | Allowlists include `elitetatz.app` and `www` |

### Points of failure that remain

| # | Failure | Owner · fix |
|---|---|---|
| 1 | Migration 016 not applied → `/api/cron/holds` returns 500 every hour (nothing is sent; Lacey sees nothing) | Erica · run `supabase/migrations/016_hold_events.sql` in the SQL editor before merging #29 |
| 2 | `CRON_SECRET` unset on either project → both crons answer 503 (by design) | Erica · `openssl rand -hex 32`, set on each project |
| 3 | woopsi-ink lacks the five RSA values → once approved, the cron skips and posts "cannot send" once an hour | Erica · set them; `RSA_RESEND_API_KEY` must be the key on the Resend account where rawsunart.com is verified (today: elitetatz's) |
| 4 | Supabase Auth URL configuration still names `elitetatz.vercel.app` → on `elitetatz.app`, Google sign-in and magic links bounce back to the old host; password sign-in works | Erica · Site URL `https://elitetatz.app`; add `https://elitetatz.app/auth/callback` to Redirect URLs (keep the old one) |
| 5 | Google OAuth client lacks the new redirect URI → "Connect Gmail and Calendar" fails with `redirect_uri_mismatch` on the new host (0 connections exist, so nothing working breaks) | Erica · add `https://elitetatz.app/api/artist/google/callback` and origin `https://elitetatz.app` |
| 6 | Cloudflare Turnstile widget hostnames → the `/artists` waitlist and the concierge's bot check fail on `elitetatz.app` | Erica · add `elitetatz.app` to the widget's hostnames |
| 7 | Google OAuth app in Testing: refresh tokens expire after 7 days, so Lacey's Gmail/Calendar connection would die weekly; `gmail.readonly` is a restricted scope (CASA assessment to publish) | see Subtractive 1 |
| 8 | Inbound channels unconnected (Resend receiving, Chatwoot, Dialpad) → the inbox and the holds only see web and concierge leads | Erica + Lacey · steps 3–6 of the LEAD-INBOX doc |
| 9 | The Oct 7 lead: pending four weeks; the holds leave it alone by design | Lacey · Pass it or answer it by hand |
| 10 | Approval card copy says "Erica sends it; nothing has gone out yet" after Approve; after PR B it goes by itself | small follow-up in `ApprovalCard.tsx` (and a "sent N of 197" line) |
| 11 | Daylight time: `14-16 UTC` becomes 10 AM–12:45 PM Eastern after March 8, 2027 | note for a Reconnect run 2 |
| 12 | Vercel analytics: the Nov 3 assessment assumed Hobby; the team is Pro, so custom events should record | re-check `count_events` after a day of traffic |
| 13 | No health view: which channels and crons are configured is only visible in Vercel's env list | see Additive 3 |

## 4. Strategic recommendations

### Additive (build or switch on)

1. **Holds live before the first send.** Apply 016, set `CRON_SECRET`, merge #29. The Reconnect email promises "you'll hear from me within two days"; A1 at 36 h is what keeps that promise when Lacey is busy.
2. **The send runs itself.** Five values on woopsi-ink and a `--test` send to Erica's own address, then the cron takes it from Lacey's tap. No terminal, no reminder.
3. **`/api/health`** (names only, operator key): which channels, crons and keys are set. One page that answers "why is nothing happening" without opening Vercel. Half a day.
4. **Scorecard to Slack, Mondays.** The weekly counts and the holds table posted to `#followups-needed` by a daily-granularity cron; numbers that nobody has to run get read.
5. **Connections in the written order**: Resend receiving → Chatwoot → Dialpad → `GOOGLE_REVIEW_URL`. Each one makes the inbox real for one more channel and the holds cover it automatically.
6. **"Sent N of 197" on the approval card** and the copy fix from remaining #10, so Lacey watches it go out from the place she approved it.
7. **Voicemail** as the next adapter (Dialpad transcription into `ingest`), already scoped in the LEAD-INBOX doc.

### Subtractive (remove or stop)

1. **Drop the Gmail read scope.** Email already reaches the inbox through the Resend forward; Gmail read adds a restricted scope, a weekly token death while the app is in Testing, and a security assessment to publish. Keep Calendar read-only (a sensitive scope, publishable without CASA) and publish the consent screen.
2. **Hide Payouts and Billing** in the dashboard nav while `PLATFORM_DEPOSITS` is off. Lacey's nav becomes Inbox · Add a lead · Approvals · Connections.
3. **Retire the CLI's real-send path** after the cron's first run; keep `--preview`, `--test`, `--submit-approval`, `--status`.
4. **Remove `/api/community/inquiry-source`** once a site check shows no callers; new inquiries are counted inside `/api/community/inquiry`.
5. **Do not count card orders for Reconnect** (no store link in the email) and **do not plan run 2** for the 521 held contacts without Lacey's review; the day-3 line says exactly that.
6. **One address.** After remaining #4–#6 are done, every new link to Lacey and to clients is `elitetatz.app`; stop quoting the `vercel.app` host in docs and mail.

## 5. Operator runbook (in order)

1. Merge rawsunart-web #12, then #13. (Article schema, click events, links to `elitetatz.app`.)
2. Supabase SQL editor: `supabase/migrations/016_hold_events.sql`.
3. Vercel → elitetatz → Production: `CRON_SECRET`; optionally `SLACK_FOLLOWUPS_WEBHOOK` (an incoming webhook for `#followups-needed`). Merge #29, #30, #31, #32, #33. The first merge deploys with `elitetatz.app` as the app URL.
4. Supabase Auth URL configuration; Google OAuth client redirect URI and origin; Cloudflare Turnstile hostnames (remaining #4–#6).
5. Vercel → woopsi-ink → Production: `CRON_SECRET`, `RSA_SUPABASE_URL`, `RSA_SUPABASE_SERVICE_ROLE_KEY`, `RSA_RESEND_API_KEY`, `RSA_MAIL_STREET`, `SLACK_FOLLOWUPS_WEBHOOK`. Merge woopsi-ink #28 and #29.
6. From `~/GithubsRepos/woopsi-ink` with the same values in `.env.local`: `node scripts/rsa-reconnect.mjs --test you@…` proves the key and the domain; `--status` reads her decision.
7. Lacey opens the approvals link she already has and taps Approve. The next Tuesday to Thursday morning, 40 go out every 15 minutes with one Slack line per run; three days after the last send, the day-3 line.

## 6. Deviations from the 6:05 PM brief, recorded

- Holds never change a lead's status; a hold fires only within a week of opening; quiet hours cover Lacey's nudges; the Slack line points at texting Lacey or the inbox, not at a reply command.
- Reconnect reads the approval straight from Supabase with the service key it already needs, not over `GET /api/approvals`; no `for update skip locked`, no new column; schedule `14-16 UTC`; `RSA_RESEND_API_KEY`; first-refusal abort; once-an-hour config report.
- PR E was not merged by this session (permission classifier); it is one click.
- The domain work was added at Erica's request during the session; the Supabase, Google and Cloudflare settings have no API this session could reach and are listed, not done.

## 7. Momentum

If steps 1–7 are done this week, the first Reconnect batch leaves on the next Tuesday morning after Lacey's tap, every reply lands as a "Returning" card, and a client who waits more than 36 hours hears from the system before they hear nothing. If they stall, the code sits behind nine variables and three console settings; the 197 addresses age; and the next ask of Lacey is harder because the link she has today leads to a queue that never moves.

Sources: the repos at the commits in the PRs above; Supabase `approvals`, `rsa_contacts`, `matches`; Vercel CLI (`teams ls`, `env ls`, `api`); live HTTP probes; Erica's message of Nov 3, 2026 ("I bought elitetatz.app").

Notion copy: https://www.notion.so/40d9b0f271a281a9b6f0efbf92fd1494
