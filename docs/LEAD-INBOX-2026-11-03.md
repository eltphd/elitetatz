# One inbox for every lead — 2026-11-03

**For:** Erica (operator), Lacey (artist). **State:** built on branch `feat/lead-inbox`; migration 014 and the channel accounts still to be connected (list at the end).

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

## Trust rules (what the system will not do)

1. **No automatic replies to clients.** Inbound adapters write to the database and notify Lacey. The only paths that write to a client are her buttons and her reply box.
2. **The assistant drafts; it does not send.** It has no outbound call. A draft is text in a box.
3. **Nothing goes to the client list** (`rsa_contacts`, `community_members`) from any of this. The Reconnect email script is untouched and is not run.
4. **Private stays private.** Notes and assistant exchanges are never rendered on the client page or in any email. Files are in a private bucket; URLs expire in an hour.
5. **Redelivery is a no-op.** Every inbound message carries the source's id; the second delivery does nothing.
6. **Her own mail does not become a lead** unless it wraps a forwarded message, and then the forwarded sender is the lead.
7. **A channel that is not configured does not exist.** Missing env vars make the route answer 503 and nothing else happens.

## What Erica connects (in this order)

1. **Apply migration 014** in Supabase (SQL editor, paste `supabase/migrations/014_lead_inbox.sql`), then regenerate `supabase/schema.sql`. The dashboard reads the new columns; without the migration the deploy will 500 on `/dashboard`. Everything else can wait.
2. **Deploy the branch** (merge the PR). Set `ASSISTANT_MODEL` only if you want a different model.
3. **Email.** Resend → Receiving → add `inbox.rawsunart.com` (an MX record at the DNS host). Webhooks → add endpoint `https://<app>/api/inbound/email`, event `email.received`; copy the signing secret into `RESEND_WEBHOOK_SECRET`. Set `INBOUND_EMAIL_ADDRESS=leads@inbox.rawsunart.com`. In Lacey's Gmail: Settings → Forwarding → add that address, confirm, then a filter (from anyone, not from her own addresses) → forward. Send one test from an outside address.
4. **Instagram and Messenger.** Chatwoot account (cloud) → Inboxes → add Instagram (needs the Instagram Business account linked to the Facebook Page; Lacey logs in once) and Facebook Page. Settings → Integrations → Webhooks → `https://<app>/api/inbound/chatwoot?key=<long random>` with `message_created`. Profile → Access Token → `CHATWOOT_API_TOKEN`; the account id is in the URL → `CHATWOOT_ACCOUNT_ID`; `CHATWOOT_URL=https://app.chatwoot.com`; the random key → `CHATWOOT_WEBHOOK_SECRET`. Send one DM from another account.
5. **Texts.** Dialpad API: `POST /api/v2/webhooks` with `hook_url` and a `secret`, then `POST /api/v2/subscriptions/sms` on that webhook, `direction: inbound`, target the studio line. The secret → `DIALPAD_WEBHOOK_SECRET`.
6. **Reviews.** The Google Business "write a review" short link → `GOOGLE_REVIEW_URL`.
7. **Home screen.** On Lacey's phone: open `/dashboard`, Share → Add to Home Screen.

## What to watch

`supabase/scorecard.sql` gives the weekly numbers (leads by channel, median hours to first reply, quoted, deposit paid, passed, anything waiting over 48 hours) and inbound errors by channel. The monthly presence monitor runs it and records counts only.

## Later

- A direct `meta` adapter once an App Review is worth the time; same `NormalizedInbound`, no inbox changes.
- Voice: a Dialpad voicemail transcription webhook into the same `ingest`.
- The assistant offering to reach out itself is deliberately not built: it drafts, she sends. If that ever changes it is one allowlisted action with a confirm, not a default.
