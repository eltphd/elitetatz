# Worksession, Nov 18 2026: the portal stops talking about what it cannot see

**Lacey's report (through Erica):** the emails are too much. Not the count: the content. The portal kept telling her people were waiting when she had already dealt with them, because it did not know.

**Erica's rule, same day:** an automatic email to a client that says something untrue about Lacey cannot happen. And Lacey does not need woopsi mail.

**Branch:** `fix/reminders-know-what-she-did`.

## What the delivery log showed (Nov 9 to Nov 18)

Sixteen emails to her in ten days: eight evening digests, five real events, three reminders. The last six digests all said two or three people were "waiting on you". None was.

| Lead | What the portal thought | What was true |
|---|---|---|
| Web form, Nov 9 | Unanswered for nine days | Her own note on the card, Nov 10: "Deposit request sent". The client was still emailed "still with Lacey" (Nov 11) and "her books are full this week" (Nov 13). |
| Facebook Messenger, Nov 12 | Unanswered for six days | She opened the card and used the wording helper within a minute. The portal cannot see Messenger. Two reminders and a nightly listing. Not confirmed that she replied. |
| "Hello", Nov 11 | A tattoo client | A woopsi.ink card-order notice. She got a new-inquiry email, a reminder, a "Hello replied by email" and a nightly listing. |

One cause under the first two: the portal knows she answered only when she replies inside it, or replies to one of its emails. A text, a call, Messenger, a deposit link from the shop all read as silence.

The third has its own cause: the Resend account also receives mail for woopsi.ink, Resend posts every received message to every webhook on the account, and the intake never checked who a message was addressed to.

## What changed

**1. No email to a client on a timer.** `src/lib/holds.ts`.
- The two "you are still waiting" notes (the old A1C at 36 h, and the client half of A2 at 72 h) are deleted. There is no switch.
- The other timed client notes (B, C, D, E) are off unless `HOLD_CLIENT_NOTES` names them. A hold with nothing to send leaves no record.
- Her own reminders stay: one at 24 h (A1), one last at 72 h (A2). Both now say that nothing was sent to the client.

**2. "I already handled this."** `src/lib/handled.ts`.
- Her note on a card, while nobody has written in the thread since, means she dealt with it somewhere else. The timers and the digest leave it alone. No schema change: it is a `lead_notes` row, private, never sent.
- One tap leaves that note for her: a button on the card, and a link in each reminder and each digest line. The link opens a page with one button (`/handled/[matchId]`), signed for that one lead for 30 days. Opening the page records nothing, so a mail scanner cannot mark a lead.
- The card says so first ("You noted this one as handled") and moves to "Waiting on client". Deleting the note undoes it.
- When the client writes again where the portal can see, the lead is hers again and the wait counts from their new message.

**3. The digest only comes with news.** `src/lib/digest.ts`.
- It goes to her on an evening with a new inquiry, or a wait that passed 24 hours that day. Each waiting person is listed once and never again.
- A quiet day sends her nothing and is logged as `skipped`.
- The daily proof that the form and inbox work goes to the operator instead, every evening: `[EliteTatz daily]`, counts and the system check, no client names.

**4. The intake reads only its own mail.** `src/lib/inbound/email.ts`.
- A message must be addressed to the intake domain or to her own mailbox (`addressedToIntake`). It fails open when no recipient is recorded.
- Nothing from one of our own systems becomes a lead (`isSystemSender`): woopsi.ink always, plus `INBOUND_IGNORE_SENDERS`.

**5. Two small faults found on the way.**
- A reminder whose subject carried a line break was refused by Resend (422) on Nov 11 and Nov 13. `cleanSubject` in `src/lib/resend.ts` now makes every subject one line, and a concept is shortened to one line before it is used (`oneLine`).
- The walkthrough card still promised the 36-hour client note. Corrected.

## Done in production the same evening

- The woopsi "Hello" lead was set to `cancelled` with an operator note, so the 72-hour reminder due at 9 AM on Nov 19 does not fire. No other lead in the database came from woopsi mail.

## Added Nov 19, after Erica read the open items

**The Facebook lead was never a Facebook connection.** Facebook and Instagram are not connected. On Nov 12 Lacey used "Add a lead", pasted a Messenger message and picked Facebook, to use the wording helper (the printed guide tells her to: "a card you add yourself: walk-in, phone call, IG DM you copy over"). The lead carries `added_by: artist` and the message `pasted_by: artist`. The portal then timed her own pasted note as an unanswered client.

- Rule: a message she pasted in herself lives where she got it. The portal is not connected to that place, cannot reach that client and never sees her answer, so it does not time it, remind her or list it (`inHerMailbox` in `src/lib/holds.ts` now reads `pasted_by` as well as `mailbox`). The card says "You added this one yourself" and explains why it is quiet.
- If that client later writes somewhere the portal does see, the wait counts from that message, not from the day she pasted the first one. The same correction applies to a thread that started in her mailbox.

**The handled page is now tested in every state** against a stand-in database (`handled-page.test.tsx`): the button for a waiting lead, no button once noted or past answering, the button back when the client writes again, nothing shown for a wrong or borrowed link, and a plain "not available" with no database. Opening the page writes nothing.

**Lacey's printed guide matches.** `elitetatz-for-lacey-print.html` and the PDF: the "Nothing slips" box now shows 24 h and 72 h reminders to her, the handled tap, and that a client is never sent anything about waiting. The rest of the guide is as written on Nov 3 (the Reconnect wording and the "soon" rows are older than today's state).

## Tests

`handled.test.ts`, `handled-page.test.tsx` and `inbound-scope.test.ts` are new; `holds`, `digest`, `reply-sync` and `walkthrough-ui` were updated. Suite: 364 passing, `tsc` and eslint clean. The demo inbox button and the two no-database states of the handled page were checked in a browser.

## Still open

- After deploy, confirm the route is live: `https://elitetatz.app/handled/x?t=x` should say "This link has expired".
- The two real leads are not touched in the database. After deploy both are quiet on their own: the first because her note counts, the second because she pasted it in herself.
- The client who was told "her books are full" has not been written to. That is Lacey's call.
- Texts and Messenger are still invisible to the portal. Dialpad SMS (Nov 4 follow-ups, item 2) and Chatwoot would let it see them; until then the handled tap and the pasted-lead rule are the bridge.
- Resend still posts woopsi mail to this endpoint. It is now ignored here; scoping the webhook in Resend would stop it at the source.
