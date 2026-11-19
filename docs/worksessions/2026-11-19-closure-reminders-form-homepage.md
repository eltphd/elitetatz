# RawSunArt × EliteTatz — Work Session Brief · 2026-11-19

**Session focus:** fix what Lacey meant by "too many emails", make sure the Reconnect email is the one she approves, let the inquiry form carry photos and a phone number, and put the approved watercolor homepage live.

**Bottom line:** The portal no longer tells Lacey that people are waiting when she has already dealt with them, and it no longer emails a client on a timer. An inquiry from rawsunart.com now reaches her as one email with the client's reference photos in it. The Reconnect send reads the email she approves, with each person's own name and links. The homepage is the light watercolor design, Dublin first, with one path to Lacey.

Session ran Nov 18 to Nov 19. Ten pull requests merged across three repos; everything below is live.

## Decisions

- **The event emails stay.** New inquiry, client reply and deposit paid are news that reaches her no other way. Erica first considered an alias mailbox or switching the app's email off, then corrected the diagnosis: "it wasnt the emails it was the quantity and it was confusing because if she already reached out and talked to them it was just telling her something she already did but the system didnt know." An alias she does not read would hide real inquiries.
- **No email goes to a client on a timer.** Erica, Nov 18: "THIS CAN NOT HAPPEN." A real client was told "still with Lacey" and then "her books are full this week" after Lacey had already sent her a deposit request. Both notes are deleted, with no switch. The four other timed client notes are off unless `HOLD_CLIENT_NOTES` names them. Every email to a client now follows a tap by Lacey or an action by the client.
- **Her note on a card means she handled it.** No schema change: a private `lead_notes` row newer than the last message. One tap leaves it for her, from the card, from each reminder and from each line of the evening note. Opening the emailed link records nothing, so a mail scanner cannot mark a lead. When the client writes again where the portal can see, the card comes back and the wait counts from that message.
- **The evening note only comes with news.** Each waiting person is listed once and never again. A quiet day sends her nothing. The daily proof that the form and inbox work goes to Erica as `[EliteTatz daily]`.
- **A lead she pasted in herself is never timed.** Facebook and Instagram are not connected. The "Facebook Messenger" lead was one Lacey added with "Add a lead" to use the wording helper, as her printed guide tells her to.
- **The intake reads only its own mail.** The email account also receives for woopsi.ink and hands every message to every listener. The app now ignores mail not addressed to the intake or her mailbox, and anything sent by woopsi.
- **Reconnect sends the row she approves.** Tried first: trusting the copy in the repo. Reverted because the repo held the Nov 3 wording and the approvals row had been rewritten on Nov 19; her tap would have sent 197 people an email she had not approved. A row edited after approval is now refused.
- **Replies to Reconnect reach her first.** Reply-To is her own address, with the portal intake beside it. The portal opens a card with the photo and sends her nothing, because she already holds the reply.
- **Photos travel ahead of the inquiry.** Two rules pulled against each other: one email per inquiry with the photos in it, and her email goes out before anything is saved. So each photo uploads first and comes back as a signed ticket. A photo that fails never holds the inquiry back.
- **A client's phone number never lands where the portal could text it.** It is stored in the brief as `contact_phone`, not in `matches.client_phone`, with the consent, the time and the exact words. A test fails if that changes.
- **The homepage is direction B.** Light paper, her work first, no red anywhere (errors use dark amber), Dublin before Columbus in the title, the description and the structured data. Held back on purpose: client stories until three are approved, the "years and clients" fact until Lacey gives real numbers, and links to pages that do not exist yet.
- **Fonts are served from the site.** The design canvas linked Google Fonts. The site's own check forbids it, so Cormorant Garamond and Jost are self-hosted with their licenses.
- **Site commits are authored as the `eltphd` GitHub account.** Vercel refuses to build a preview for a commit it cannot tie to a GitHub account.
- **woopsi-ink keeps its release rule.** The Reconnect fix merged without a version or a dated section, so both were added the same afternoon as v2.9.1.

## Deliverables

| What | Where |
|---|---|
| Reminders know what she did: no timed client notes, the handled tap, evening note only on news, intake scoped, pasted leads never timed, her printed guide updated | [elitetatz PR 54](https://github.com/eltphd/elitetatz/pull/54) |
| A reply to the Reconnect email opens one card, titled from the client's words, photo kept, never timed | [elitetatz PR 56](https://github.com/eltphd/elitetatz/pull/56) |
| Inquiry photos, optional phone with text consent, one client confirmation with a copy | [elitetatz PR 57](https://github.com/eltphd/elitetatz/pull/57) |
| Next.js 16.4.2 to 16.4.5, a security release | [elitetatz PR 58](https://github.com/eltphd/elitetatz/pull/58) |
| The client's inquiry page stops promising a wait note that no longer exists | [elitetatz PR 59](https://github.com/eltphd/elitetatz/pull/59) |
| Reconnect sends the approved row, personalized, with a dry run | [woopsi-ink PR 56](https://github.com/eltphd/woopsi-ink/pull/56) |
| Release note and version for that fix, tagged `v2.9.1` | [woopsi-ink PR 57](https://github.com/eltphd/woopsi-ink/pull/57) · `docs/OPERATIONS.md`, "Built 2026-11-19" |
| The form on rawsunart.com: photos, phone, text-consent box, thank-you panel | [rawsunart-web PR 21](https://github.com/eltphd/rawsunart-web/pull/21) |
| The watercolor homepage | [rawsunart-web PR 22](https://github.com/eltphd/rawsunart-web/pull/22) · live at [rawsunart.com](https://rawsunart.com/) |
| Homepage fonts served from the site | [rawsunart-web PR 23](https://github.com/eltphd/rawsunart-web/pull/23) |
| Experience Map, version 7: every moment above marked Live, the site screens in the new look, two new rough edges | [claude.ai/artifact/RFwJtoyaBdgc24mDmmyRKJ](https://claude.ai/artifact/RFwJtoyaBdgc24mDmmyRKJ) |
| Design canvas with the approved homepage and "How it works" artboards | [claude.ai/artifact/QSiPdLYVcEsVVJ4n4hg2xc](https://claude.ai/artifact/QSiPdLYVcEsVVJ4n4hg2xc) |
| Session records in this folder | `2026-11-18-reminders-know-what-she-did.md`, `2026-11-19-p0-reconnect-and-open-items.md`, `2026-11-19-inquiry-form-photos-phone.md`, this file |
| Lacey's printed guide and PDF | `docs/worksessions/elitetatz-for-lacey-print.html`, `elitetatz-for-lacey.pdf` |
| Eight merge lines in Slack #followups-needed | [seven lines](https://measurementally.slack.com/archives/C073VRVPXM2/p1795110765022489), [the homepage line](https://measurementally.slack.com/archives/C073VRVPXM2/p1795111937306019) |

One change was made directly in production data: the woopsi "Hello" lead (`27edb6f4`) was set to `cancelled` with an operator note.

Checks at close: 413 tests passing on elitetatz `main`; 21 Reconnect tests in woopsi-ink; the site check passes on rawsunart-web `main`.

## The homepage, as built

rawsunart-web has no docs folder, so its build record lives here.

- **Source.** The approved artboard `project/Watercolor.dc.html` on the design canvas. The page is one file, `index.html`. It was assembled once by a script that kept the live form fields, every script and the structured data, and replaced the head, the styles and the sections. That script was a one-time tool and is not in the repo; `index.html` is the source from here on.
- **Look.** Paper `#FBF6EE`, ink `#2B2320`, deep teal `#1F4E5F`, soft washes of sky, teal, lavender, sand, sage and ochre. Cormorant Garamond for headings, Jost for text, 5 font files in `/fonts` with both license texts.
- **Sections, in order.** Header, hero, a facts band, her work, how a commission works, a story card, the artist, a band for returning clients, the inquiry section with two doors (the form, or the concierge for someone still shaping an idea), collectors, footer.
- **Words that changed.** Title and H1: "Watercolor tattoo artist in Dublin, Ohio (Columbus area)". The button reads "Send to Lacey". "Within 48 hours" is now "within two days". The footer year keeps itself current.
- **Removed.** "Books open", the "Pay your deposit" link, the stat counters, and the old portfolio filter. Left in, that filter's first line threw and stopped every script after it, including the form.
- **Structured data.** Dublin first and Columbus second in the description and the service area; two new images listed.
- **Photos.** Eight images in `images/home/`, named for what they show.
- **Closes** F5, F8 and F10 to F18 of the Nov 19 dev file.
- **What went wrong.** The first homepage merge went in while the site check was failing on Google Fonts, because the merge command was chained after the status read. The font fix merged two minutes later with every check passing. Rule kept: read the check, stop on a failure, then merge.

## Language worth keeping

- "THIS CAN NOT HAPPEN." (Erica, on an automatic email telling a client something untrue about Lacey.)
- "The portal stops talking about what it cannot see."
- "Not the count: the content."
- "A message she pasted in herself lives where she got it."
- "I already handled this." (the button)
- "Already answered Ana another way (text, call, Messenger, at the shop)? Tap here and the reminders stop."
- "Nothing has been sent to Ana about the wait, and nothing will be."
- "This note only comes on a day with something new."
- "Got it, Ana. I'll read this myself and reply within two days (I'm in studio Wed–Sat)."
- "OK to text me about this inquiry."
- "Only Lacey uses it, from her own phone. No automated texts."
- "Send to Lacey."
- "One path to Lacey, written for collectors."

## Action steps

Ordered by what unblocks bookings first. Owners and times marked "suggested" were not set in the session.

1. **Run the Reconnect dry run and settle the schedule.** Erica · 15 minutes · before Lacey taps Approve. The command is in `2026-11-19-p0-reconnect-and-open-items.md`. Her card says "batches of 150 over a few days"; the code sends 40 every 15 minutes, Tuesday to Thursday, 9 to 11 AM Eastern, so all 197 would go in one morning. One of the two has to change. The first possible send is Tuesday, Nov 24, two days before Thanksgiving.
2. **Send one real inquiry with two photos from rawsunart.com.** Erica · 10 minutes · tell Lacey first so she expects it. This is the only step that proves the photos arrive in her email.
3. **Check the Google Business Profile name against the new title.** Erica · 5 minutes. The structured data comment says a mismatch costs more than the markup gains.
4. **Get Lacey's three answers for the "How it works" page.** Lacey, asked by Erica · one short conversation (suggested: this week, in the studio). Consult length and cost, touch-up policy, how watercolor heals. The design is approved and waits only on these.
5. **Decide whether to write to the client who was told "her books are full".** Lacey's call · 5 minutes.
6. **Bring the tattoos, originals and blog pages into the new design.** Dev · one session (suggested). A visitor who clicks through today sees two different sites.
7. **Name this stop.** Erica · 2 minutes. elitetatz is still tagged v0.2.0 and the site v2.2.0, with all of this session's merges on top. Suggested: v0.3.0 and v2.3.0.
8. **Build what is left in the dev file.** Dev. F9 (healed stories, after three are approved), the P1b pages, F19 to F24. F24 needs a new way in, because it assumed a nightly note that no longer comes on quiet days.
9. **Older items still open.** Confirm the Formspree backup delivers to her; connect Slack on Vercel or accept that the 72-hour line never reaches Erica; scope the email webhook at the provider so woopsi mail stops arriving at all.

## Open questions and risks

- No whole inquiry has gone through the new form for real. Photo upload was proven against production with two test images; they sit in `inquiry-uploads/2026-11-19/` and are swept after three days.
- Texts, calls and Messenger are still invisible to the portal. The handled tap and the pasted-lead rule are the bridge until a text connection exists.
- A Reconnect send two days before Thanksgiving may land badly or well; it has not been discussed.
- Her printed guide is correct on reminders; its Reconnect wording and "soon" rows still date from Nov 3.
- The intake address named in the dev file could not be confirmed against the hidden Vercel setting. Any address on that domain is read either way.

## If these steps are completed

- **Steps 1 and 2 turn two built things into two working things.** The Reconnect email reaches 197 people Lacey chose, in her words, with replies landing in her mailbox. Each booking that follows starts at her $250 one-hour minimum with a $100 deposit. As an illustration only, since no conversion model exists in her documents: 5 bookings from 197 would be at least $1,250 in sessions and $500 in deposits held.
- **Healed photos come back.** Three approved stories unlock F9, the one section of the new homepage still empty, and the evidence a collector looks for before paying a deposit.
- **Lacey trusts the inbox again.** In the ten days before the fix she got 16 emails; 8 were evening notes and the last 6 of those said people were waiting who were not. With that gone, a reminder means something, and an inquiry gets answered inside her two-day promise.
- **Steps 4 and 6 finish the front door.** The memory for this project names traffic as the constraint; a homepage, a process page and inner pages that agree with each other are what that traffic lands on.

## If these steps stall — the cost of the open loop

- **Revenue foregone.** Reconnect has waited since Oct 16 with 0 of 197 sent. Each week it waits is a week the people most likely to rebook hear nothing. A send that slips past Nov 24 runs into Thanksgiving and then December, when attention is hardest to get.
- **A hidden fault stays hidden.** Until one real inquiry with photos goes through, the first person to find a problem will be a real client, and Lacey will get an inquiry without the references she needs.
- **Compounding loss.** No Reconnect, no healed photos; no healed photos, no stories on the homepage; no stories, a weaker page for every visitor the SEO work brings.
- **Positioning decay.** The homepage now says one thing and the inner pages another. That mismatch is new as of today and reads as unfinished.
- **Momentum cost.** The approved "How it works" design depreciates while three short answers are outstanding.

**The one action that keeps the loop closed:** run the Reconnect dry run and fix the "batches of 150" line, so Lacey can tap Approve before Tuesday.
