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

## Not fixed here: the portal cannot see her email replies

P0 made every email to her reply-to the client, so she answers from her mail app. That reply goes client-direct and never reaches the portal. The hold timers therefore still think the lead is unanswered: at 36 h (24 h after PR #46) the client is emailed "Still with Lacey, you'll hear by Thursday" and Lacey is nudged, about a client she already answered. The digest would list the same lead as waiting on her.

This is the larger form of the same problem, and it is what the brief's item 5 anticipated ("CC or BCC a parse address ... must never sit between Lacey and the client"). Recommended shape: add the intake address as a second Reply-To on her notification emails, and teach the email adapter that non-forward mail from her address is her reply: match it to the lead by the client's address, record it as an artist message, set `artist_responded_at`. No mail to anyone, and holds and the digest stop on their own. Needs Erica's decision because the client will see the intake address beside their own on her reply.
