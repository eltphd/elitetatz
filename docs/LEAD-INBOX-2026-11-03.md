# One inbox for every lead — 2026-11-03

**For:** Erica (operator), Lacey (artist). **State:** merged to main on 2026-11-03 (PR 26) with migration 014 applied. Second pass the same day: returning clients, the approvals tab, the Reconnect send gate (migration 015, to apply).

## The problem in one paragraph

Lacey's inquiries arrive five ways: the website form and concierge (already in EliteTatz), email to lacey@rawsunart.com, Instagram DMs, Facebook Messenger, and texts to the studio line. Each lives in its own app with its own attachments, its own half of the conversation and no sense of what the client actually wants. She reads the same brief three times, hunts for the reference photo in a six-month-old thread, and quotes from memory. The fix is not another app. It is one place every one of those lands as the same card, with the client's words, their files, what is still open, a starting number from her own price bands, and an assistant that has read all of it. She acts from there; nothing leaves without her tap.

## What was built

**One lead model.** Every inquiry is a row in `matches` with a `channel` (`web`, `concierge`, `email`, `instagram`, `facebook`, `sms`, `manual`) and, when the source has one, an `external_thread_id` (a Chatwoot conversation, a phone number). Every message, by any channel, is a row in `match_messages` with its channel and the source's message id, so a redelivered webhook is a no-op. Reference files live in one private storage bucket (`lead-files`), one folder per lead, read only through signed URLs minted on the server for Lacey's session or the client's signed inquiry link. `lead_notes` holds her private notes and the assistant's exchanges; `inbound_events` records every delivery with its outcome. Migration: `supabase/migrations/014_lead_inbox.sql`.

**Channel adapters** (`src/lib/inbound/*`, routes under `src/app/api/inbound/*`). Each verifies its webhook, reads the message into one shape (`NormalizedInbound`) and hands it to `ingest.ts`, which records the event, finds the open lead it belongs to (same thread, then same email, then same phone, within 120 days) or opens one, appends the client's words, downloads and stores the files, and emails and texts Lacey. The client is never written to by the adapters: her first reply from the inbox is the first thing they hear back.

| Channel | Pipe | Verification | Replies from the inbox go |
|---|---|---|---|
| Email | Resend receiving (same mechanism as hello@woopsi.ink). Lacey auto-forwards from Gmail to the inbound address; the adapter unwraps Gmail and Apple Mail forwards to recover the real sender, drops bounces and auto-replies, strips quoted history | Svix signature on every webhook | By email (Resend) and text when there is a phone |
| Instagram DM, Messenger | Chatwoot (open source, github.com/chatwoot/chatwoot; cloud or self-hosted) holds the Meta app approval and fires `message_created` | Secret key in the webhook URL | Back into the DM thread through Chatwoot's API, plus email or text when we have them |
| Text | Dialpad webhook + SMS event subscription on the studio line | HS256 JWT signed with the webhook secret | By text through the existing `lib/sms.ts` |
| By hand | `/dashboard/new`: paste a DM, read out a voicemail. Brief fields are read from the text by Claude | Her session | By whatever contact she entered |
| Web form, concierge | Unchanged | Turnstile, signed brief | Unchanged |

**The card** (`src/app/dashboard/LeadCard.tsx`). Channel badge and time; contact lines; concept; style, placement, size, budget tags; the reference files as a grid of thumbnails (PDFs as links); what the reference is for and the scale read; what is still to settle before she quotes; the starting number and its band; then her buttons, the assistant, her notes and the thread. Every message shows where it came from; the reply box says where the reply will go.

**The starting number** (`src/lib/quote.ts`). Reads size from the brief the way she does (inches, then words like "palm sized", then placement), picks her published band, nudges for color vs lines only and for how many elements are in the piece, rounds to $25, and lists every reason in a sentence she can check. It is typed into the Accept box when she opens it; she edits or sends. Over 10 inches it says to quote hourly. It never goes to the client on its own.

**The assistant** (`src/lib/assistant.ts`, `api/dashboard/assistant`). Has read the brief, the concierge transcript, every message by every channel, the reference photos (as images), and her private notes. Three one-tap reads: *What do they want?* (intention, readiness, what does not add up, what is unknown, quote/ask/pass), *Draft a clarifying message* (in her voice, at most three questions, no price), *Check the price* (is the starting number right, what would move it). Plus a free question, typed or spoken. A draft lands in her reply box or her "More info" question box with one tap and is sent only when she taps send there. The assistant has no route to a client. Model: `ASSISTANT_MODEL` (default `claude-opus-5-5`, falls back to `claude-sonnet-4-6` if the key cannot use it).

**Review request.** For a booked lead whose appointment has passed, an *Ask for a review* button sends a thank-you with the Google review link (`GOOGLE_REVIEW_URL`). Only on tap, and only when the variable is set.

**Client side.** The inquiry page has an *Add photos* button: files go straight onto the lead and Lacey gets a note. No more "did my attachment come through".

**Demo.** `/demo/inbox` is the inbox with four made-up leads, one per channel, every button faking its result locally. Nothing on it is real or sends anything. This is the page to show Lacey.

**PWA.** `manifest.webmanifest` + icons: she adds the inbox to her phone's home screen and it opens like an app at `/dashboard`.

## Why Chatwoot and not ManyChat or the Meta API directly

| Option | What it is | Verdict |
|---|---|---|
| Meta Graph API directly | Our own Meta app with `instagram_manage_messages` and `pages_messaging` | The right end state, but App Review takes weeks, needs a Business verification, a privacy policy URL and screencasts, and the Instagram account must be Business or Creator and linked to a Page. Not for this month. The adapter boundary (`NormalizedInbound`) is where a `meta` adapter drops in later without touching the inbox |
| ManyChat | Closed SaaS chatbot for IG/FB | Good at auto-replies and flows, which is exactly what we do not want (no automatic replies to clients). Its outbound API is thin and its webhooks are built around its own flows. We would be building the inbox inside ManyChat's walls |
| Chatwoot | Open-source customer conversation platform with a pre-approved Meta app on its cloud, webhooks per message, a full REST API, self-hostable (Docker) | Connects an Instagram Business account and a Facebook Page in minutes with no app review of our own, fires `message_created` with the contact and attachments, and lets us reply through its API so the client sees Lacey in their DMs. Lacey never opens Chatwoot: it is the pipe, not the place. Cloud starts free for two agents; self-hosting is a Docker compose |

**Postiz** is a publishing tool (schedule posts across networks). It is the right tool for the content side (the monthly studio diary, drops, flash) and has nothing to do with inbound leads. Keep it for publishing; do not route messages through it.

## Runs alongside, not instead

Nothing in this changes what Lacey does today. Email still lands in her Gmail (the forward is a copy). DMs stay in Instagram and Messenger (Chatwoot mirrors them; she never has to open it). Texts still ring her phone. The inbox is a second copy of all of it in one place, with the reading done: what they want, what is open, a starting number, who they are to her. The pitch to her is one sentence: try it next to what you already do for a month, and see which one you reach for when a lead comes in. If she replies from Gmail instead of the inbox, nothing breaks; the inbox simply shows the client's side and her reply is missing until she pastes it or stops caring.

## First-timers and returning clients are not the same lead

She will ask about this first, because most of her work is repeat clients and a few people have her cell. The inbox reads her own records at display time (`src/lib/client-history.ts`): past leads in `matches` by email or phone, and the client list she reviewed on October 16 in `rsa_contacts` by email. Nothing is stored, so it is never stale and never wrong about a new person.

| | First-timer | Returning (tattooed by her before) | Known (wrote before, never booked) |
|---|---|---|---|
| Card | New badge; "Still to settle before you quote" list; starting number from the bands | Green **Returning** badge with "2 sessions with you, last Mar 2025" (or "tattooed by you, last 2021-08" from the list); "They know you. Skip the pitch: confirm the piece and offer dates." | "Wrote before" badge; "Not their first message. Worth a look at why it did not book last time." |
| Process | Qualify (what, where, size, budget, reference) → quote → deposit → book | Confirm the piece → offer dates → deposit link → book. No pitch, no deposit policy unless asked | Same as first-timer, with the history in view |
| Assistant chips | What do they want? · Draft a clarifying msg · Check the price | What's new with them? · Draft a welcome back · Check the price | Same as first-timer, with the history in its context |
| Assistant prompt | Reads for intent and unknowns, recommends quote / ask / pass | Told it is a returning client: what is new against what she knows, is it an addition, a touch-up or a new piece; no re-qualifying; "offer dates now, or ask one thing" | Told they have written before |

How they reach her, and whether it lands:

| Route | In the inbox? |
|---|---|
| Email to lacey@rawsunart.com | Yes, once the Gmail forward is on |
| Text to the Dialpad studio line | Yes, once the Dialpad webhook is on |
| Call to the Dialpad line | Not yet. Next: Dialpad's voicemail transcription event into the same `ingest`, so a voicemail becomes a lead with the transcript as the client's words |
| Text or call to her personal cell | No, and it should not be: that is hers. "Add a lead" with the mic covers it in thirty seconds when she wants it on the card |
| DM, Messenger | Yes, through Chatwoot |

## Approvals: her okay before anything goes out

`/dashboard/approvals`, two tabs: **Email campaigns** and **Blog posts**. Each item is shown exactly as it will go out (the email in its own frame, the plain-text version a tap away), with the subject line, who gets it and how many, and one paragraph on what it is. She taps **Approve** or **Ask for changes** (with notes). Approve is a record, not a send.

- Erica submits with `node scripts/submit-approval.mjs` (any item) or, for the Reconnect email, `node scripts/rsa-reconnect.mjs --submit-approval` in woopsi-ink, which renders the real email and counts the real audience. Lacey gets an email and a text that something is waiting.
- Her decision emails `OPERATOR_EMAIL` (falls back to `ARTIST_NOTIFICATION_CC`).
- The Reconnect send (`--confirm-lacey-reviewed`) now reads `approvals` for key `rsa-reconnect-1` and refuses unless it says `approved`. After the run it marks the row `sent`.
- Blog posts: approval is recorded the same way; publishing is Erica committing the page to rawsunart-web.
- Demo with the real Reconnect copy in it: `/demo/approvals`.

Migration: `supabase/migrations/015_approvals.sql`. Env: `OPERATOR_API_KEY` (same value on Vercel and in the operator's `.env.local`), `OPERATOR_EMAIL`.

## Hold timers: nobody waits in silence

Five states used to go quiet with no message to anyone. An hourly cron (`vercel.json` → `/api/cron/holds`, guarded by `CRON_SECRET`) now sends one message per state, once, between 9 AM and 8 PM Eastern, and records it in `hold_events` (migration 016). The decision is a pure function (`src/lib/holds.ts`, `dueHolds`) with a test per rule.

| Hold | When | Client hears | Lacey hears |
|---|---|---|---|
| A1 | waiting on Lacey 36 h (new lead, or the client wrote after her) | "Still with Lacey. She reads every inquiry herself; you'll hear from her by {day}." | nudge, email + text |
| A2 | 72 h | "Her books are full this week; she'll answer by {day}. Reply here if you'd rather not wait." | nudge, plus one line in `#followups-needed` (`SLACK_FOLLOWUPS_WEBHOOK`) ending YOUR MOVE |
| B | she asked, client silent 72 h | "Lacey asked one thing before she quotes. Answer whenever you're ready; your spot stays open two weeks." | nothing; at 14 days one line, as a private note on the lead |
| C | quoted, no deposit 72 h | "Your quote is good for 14 days. Deposit link: …" | nothing; at 14 days "Quote expired; reopen or let it go." |
| D | deposit in, no date 72 h | "Your spot is held. Pick a date here: …" | nothing |
| E | date asked, unconfirmed 48 h | "Lacey has your date request and will confirm by {day}." | nudge |

What it will not do: change a lead's status (the inbox groups stay hers), write to a lead whose hold opened more than a week before the cron existed (an old pending lead is left alone), or send anything twice (the `hold_events` row is written before the send, and a duplicate key stops the tick). Client lines are written to the thread as the system, so she sees what they were told. Weekly counts: the hold query at the end of `supabase/scorecard.sql`.

Env: `CRON_SECRET` (Vercel sets the bearer on the cron call; without it the route answers 503 and nothing runs), `SLACK_FOLLOWUPS_WEBHOOK` (optional).

## Where the env vars go

All of them go in **Vercel → elitetatz → Settings → Environment Variables**, scope Production (and Preview if you want preview deploys to work), then redeploy. Nothing is set in Supabase: it only takes the migrations. Chatwoot, Resend and Dialpad each hold their own side of the handshake (the webhook URL pointing at the app, and the secret you copy into Vercel). The operator's `.env.local` in woopsi-ink needs `OPERATOR_API_KEY` and `ELITETATZ_URL` for the submit step, next to the Supabase and Resend values it already has.

## Onboarding: no paper instructions

Added 2026-11-03 (loop audit, fix six). A new artist and a new client get told what to do by the app itself.

**Artist, first visit to `/dashboard`.** A three-step card sits at the top until she taps "Got it": put it on your home screen (the page reads the phone and shows the Safari Share gesture on an iPhone or iPad, the three-dot menu on Android, both on anything else, and "already done" when it is opened from the icon); one card, five taps (Quote is the Accept button, Ask is More info, Reply is the box under the thread, Pass, Deposit received); nothing slips (the 36 h / 72 h / 14 d holds and the 8 pm to 9 am quiet hours). The tap writes `artists.walkthrough_dismissed_at` (migration 017) through `POST /api/dashboard/walkthrough`, so it holds across phones; nothing is kept in the browser. Dismissed with no leads yet, the card folds to one line with "Show again" (`{ dismissed: false }` clears the timestamp); dismissed once a lead exists, it is gone. Logic: `src/lib/onboarding.ts`; card: `src/app/dashboard/Walkthrough.tsx`.

**Artist, zero leads.** Under the empty-inbox note, one card marked "Example" (`src/app/dashboard/ExampleCard.tsx`) shows a made-up Instagram inquiry with the five taps live. It is rendered with the card's demo switch: every button answers on the page, no request is made, nothing is written and nothing is sent. It is one card inside her own inbox, not a demo page; `/demo/*` stays off in production.

**Artist, `/dashboard/connections`.** A checklist of the seven connections (web form, concierge, email receiving, Instagram and Messenger, texts, Google Calendar, Google Business review link), each with its real status read on the server from which env vars are set (`src/lib/connection-status.ts`: names only, a value never reaches the page), one line on what it unlocks, and who does the step. The web form is always on. Instagram and Google are the two where Lacey logs in once; Erica sets the rest. A channel that is off lists the variable names it waits on, which is the same gate the route enforces (trust rule 7). The Google row has a second half: "Ready for your tap" when the server is set and she has not yet said yes to Google.

**Client, `/inquiry/<id>` on the first visit.** While the inquiry is pending and Lacey has not written yet, a "What happens next" strip sits above the status: she reads it herself; they hear within two days, or a note tells them when (the A1 hold); the deposit goes to AION's checkout and the policy is `ARTIST_CONFIG.depositPolicy` word for word. It collects nothing and stores nothing.

**Trust rules, unchanged.** The walkthrough and the checklist send nothing. The example card cannot write. The client strip reads only what the page already had.

## Trust rules (what the system will not do)

1. **No automatic replies to clients.** Inbound adapters write to the database and notify Lacey. The only paths that write to a client are her buttons and her reply box.
2. **The assistant drafts; it does not send.** It has no outbound call. A draft is text in a box.
3. **Nothing goes to the client list** (`rsa_contacts`, `community_members`) from any of this. The Reconnect email script will not run without her approval on record, and that approval is hers to give in the inbox.
4. **Private stays private.** Notes and assistant exchanges are never rendered on the client page or in any email. Files are in a private bucket; URLs expire in an hour.
5. **Redelivery is a no-op.** Every inbound message carries the source's id; the second delivery does nothing.
6. **Her own mail does not become a lead** unless it wraps a forwarded message, and then the forwarded sender is the lead.
7. **A channel that is not configured does not exist.** Missing env vars make the route answer 503 and nothing else happens.

## What Erica connects (in this order)

1. ~~Apply migration 014~~ done 2026-11-03. **Apply migration 015** (`supabase/migrations/015_approvals.sql`) the same way, then regenerate `supabase/schema.sql`. Without it `/dashboard` still works; `/dashboard/approvals` and the Reconnect send gate do not.
2. **Set `OPERATOR_API_KEY`** (`openssl rand -hex 32`) and `OPERATOR_EMAIL` in Vercel; the same key in woopsi-ink's `.env.local`. Then `node scripts/rsa-reconnect.mjs --submit-approval` puts the real email in her queue.
3. **Email.** Resend → Receiving → add `inbox.rawsunart.com` (an MX record at the DNS host). Webhooks → add endpoint `https://<app>/api/inbound/email`, event `email.received`; copy the signing secret into `RESEND_WEBHOOK_SECRET`. Set `INBOUND_EMAIL_ADDRESS=leads@inbox.rawsunart.com`. In Lacey's Gmail: Settings → Forwarding → add that address, confirm, then a filter (from anyone, not from her own addresses) → forward. Send one test from an outside address.
4. **Instagram and Messenger.** Chatwoot account (cloud) → Inboxes → add Instagram (needs the Instagram Business account linked to the Facebook Page; Lacey logs in once) and Facebook Page. Settings → Integrations → Webhooks → `https://<app>/api/inbound/chatwoot?key=<long random>` with `message_created`. Profile → Access Token → `CHATWOOT_API_TOKEN`; the account id is in the URL → `CHATWOOT_ACCOUNT_ID`; `CHATWOOT_URL=https://app.chatwoot.com`; the random key → `CHATWOOT_WEBHOOK_SECRET`. Send one DM from another account.
5. **Texts.** Dialpad API: `POST /api/v2/webhooks` with `hook_url` and a `secret`, then `POST /api/v2/subscriptions/sms` on that webhook, `direction: inbound`, target the studio line. The secret → `DIALPAD_WEBHOOK_SECRET`.
6. **Reviews.** The Google Business "write a review" short link → `GOOGLE_REVIEW_URL`.
7. **Home screen.** On Lacey's phone: open `/dashboard`. The walkthrough card shows the gesture for her phone; the printed version is Share → Add to Home Screen.
8. **Apply migration 017** (`supabase/migrations/017_walkthrough.sql`) and regenerate `supabase/schema.sql`. Until it is applied the walkthrough shows on every visit and "Got it" answers with an error; nothing else is affected.

## What to watch

`supabase/scorecard.sql` gives the weekly numbers (leads by channel, median hours to first reply, quoted, deposit paid, passed, anything waiting over 48 hours) and inbound errors by channel. The monthly presence monitor runs it and records counts only.

## Later

- A direct `meta` adapter once an App Review is worth the time; same `NormalizedInbound`, no inbox changes.
- Voice: a Dialpad voicemail transcription webhook into the same `ingest`.
- The assistant offering to reach out itself is deliberately not built: it drafts, she sends. If that ever changes it is one allowlisted action with a confirm, not a default.
