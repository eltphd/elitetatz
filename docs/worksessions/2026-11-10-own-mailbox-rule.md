# Worksession, Nov 10 2026: no mail about her own mailbox

**Rule (Erica, Nov 9):** Lacey never gets two emails about the same thing. The build exists to take admin load off her; if she cannot trust it to do that, she cannot use it.

**Branch:** `fix/no-mail-about-her-own-mailbox`.

## The duplicate

When Lacey forwarded a client's email to the intake address, the portal opened the lead and then emailed her "Email: Devon — moth piece", about a message she had just forwarded. The same would happen with a mail-host auto-forward from her mailbox, and with a client who writes to her and copies the intake address.

## The fix, as a rule and not a special case

The portal emails her about a message only if that message has not already passed through her own mailbox.

- `alreadyInArtistMailbox(mail)` in `src/lib/inbound/email.ts` reads the envelope as it arrived: `'forwarded'` when the sender is her address; `'delivered'` when To, Cc, Delivered-To, X-Original-To or X-Forwarded-For carries her address; otherwise `null`.
- "Her mailbox" is `artistMailboxes()`: her address and `ARTIST_NOTIFICATION_EMAIL`. It is deliberately narrower than `ownAddresses()`. The sending address, the operator's copy and the intake address are ours but are not her inbox, so an operator forwarding a client email still gets her one email.
- The lead, the thread and the attachments are written exactly as before. Only the email to her is withheld.
- `notifyArtist` takes `skip: <reason>`. Nothing is sent to her, the operator copy or SMS; the delivery log gets a row with `status = 'skipped'` and the reason in `error`, so the record shows a decision and not a gap.
- Instagram, Messenger and text messages never pass through her inbox, so they always get their one email. Only the email adapter can set the flag.

Tests: `__tests__/unit/inbound-own-mailbox.test.ts` (12 cases) and one skip case in `notify.test.ts`. Suite: 214 passing; `tsc` and eslint clean.

PR #46 (digest, probe, nudge) adds a `probe` flag to `notifyArtist` for the same purpose. It should rebase onto this and pass `skip: 'probe: not sent by design'` instead, so there is one way to not send.

## The false nudges (second commit, same branch)

P0 made every email to her reply-to the client, so she answers from her mail app. That reply went client-direct and never reached the portal. The hold timers went on thinking the lead was unanswered: at 36 h the client was emailed "Still with Lacey, you'll hear by Thursday" and Lacey was nudged, about a client she had already answered. Erica, Nov 10: fix it.

Two rules, both in the direction of sending less.

**1. Her email reply counts as her answer.**

- `artistReplyTo()` in `lib/notify.ts`: every email to her about a client now carries two Reply-To addresses, the client first and the intake address (`INBOUND_EMAIL_ADDRESS`) beside it. Her reply reaches the client directly whether or not the portal is up; the intake copy is only a copy. `REPLY_SYNC=off` turns it back to the client alone.
- `readArtistReply()` in `inbound/email.ts`: mail from her mailbox written to someone who is not us is her reply. A forward is addressed to us alone and stays on the forward path, which also fixes Outlook-style replies ("Original Message") being read as a forward from the client.
- `recordArtistReply()` in `inbound/ingest.ts`: the reply goes on the lead as an artist message and sets `artist_responded_at`. Nothing is sent to anyone. No lead is ever opened from her outgoing mail.
- Her words are shown in the thread (which the client sees on their inquiry page) only when the receiving server vouched for the sender (DMARC pass, or DKIM signed by her domain). Otherwise the row says "Replied by email." The timers stop either way.

**2. The portal does not time a conversation it cannot see.**

- A client message that passed through her mailbox is stored with `meta.mailbox`; her email reply is stored with `meta.mailbox = 'reply'`.
- In `dueHolds`, when the last word on a pending or info-requested lead carries that mark, holds A and B do not fire. Whoever answers next can do it in her mail app without the portal seeing it, and a wrong "still with Lacey" or "answer when ready" costs more trust than a missed reminder.
- The timers pick up again the moment either side writes where the portal does see: the inquiry page, the form, a DM, her portal inbox.
- Quote, deposit and date holds (C, D, E) come from her own taps in the portal and stay timed.

What the client sees: when she replies, the To line shows their own address and the intake address. If the client replies-all, the portal gets a copy, files it on the thread, and (because it was also delivered to her) sends her nothing.

**Still possible, and why it is left:** she answers a form inquiry by phone, by text, or by composing a fresh email instead of replying to ours. The portal cannot know, so the 36 h nudge would still go. Closing that needs either reading her mailbox (rejected: restricted scope, and it is her mail) or a one-tap "already answered" link in the nudge.

PR #46 moves `waitingOnArtistSince` into a shared function for the digest. On rebase that function must carry the `inHerMailbox` rule, or the digest will list as "waiting on you" exactly the leads the timers now leave alone.

Tests: `reply-sync.test.ts` (16 cases), `notify-reply-to.test.ts` (5). Suite: 235 passing.
