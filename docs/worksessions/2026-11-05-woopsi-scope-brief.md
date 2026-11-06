# Worksession 2026-11-05 — woopsi.ink scope brief: three doors (adopted with revisions)

**Prepared for:** Dr. Erica L. Tartt (Measurement Ally)
**Source brief:** `~/Documents/Claude/Projects/Measurement Ally/_rsa_work/2026-11-05_MA_woopsi-scope-brief.html`
**Artifact:** https://claude.ai/artifact/SL3nEyVHvayhDiAMwK9Ctb
**Notion:** "2026-11-05 woopsi.ink scope brief: three doors" under RawSunArt 2.0 | Growth & Expansion Plan
**Companions:** 2026-11-05 bereavement stream brief, 2026-11-05 bereavement campaign brief, 2026-11-03 RSA Creatives brief

## Scope in one paragraph

woopsi.ink is the product-and-licensing side of the thesis already written for EliteTatz: the artist owns the brand, Measurement Ally owns the platform and the data. EliteTatz sells an artist's time; woopsi sells an artist's images. Three doors: **Send** (retail cards, prints, originals), **Programs** (institutions buying by PO, with the measurement add-on), **Artists** (a curated 20-image library program with the institutional pitch done for them). Measurement Ally, Inc. is the entity, EIN and seller of record on every door, owner of the ledger, vendor of the intelligence. Maker and artist shares accrue in the ledger from the first sale; no payout until 2027, when Erica and Lacey as a partnership review results and settle artist fairness. The Phase 1 redesign is editorial and ships now.

## Decisions taken Nov 5, 2026 (Erica's revisions)

1. Three-door scope adopted; Phase 1 redesign proceeds.
2. Artist working terms: **80%** of one-of-a-kind originals, **60%** of retail and licenses, **10%** of wholesale. Shares accrue; payouts after the 2027 partnership review.
3. Every Feelings Unplugged offer, educator and institutional included, sells from feelingsunplugged.com. Nothing FU stays on woopsi; `/free` forwards there.
4. Entity and EIN for every door: Measurement Ally, Inc.
5. Market posture: monopoly and oligopoly positions over perfect competition (see Market structure).
6. Ledger: every sale goes through a Stripe link; the two off-platform Honor & Bloom packs are entered by hand, never re-charged.

Still open: ten candidate artists by January; two trade-printer quotes and a cost sheet per product (week 1).

## Today

- ~40 listings, six product types, three divisions (RSA, Feelings Unplugged, Altered Earth Press)
- 70/30 maker split coded Oct 17, superseded by the 80/60/10 working terms; shares recorded as held until the 2027 review
- `sales_orders` in grant_intelligence: 0 rows; the two Honor & Bloom packs for veteran leadership were paid outside the Stripe link, so the gap is process, not code
- Analytics dark; home page leads with product-type tiles rather than buyers

## Three doors

| Door | Buyer | Products | Money |
|---|---|---|---|
| Send | Gift and memorial buyers | Cards, prints, originals, Line of the Month | Retail, 70/30 maker split |
| Programs | Hospices, veterans orgs | Thirteen Months, Honor & Bloom bulk | Wholesale by PO (artist 10%); measurement add-on $150/program/mo |
| Artists | Creatives who trade time for money | 20-image library → cards, prints, licenses | Artist keeps 80% originals, 60% retail and licenses, 10% wholesale (working terms) |

## Market structure: lean toward the monopoly, away from the commodity

| Door | Structure it faces | Position woopsi takes | Pricing rule |
|---|---|---|---|
| Send | Monopolistic competition sliding to perfect competition (Etsy, Society6, Redbubble) | Narrow memorial/botanical differentiation; artist's institutional record on every page; hard scarcity on originals and signed editions | Never compete on price; retail is the shop window |
| Programs | A local monopoly: nobody else sits inside the 13-month schedule and the family survey | Bundle cards + measurement + outcomes report; switching cost is the program's data history; mandated budgets are inelastic | Lerner rule: margin follows inelasticity; add-on priced on the report's value |
| Licensing | Oligopoly: Tukios/Aftercare.com, OGR, Messenger | Supply the oligopolists; exclusive-by-category licenses | Flat fee + royalty; exclusivity is the scarce good |
| Artists | Perfect competition among artists on marketplaces | Curation restricts supply; the only buyer offering institutional demand + a data statement | Shares set by the partnership after results |

Levers: third-degree price discrimination ($25 retail / $375 case / $275–500 + royalty license), bundling and switching costs, vertical integration, the data moat. Rules: never list the library on third-party marketplaces; never license non-exclusively into a category woopsi sells into; never discount in Programs; grow by category, not catalogue count.

## Information architecture

| Route | Door | State |
|---|---|---|
| `/` | All — one piece large, three named doors | Edit |
| `/send` (catalog) | Send — cards first, filter by artist once two | Edit |
| `/hospice`, `/hospice/*`, `/survey/[program]` | Programs | Funnel Builder wk 1–4 |
| `/veterans` | Programs | Funnel Builder wk 2 |
| `/programs` | Programs — institutional front door now; full hospice and veterans pages per campaign brief | Now |
| `/artists`, `/artists/statement` | Artists — offer, working terms, spec, application; maker statement | Page now; onboarding Phase 2 |
| `/free` | Forwards to feelingsunplugged.com | Edit |
| `/partners` | Licensing lookbook for vendors | Funnel Builder wk 3 |
| `/make` | Party packs, paint-along, temporary tattoos, unfeatured | Edit |
| `/the-exchange`, `/wall`, `/share` | Community — keep, footer links | Keep |

## Catalog decisions

- **Stay, featured:** Honor & Bloom, originals, framed prints, signed prints, Line of the Month
- **Move to /make, unfeatured:** Paint & Party 01–04, paint-along sheets and party box, temporary tattoos
- **Leave woopsi entirely (sell at feelingsunplugged.com):** every FU listing: paperback, signed, bundle, workbook, templates, gift set, educator pack
- **Fold:** twelve single line-drawing pages into Line of the Month and the tattoo sheets
- **Keep, footer shelf:** Altered Earth zine

## The Artists door is the business

Artist brings 20 images, one hour to approve files, a signed non-exclusive agreement. Platform does file prep, lookbook, listings and fulfilment, institutional pitch and sequences, licensing negotiation, invoicing, payouts, quarterly statement. Curated, two artists at a time, memorial and botanical first. Non-exclusive by category. Honor & Bloom and Thirteen Months are the case studies; the second artist is the proof it is a platform. Candidate pool on record: Prism Artfight artisans, Malia, FU facilitators, artists Lacey knows at AION and Hell City. Step one is a list of ten names.

## MA's role and the data

| Role | Today | By mid-2027 |
|---|---|---|
| Entity, EIN, seller of record | Measurement Ally, Inc. on every door (decided Nov 5) | Shares accrue as held; first payouts after the 2027 partnership review |
| Owner of the ledger | `sales_orders` (empty); pipeline tables briefed | `b2b_*`, `bereavement_responses`, maker statements from one ledger |
| Vendor of measurement | Add-on priced $150/mo | Annual outcomes reports for every Programs account |
| Vendor of intelligence | Nothing | Buyer-intelligence report to artists and licensees, aggregates only, no family data |

## Gap intelligence

| Unknown | Closes by | When |
|---|---|---|
| No demand data for any product type | Thirteen Months pilot as the study; every sale through a Stripe link; off-platform sales entered by hand | Now–Feb |
| Who the next two artists are | Ten names; two conversations about split and curation | Jan |
| Fulfilment economics | Two trade-printer quotes; cost sheet per product | Week 1 |
| Analytics dark | Pipeline tables and `b2b_touches` events | Weeks 1–2 |
| Entity and Stripe EIN | Closed Nov 5: Measurement Ally, Inc.; attorney still engaged for the licensing template | Done |
| Whether Send converts | Checkout list capture, making-of cuts, 90 days of recorded orders | Feb review |

## Sequencing

1. **Phase 1 · Nov 2026–Feb 2027 (Programs first):** hospice and veterans pages, pipeline tables, ledger fixed, outreach domain, home page to three doors with `/programs` and `/artists` front doors, every FU offer to feelingsunplugged.com, make shelf unfeatured, line drawings folded, Stripe promotions terms accepted. Done = day-90 gate met or not; retail orders recording; three doors live.
2. **Phase 2 · Mar–Jun 2027 (Artists v1):** `/artists` and application, two artists onboarded, licensing template in use, read-only maker statement; the 2027 partnership review sets payout terms. Done = second artist's first institutional sale or license; first quarterly statements issued.
3. **Phase 3 · H2 2027 (data product):** buyer-intelligence report from twelve months of ledger and outcomes data; priced for artists and licensees. Done = first paid report.

## Success measures

| Measure | Feb 2027 | Jun 2027 | Dec 2027 |
|---|---|---|---|
| Programs accounts active | 3 | 8 | 15 |
| Artists on the platform | 1 | 3 | 5 |
| Retail orders recorded (cum.) | 20 | 80 | 250 |
| Licenses signed | 1 | 3 | 6 |
| Maker shares accrued (cum.) | $500 | $6,000 | $20,000 |
| Erica hours/month on woopsi | 40 | 20 | 12 |

## What woopsi.ink is not

Not a general marketplace; never listed on third-party marketplaces; not the home of Feelings Unplugged (every FU offer lives at feelingsunplugged.com); not holidayz or an events directory; not a place where any tattoo is sold (artist credit and studio URL only); not a Lacey project once the second artist's work sells to an institution.

## Still open

1. Name ten candidate artists by January.
2. Two trade-printer quotes and a cost sheet per product (week 1).
