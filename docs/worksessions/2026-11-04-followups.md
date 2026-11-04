# 2026-11-04 — Follow-ups to do soon (not shelved)

Erica's instruction, Nov 4: these are tasks with a date, not a backlog. Each row says what it unlocks, who does it, and the exact variables.

Where things stand: PRs 35, 36, 38 merged and live. Migration 017 applied. Google OAuth app `elitetatz` pushed to **In production** (Calendar read-only; Gmail scope and API removed). The Oct 7 pending lead is `QA Test Erica`, not a client.

## 1. Google Data Access declaration and verification — Erica, this week

The code requests `https://www.googleapis.com/auth/calendar.readonly`. Google's Data Access page lists nothing, so Google treats the app as asking for an *undeclared* sensitive scope: Lacey sees "Google hasn't verified this app" (she can click Advanced → continue), and the 100-user lifetime cap applies to every artist who connects.

Steps, in Google Cloud → Google Auth Platform (project `elitetatz`):

1. **Data Access → Add or remove scopes** → tick `…/auth/calendar.readonly` → Update → Save. The scope is now declared; the Verification Center switches from "not required" to "needs verification".
2. **Branding**: privacy link → `https://elitetatz.app/privacy` (the EliteTatz page, this PR), home page `https://elitetatz.app`. Authorized domains already hold `elitetatz.app`, `rawsunart.com`, `elitetatz.vercel.app`, the Supabase host.
3. **Verification Center → Prepare for verification**: justification for Calendar read ("the artist's own dashboard shows their upcoming appointments so they can offer dates; read-only; nothing stored"), and a short screen recording (YouTube, unlisted) of: open elitetatz.app → sign in → Connections → Connect Google Calendar → consent screen → back on the dashboard with the connection shown. Submit.
4. Until approved, Lacey can still connect; the warning is cosmetic for one artist.

## 2. Dialpad texts — Erica, this week · unlocks hold-timer texts to Lacey and the client, and texted replies

Set on the **elitetatz** Vercel project (Production; redeploy after):

| Variable | Where it comes from | What stops without it |
|---|---|---|
| `DIALPAD_API_TOKEN` | Dialpad → Admin → Company settings → API keys → create a key with SMS scope | No outbound texts: the hold timers and the dashboard reply box send email only |
| `DIALPAD_FROM_NUMBER` | The Dialpad number texts should come from, E.164 (`+16145551234`) | Same |
| `DIALPAD_WEBHOOK_SECRET` | Dialpad → Developers → Webhooks → create webhook to `https://elitetatz.app/api/inbound/sms`, event `sms` (incoming); the secret you set there | Inbound texts never land on a lead. Outbound still works with the two above |

Optional: `ARTIST_SMS_NUMBER` (Lacey's own cell, E.164) so her texts from her phone are recognised as hers and not as a client.

## 3. Resend Receiving — Erica + Lacey, 45 min, week of Nov 10 · unlocks client email replies landing on the thread

Today a client who taps Reply in their mail app answers `lacey@rawsunart.com`, which is her Gmail, and the thread never sees it.

Set on the **elitetatz** Vercel project:

| Variable | Where it comes from |
|---|---|
| `RESEND_API_KEY` | Already set |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → Add endpoint `https://elitetatz.app/api/inbound/email`, event `email.received` → the `whsec_…` signing secret |
| `INBOUND_EMAIL_ADDRESS` | The receiving address, e.g. `leads@inbox.rawsunart.com`, after Resend → Domains → add `inbox.rawsunart.com` for receiving (one MX record at the DNS host) |
| `DEFAULT_FROM_EMAIL` | Optional; defaults to `RawSunArt <club@rawsunart.com>`. Must be on a Resend-verified domain |
| `ARTIST_NOTIFICATION_EMAIL` / `ARTIST_NOTIFICATION_CC` | Already set; also used to recognise Lacey's own address in forwarded mail |

Then in Lacey's Gmail: Settings → Forwarding → add the receiving address, confirm, filter "from anyone except my own addresses" → forward. Send one test from an outside address and watch it become a card.

## 4. Slack #followups-needed webhook — Erica, 10 min · unlocks a one-line nudge to *Erica*, not Lacey

What it does, exactly: `SLACK_FOLLOWUPS_WEBHOOK` is read in two places.

- **elitetatz** `src/lib/holds.ts`: when a hold timer fires (artist silent 48 h, client silent, deposit outstanding), after the email/text to the person who owes the next move, it posts one line to a Slack channel. The line is for the operator: "a lead needs a nudge, open the inbox". No client name or words. Lacey never sees Slack.
- **woopsi-ink** `rsa-reconnect-report` cron, daily 15:00 UTC: posts the Reconnect tally (sent / remaining / replies) to the same channel.

So it is your operator feed: proof the timers and the Reconnect run are alive, and the thing you would check instead of the dashboard. Without it both still run; you just do not hear about them.

Set the same value on **both** Vercel projects: Slack → your workspace → Apps → Incoming Webhooks → add to a channel (e.g. `#followups-needed`) → copy the `https://hooks.slack.com/services/…` URL → `SLACK_FOLLOWUPS_WEBHOOK`.

## 5. Clear the QA test lead — on Erica's word

`matches` row `239eb092-…` ("QA Test Erica", erica@measurementally.com, Oct 7). Decline it from the dashboard or set status `declined` so Lacey's inbox is empty at zero and the example card shows.

## 6. Lacey's taps (unchanged)

- Sign in with Google at elitetatz.app, then Connections → Connect Google Calendar. This is the first real exercise of the OAuth setup.
- Approve the Reconnect send (197 eligible, 0 sent). Nothing goes out without her tap.

## 7. Terms of service page — later, before a second artist

`/terms` does not exist. Google's Branding has an optional terms link; the sign-up page says "Terms of Service and Privacy Policy". Write it when the artist agreement is settled.
