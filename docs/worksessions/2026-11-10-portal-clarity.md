# Worksession, Nov 10 2026: the portal has to make sense to the artist

**Branch:** `feat/portal-clarity`, on top of `fix/no-mail-about-her-own-mailbox` (PR #47).

## What happened

Erica opened the portal for Lacey so she could compare it with her email. Lacey had already answered the client by email. The card showed three buttons and nothing else she could place: no sign she had answered, no idea what the client had been sent (a page? an email?), and the assistant was a small grey line at the bottom. She also took the assistant to mean she would be tattooing "art ChatGPT comes up with". Erica's brief: make it usable for her, because if it works for her it opens to other artists.

## What changed

**1. The card says what already happened before it offers anything.** `StandingBanner` (`src/app/dashboard/LeadStanding.tsx`, logic in `src/lib/standing.ts`) is one plain sentence and whose move it is: "You already answered Ana by email. Nothing is waiting on you, and no reminders will go out," with her own words quoted. Other states: new, client wrote back, quoted and waiting on the deposit, deposit in, booked, session done, came from her own email.

**2. An answered inquiry leaves "Needs you".** `groupOf` used to keep every pending lead there. A pending lead where she has the last word (from the portal or from her email) is now under "Waiting on client", and comes back when the client writes.

**3. What the client has been sent.** `ClientView` lists it in order with how it went: the confirmation email with their page link, each message of hers (and whether it left from the portal or her own mail app), each automatic waiting note. It explains the client's page in one sentence and links to the exact page they see. A client who emailed her directly is shown as having been sent nothing by the portal.

**4. "Say it your way" leads the card.** `WordingHelper` is the first thing she can act on. She types or says what she wants to tell the client, however it comes out. The assistant returns the same thing worded for that client, then tells her what it changed and why, asks one question when it is not sure what she meant, and reminds her of add-ons. Buttons: Use this wording, That's not what I meant, Use my own words. All three only fill the reply box; she still taps Send. The standing line under it: "You are the artist. This only helps with wording: it never changes what you decided."

- Backend: a `reword` mode on the existing assistant route (`rewordPrompt` in `src/lib/assistant.ts`). Same model and streaming as the other modes. The prompt holds her decision, price and boundaries fixed, forbids adding offers or softening a no into a maybe, and asks instead of guessing. The answer has four labelled parts read by `src/lib/reword.ts`; only the message is saved to her notes.

**5. Buttons say what they do.** Accept → "Send a quote". More info → "Ask a question". Pass stays. A line under them says each opens a form and nothing is sent until the send button there.

**6. Extras she forgets when quoting.** The quote form groups them: design drafts before the session (already existed), and an original of the piece for the client to keep, digital (Procreate) or on watercolor paper, with her price. It goes into the thread and the client's quote email (`src/lib/addons.ts`). No schema change. The assistant knows these add-ons and never prices one for her.

**7. The demo inbox has her exact case** (`/demo/inbox`, Ana Ruiz): a form inquiry she answered by email.

Tests: `__tests__/unit/standing.test.ts` (18 cases). Suite: 253 passing; `tsc` and eslint clean. Checked in the browser at phone width against the demo inbox: no sideways scroll, the helper fills the reply box, nothing is sent.

## For Lacey and Erica to confirm

- The add-on wording and that she wants both offered. Prices are hers; none is assumed.
- The reworded messages against a few real things she would say. The prompt can be tuned from examples.

## Not done

- Pricing nudges from data ("artists price under what is profitable") beyond the existing band check: the assistant says when her number is under her own published band, nothing more.
- The live `reword` mode has not been run against the real model from here (it needs her signed-in session); the demo uses a fixed example.
