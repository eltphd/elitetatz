# Worksession, Nov 19 2026: P0 before Lacey taps Approve, and the three open items

Source: `2026-11-19_RSA_dev-fixes_mallybuild.md` (Erica, Nov 19). This session did P0 (F1 to F3) and closed the three items left open on Nov 18. P1 onward is not started.

## The finding that mattered

**The Reconnect send would have sent the old email.** `woopsi-ink/src/lib/rsa-reconnect.ts` rebuilt the email from the copy in the repo ("it's Lacey. I'm at AION in Dublin now.") and never read the approvals row. The row was rewritten on Nov 19 ("I'd love to see how yours healed."). Lacey's Approve tap would have sent the Nov 3 wording to 197 people.

## P0

| Fix | Where | What changed |
|---|---|---|
| F1 | woopsi-ink PR 56 | The subject and both bodies are read from her approvals row at send time. A row edited after she approved it is refused. The repo copy is only the draft for `--submit-approval`; a test pins it byte for byte to the Nov 19 row (checksums matched on the first comparison). |
| F2 | woopsi-ink PR 56 | "Jordan" becomes the recipient's first name, or "Hey there,". `t=preview` becomes that person's token on keep and goodbye. The send throws rather than deliver either stand-in. One of the 197 is really named Jordan, so the check is on the copy, not on the person. |
| F3 | woopsi-ink PR 56 and this repo | Reply-To is `lacey@rawsunart.com` first, with `studio@inbox.rawsunart.com` beside it. A reply and its photo reach her mailbox directly; the copy opens a card with the photo, titled from the client's own words. She is not emailed about it (she holds it) and it is never timed. |

Names in the list, counted without reading them: 3 blank, 6 all lower case, 1 all capitals, 1 that is a handle. They are tidied or fall back to "there".

### Checking it against the live row

The keys live on Vercel, so the dry run cannot be made from a laptop. After woopsi-ink deploys:

```
curl -H "Authorization: Bearer $CRON_SECRET" "https://woopsi.ink/api/cron/rsa-reconnect?dry=1"
```

It returns one recipient's email as it would be sent, every link, the Reply-To pair, and whether a run would send now. It sends nothing. `?test=you@example.com` sends that one email to you.

### Two things in the dev file that are different in the code

- **`matches.reference_images` is not where photos live.** It is an unused column from the first schema. Photos from every channel are kept in `lead_attachments` (private storage, signed links on the card). F3 uses that; nothing was added to the old column.
- **Texted photos never touch the portal.** The text button opens her own number. Noted on the Experience Map.

## The three open items from Nov 18

1. **The handled page** is tested in every state against a stand-in database (`handled-page.test.tsx`). After deploy, `https://elitetatz.app/handled/x?t=x` should say "This link has expired".
2. **Lacey's printed guide** and its PDF show the 24 h and 72 h reminders, the handled tap, and no client wait note.
3. **The Facebook lead.** Facebook is not connected. Lacey pasted a Messenger message in with "Add a lead" on Nov 12 to use the wording helper, as the printed guide tells her to. A message she pasted in herself is no longer timed, reminded or listed; the card says "You added this one yourself".

## Decisions for Erica

- **Merge order.** woopsi-ink PR 56 before Lacey approves. elitetatz PR 54 before tonight's 7 PM digest. The reply PR in this repo before the first send (Tuesday Nov 24, 9 AM Eastern, at the earliest).
- **Her card's summary says "batches of 150 over a few days."** The schedule sends 40 every 15 minutes, Tuesday to Thursday, 9 to 11 AM Eastern: all 197 in the first morning. Either the summary or the schedule should change before she approves.
- **The first possible send day is Tuesday Nov 24**, two days before Thanksgiving.
- **F24 as written depends on a nightly note.** "Reply to her 7 PM evening note with a time" assumed the digest arrives every evening. Since Nov 18 it only comes on a day with news. F24 needs another way in (the one-tap button, or an email to the intake address at any time).
- **The portal intake address.** The dev file names `studio@inbox.rawsunart.com`. `INBOUND_EMAIL_ADDRESS` on Vercel is hidden, so this was not confirmed; any address on `inbox.rawsunart.com` is read either way.

## Not started

P1 (F4 to F9), P1b (the pages), P2 (F10 to F20), F21 to F24 and the visual refresh.
