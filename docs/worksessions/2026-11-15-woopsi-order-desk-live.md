# Thirteen Months × woopsi.ink — Work Session Brief · Nov 15, 2026

Notion copy: "[2026-11-15] Thirteen Months × woopsi.ink — the Order Desk is live (v2.0.0, v2.1.0)", under "RawSunArt 2.0 | Growth & Expansion Plan". This session ran Nov 10 to Nov 15, 2026.

**Session focus:** Take Thirteen Months from a mailto link to a site where a hospice can read the offer, see the six cards, and place an order that lands as a draft for a person.

**Bottom line:** On Nov 10 the Programs page was an email link. Tonight woopsi.ink is at v2.1.0: institutions come first, a hospice or veterans office can request cases by purchase order with a tax exemption and a standing order, and every request reaches hello@woopsi.ink and Erica and is written to the pipeline database. The six cards are on the Hospices page. What does not exist yet is anything to ship: no print files, no printer, and the six card lines are live without Erica or Lacey having read them.

## Decisions

1. **Institutions first, retail second.** Top menu is Hospices, Veterans, Shop, About, Call 614-647-4554. Artists and Licensing moved to the footer. The test reader is an older adult on a phone, because that is who reviewed the old site and could not read it (Erica's mother's review).
2. **The headline is exactly** "Original art for the notes your organization sends."
3. **The free sample form is gone; the only sample is a paid set of six cards at $20** (a placeholder price Erica still confirms). Because the free form promised samples "within a week" and no printed samples existed. No dated promise the business cannot keep. Erica chose to let the paid set go live on merge.
4. **Cases are sold by the case only:** $375 for 25 family sets (150 cards). No discount on any program page.
5. **The measurement add-on ($150 per program per month) left the first-order form.** It is offered at reorder, by inquiry.
6. **Reorders use a signed, no-login link** that goes in every invoice footer and on the packing slip. Standing orders are quarterly drafts. The site never charges, invoices or emails a customer on its own; every request ends as a draft for a person.
7. **The temporary tattoo sheets are withdrawn from woopsi.ink entirely,** and links to the artist's own site were removed, because that site takes bookings for other work and a bereaved family or a program could follow the link.
8. **Survey and unsubscribe pages show the logo only.**
9. **Sales tax is requested from Stripe Tax on every checkout,** on tax-exclusive prices. Reversal inside the build: the fallback first looked for Stripe's error wording, then was changed before the merge to retry once on any invalid-request refusal, because the wording was an assumption nobody had seen.
10. **The regulation line cites 42 CFR 418.64(d) and never says the regulation requires thirteen months.** It says up to one year; thirteen months is the program's design. (Claude misreported the scope on this once and corrected it in the next message.)
11. **The pipeline database is on.** The migration was applied to grant_intelligence on Erica's yes, and the write secret was generated and stored without being displayed to anyone.
12. **The seller on every page and invoice is Measurement Ally, Inc.** No street address on the site or on the sample invoice.
13. **The six card faces were composed from the four existing Honor & Bloom art elements** rather than waiting for new art. Cards 1 and 6 share the cardinal painting (the first card and the anniversary card), because there are four elements for six cards.
14. **The `/artists` page makes no dated promise.**
15. **Stripe Tax head office:** Erica chose her Stable virtual address in Wilmington, Delaware. It is not set yet (see Action steps).
16. **The Stripe feedback note was drafted and not sent,** on Erica's instruction.
17. **Downloads use Stripe tax code `txcd_10501000`** (digital images, downloaded, permanent rights). `txcd_10505001` is the alternative if her accountant prefers it.

## Deliverables

| What | Where |
|---|---|
| Thirteen Months funnel (Nov 10) | [woopsi-ink PR 32](https://github.com/eltphd/woopsi-ink/pull/32), merged |
| v2.0.0, Same Brand Tuned + the Order Desk | [woopsi-ink PR 40](https://github.com/eltphd/woopsi-ink/pull/40), merged and tagged |
| v2.1.0, the six cards, art elements, sample invoice | [woopsi-ink PR 41](https://github.com/eltphd/woopsi-ink/pull/41), merged and tagged |
| Agent package aligned with the new site | [rawsunart-web PR 20](https://github.com/eltphd/rawsunart-web/pull/20), merged by its own session |
| Hospices page with the six cards | https://woopsi.ink/hospice |
| Order form (PO, exemption, standing order) | https://woopsi.ink/hospice/order |
| Veterans page | https://woopsi.ink/veterans |
| Vendor page for a paying office | https://woopsi.ink/vendor |
| Sample invoice | https://woopsi.ink/vendor/Sample_Invoice_Thirteen_Months_MA.pdf |
| Six card faces | `woopsi-ink/public/thirteen-months/cards/`, built by `scripts/make-thirteen-months-cards.py` |
| Art elements for mockups (full size, transparent) | `woopsi-ink/assets/art/honor-and-bloom/` |
| The Nov 15 scope as given | `woopsi-ink/docs/2026-11-15_dev-prompt_same-brand-order-desk.md` |
| Build record with acceptance numbers | `woopsi-ink/docs/2026-11-15_build-record_same-brand-order-desk.md` |
| Operations notes for v2.1.0 | `woopsi-ink/docs/OPERATIONS.md`, "Built 2026-11-15: v2.1.0" |
| Pipeline database | Supabase grant_intelligence, the `b2b_*` tables |

Checks at the end: 153 tests passing, build clean, 17 pages answering on the live site, text never under 16px, every clickable target at least 48px, contrast at or above 4.5:1.

## Language worth keeping

- "Original art for the notes your organization sends." (the headline, Erica's)
- "Order one set to see it." (the paid sample)
- "How the questions work" and "What people said" (plain names for the exchange and the wall)
- "A person reads every submission and replies either way."
- "Measurement Ally, Inc. is the seller: it prints, ships and invoices."
- "Sample: not a bill."
- "YOUR MOVE" (how every notice to Erica ends, followed by numbered steps)
- "The merge is the release."
- The six card lines, unreviewed: "Holding you in our thoughts" · "Still thinking of you" · "Thinking of you this season" · "You are not forgotten" · "However today finds you" · "Remembering with you"

## Action steps

Ordered by what unblocks a first paid case.

1. **Read the six card lines with Lacey and approve or change them.** Erica and Lacey · 15 minutes · no dependency · suggested by Nov 18. They are live on a page hospices read.
2. **Get print files and a printer.** Erica · half a day plus the printer's turnaround · depends on step 1 · suggested: request two quotes by Nov 22. The faces on the site are 1067 × 1600 screen images; a printer needs them at the card's trim size with bleed. The quote request text is on the Nov 10 week-zero page.
3. **Decide what a $20 sample set buyer is sent, and confirm the price.** Erica · 10 minutes · depends on step 2. The button takes live card payments now. Until samples exist, either hold orders by hand or have the button turned off.
4. **Finish Stripe Tax.** Erica, with her accountant · 20 minutes plus the Ohio registration · before the first invoice. Enter the head office address in Stripe under Settings > Tax (her Stable virtual address; the full line is in her Stable welcome email and on the Notion copy of this brief), then add the Ohio registration. Ask the accountant first whether a Delaware head office is right for a business that ships from Ohio. Until a registration is active, tax works out to zero.
5. **Start outreach.** Erica · 1 hour · open as of Nov 10 and not rechecked in this session: buy the outreach domain, approve the first email and the first 25 names. The site converts nobody who never sees it.
6. **Rehearse one paid test order end to end.** Erica or Claude · 5 minutes · the test checkout opens correctly; paying it with Stripe's test card is the step that exercises the webhook and the confirmation email. Never yet run.
7. **Envelope count per case, and prices for custom work.** Erica · from the printer's quote in step 2.
8. **Say whether to delete the labeled test request** in the pipeline database (organization "TEST REQUEST, please ignore", PO TEST-0001). Claude · 1 minute on her word.
9. **Optional:** reconnect the Stripe connector with write access so settings like the head office can be entered for her.

## Open questions & risks

- **A stranger can pay $20 today for a sample set that cannot be shipped.** This is the most pressing one.
- **The card lines are unreviewed** and sit in front of bereavement coordinators.
- **No tax is collected until the Ohio registration is active.** The Stripe account's own default category is "Consulting Services"; the site states its own category for cards and downloads, so that default does not apply to them.
- **Head office in Delaware, shipping from Ohio:** a question for the accountant, not settled here.
- **A veterans buyer who pays by card still lands on the retail thank-you page with its 15% code.** That sits close to the "no discount on program pages" rule and was left unchanged.
- **The Feelings Unplugged insert set** ($21 version) is still on hold, undecided.
- **Privacy:** no family or patient data is collected; programs address their own envelopes. The privacy statements about the questions were left exactly as they were.

---

# Momentum Analysis

## If these steps are completed

- **Steps 1 to 3 make the offer real.** A coordinator who pays $20 receives six cards, which is the proof a first case order rests on.
- **The gate becomes reachable.** The Day-90 gate is 3 paying accounts and $5,000 committed a year by Feb 8, 2027, 85 days from today. Arithmetic on the case price: $5,000 is 14 cases a year. Three accounts each on one case a quarter is 12 cases, $4,500, just short. If one of the three takes two cases a quarter, it is 16 cases, $6,000, and the gate is met. The standing-order box on the form is what makes that a single decision for the buyer.
- **The year-one goal is nine accounts.** Erica's Nov 15 figure is 72 cases, 1,800 family sets, $27,000. At two cases a quarter per account that is nine accounts (arithmetic).
- **Each paying program is a measurement prospect.** The add-on is $150 a month, $1,800 a year per program, and it is the piece that produces outcomes data for Measurement Ally: programs, then data, then products, then revenue.
- **Lacey earns without being in the loop:** 10% of wholesale is $37.50 a case, $2,700 at the year-one goal (arithmetic from her terms).
- **Step 4 means the first invoice is right the first time,** with tax as its own line and exemptions reviewed by a person.

## If these steps stall — the cost of the open loop

- **Revenue foregone:** the gate is a calendar date. Of the 90 days, 85 remain, and nothing can ship until print files exist. Each week spent without a printer is one of about twelve. By Erica's own rule, a missed gate means direct sales stop and only licenses continue, so the $27,000 line ends rather than slips.
- **Compounding loss:** no paying accounts means no programs to offer the measurement add-on to, no bereavement outcomes data, and no evidence for the Measurement Ally side of the stream.
- **Positioning decay:** the page now says "Order one set to see it." A coordinator who pays and waits weeks has had the first experience of the brand go wrong, and these are the same people outreach is about to write to. (That second half is Claude's reading, not a measured fact.)
- **Momentum cost:** five days of building produced an order desk with no orders, because outreach has not begun. A form nobody visits converts nobody.

**The one next action:** read the six lines with Lacey this week and send the faces to a printer for a quote, so the $20 sample set has something to ship.
