# Connections runbook: email and Instagram/Messenger into the inbox

Nov 4, 2026. For Erica. Two channels are still off because their variables are not on Vercel. Each one is a handshake: the service gets the app's webhook URL, Vercel gets the service's secret. Nothing else changes; the routes already exist and answer 503 until the variables are set (trust rule 7).

**State checked today.** Vercel elitetatz Production has `RESEND_API_KEY`, `CRON_SECRET`, `OPERATOR_API_KEY`, `OPERATOR_EMAIL`, `ARTIST_NOTIFICATION_*`. It does not have `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_ADDRESS`, or any `CHATWOOT_*`. rawsunart.com DNS lives at Namecheap (nameservers `dns1/dns2.registrar-servers.com`); the apex MX is Google Workspace and must not change; Resend's DKIM and SPF for sending are already on the apex. `inbox.rawsunart.com` has no MX yet.

**Where every variable goes.** Vercel → project **elitetatz** → Settings → Environment Variables → Add → environment **Production** (tick Preview too if you want preview deploys to receive). Then Deployments → latest Production → ⋯ → **Redeploy**. Variables are read at request time, but a redeploy is the only way to be sure the running instance sees them. CLI equivalent, from the elitetatz folder, prompts for the value so nothing lands in shell history:

```
vercel env add RESEND_WEBHOOK_SECRET production
vercel redeploy elitetatz.app
```

After each channel, open `elitetatz.app/dashboard/connections` signed in: the row flips from off to on, read from the variable names on the server.

---

## 1. Email to the inbox (Resend Receiving)

Lacey's inquiries that arrive by email become cards with the attachments. Her Gmail keeps every message; the forward is a copy.

| Step | Where | What |
| --- | --- | --- |
| 1a | resend.com → **Domains** | Open `rawsunart.com` (already verified for sending on the account whose key is on Vercel). Add the subdomain **`inbox.rawsunart.com`** as a new domain, region US East, and on it turn on **Receiving**. Resend shows one **MX** record for it. |
| 1b | Namecheap → rawsunart.com → **Advanced DNS** | Add record: type **MX**, host **`inbox`**, value exactly what Resend showed (it looks like `inbound-smtp.us-east-1.amazonses.com`), priority **10**, TTL automatic. Do not touch the apex MX rows (Google). Back in Resend, click Verify; allow up to an hour. |
| 1c | resend.com → **Webhooks** → Add | Endpoint `https://elitetatz.app/api/inbound/email`. Event: **`email.received`** only. Save, then open the webhook and copy the **Signing secret** (`whsec_…`). |
| 1d | Vercel → elitetatz → env | `RESEND_WEBHOOK_SECRET` = the `whsec_…` value. `INBOUND_EMAIL_ADDRESS` = `leads@inbox.rawsunart.com`. `RESEND_API_KEY` is already there and must be the key for the same Resend account. Redeploy. |
| 1e | Lacey's Gmail (with her, 5 min) | Settings → See all settings → **Forwarding and POP/IMAP** → Add a forwarding address → `leads@inbox.rawsunart.com`. Gmail emails a confirmation code to that address; it arrives in the inbox as a card (or in `inbound_events`); Erica reads the code back to her. Then **Filters** → Create filter: *Doesn't have*: `from:me` is not enough, so use *From*: `-lacey@rawsunart.com -*@rawsunart.com` (excludes her own sends) → Create filter → **Forward it to** `leads@…` → keep Gmail's copy. |
| 1f | Test | From an address that is not hers, email `lacey@rawsunart.com` with a photo attached and one line about a tattoo idea. Within a minute: a card on `/dashboard` with channel **email**, the photo as a thumbnail, and Lacey gets the "new inquiry" email. Second delivery of the same message does nothing. |

Why a subdomain: the apex MX is Google Workspace, and Resend Receiving needs to be the only MX on the name it receives for. `inbox.` keeps her real mailbox untouched.

What it will not do: reply to anyone, create a lead from her own outgoing mail, or create a lead from bounces and auto-replies.

## 2. Instagram DM and Messenger (Chatwoot cloud)

Chatwoot is the pipe, not the place: it holds the Meta app approval and fires a webhook per message. Lacey never opens it after the one login.

Prerequisites, Lacey's side: her Instagram must be a **Business or Creator** account (Instagram → Settings → Account type) and **linked to the RawSunArt Facebook Page** (Meta Business Suite → Settings → Instagram accounts). She needs to be an admin of that Page.

| Step | Where | What |
| --- | --- | --- |
| 2a | app.chatwoot.com → Sign up | Erica creates the account (free tier covers two agents). Name it RawSunArt. Note the number in the URL after `/app/accounts/` — that is **`CHATWOOT_ACCOUNT_ID`**. |
| 2b | Chatwoot → Settings → **Inboxes** → Add Inbox → **Instagram** | Click Continue with Facebook. **Lacey logs in** (this is her one login), grants the permissions Chatwoot asks for, picks the RawSunArt Page and its linked Instagram account. Add Erica as the agent on the inbox. |
| 2c | Same → Add Inbox → **Messenger** | Same login, pick the Page. Add the agent. (Two inboxes; both fire the same webhook and the app tells them apart by channel type.) |
| 2d | Chatwoot → Settings → **Integrations** → Webhooks → Configure → Add new webhook | URL `https://elitetatz.app/api/inbound/chatwoot?key=<KEY>` where `<KEY>` is a new random string: run `openssl rand -hex 24` and paste the output. Tick **`message_created`** only. Save. |
| 2e | Chatwoot → profile icon (bottom left) → **Profile Settings** → Access Token | Copy it. That is **`CHATWOOT_API_TOKEN`** (used only to post Lacey's replies back into the DM thread). |
| 2f | Vercel → elitetatz → env | `CHATWOOT_URL` = `https://app.chatwoot.com` · `CHATWOOT_ACCOUNT_ID` = from 2a · `CHATWOOT_API_TOKEN` = from 2e · `CHATWOOT_WEBHOOK_SECRET` = the `<KEY>` from 2d. Redeploy. |
| 2g | Test | From another Instagram account, DM @rawsunart one line and a photo. A card appears with channel **instagram**; Lacey replies from the card and the reply shows up in the DM thread. Repeat once from Messenger. |

Why Chatwoot and not the Meta API directly: the direct route needs our own Meta App Review (weeks, business verification, screencasts). The adapter boundary means a direct `meta` adapter can replace Chatwoot later without touching the inbox. Full reasoning in `docs/LEAD-INBOX-2026-11-03.md`.

What it will not do: auto-reply, create a lead from Lacey's own outgoing DMs, or act on any Chatwoot event other than a new incoming public message.

## 3. Still optional, not blocking Lacey's test

- **Texts:** `DIALPAD_WEBHOOK_SECRET` (and `DIALPAD_FROM_NUMBER`) after the Dialpad webhook + SMS subscription on the studio line. Until then her alerts are email only.
- **Review link:** `GOOGLE_REVIEW_URL` from the Business Profile's "Get more reviews" short link. Turns on the *Ask for a review* button.
- **Operator feed:** `SLACK_FOLLOWUPS_WEBHOOK` for the hold-timer one-liners and the Reconnect tally. Erica's channel only.

## 4. Lacey's test, and how feedback comes back

She can test today with what is live: web form → card, concierge → card, approvals tab (the Reconnect email is waiting for her tap), Calendar connection, home screen install. The printed script is `docs/worksessions/elitetatz-for-lacey.pdf`, page 2. Email and DM cards join the test as soon as sections 1 and 2 are done.

Ask her for feedback in this shape, one line each, and paste it into the next worksession brief as is:

```
Screen: (inbox / card / approvals / connections / inquiry page)
What I expected:
What happened:
Keep / change / drop:
```

Three things she will likely ask, with the honest answer: it knows nothing about client preferences (the 197 contacts hold names, emails, phones, last-visit dates only); nothing has been sent to anyone; the assistant drafts and she sends.
