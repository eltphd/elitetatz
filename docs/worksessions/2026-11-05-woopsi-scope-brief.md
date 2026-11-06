# Worksession 2026-11-05 — woopsi.ink scope brief: three doors

**Prepared for:** Dr. Erica L. Tartt (Measurement Ally)
**Source brief:** `~/Documents/Claude/Projects/Measurement Ally/_rsa_work/2026-11-05_MA_woopsi-scope-brief.html`
**Artifact:** https://claude.ai/artifact/SL3nEyVHvayhDiAMwK9Ctb
**Notion:** "2026-11-05 woopsi.ink scope brief: three doors" under RawSunArt 2.0 | Growth & Expansion Plan
**Companions:** 2026-11-05 bereavement stream brief, 2026-11-05 bereavement campaign brief, 2026-11-03 RSA Creatives brief

## Scope in one paragraph

woopsi.ink is the product-and-licensing side of the thesis already written for EliteTatz: the artist owns the brand, Measurement Ally owns the platform and the data. EliteTatz sells an artist's time; woopsi sells an artist's images. Three doors: **Send** (retail cards, prints, originals), **Programs** (institutions buying by PO, with the measurement add-on), **Artists** (a curated 20-image library program with the institutional pitch done for them). MA is seller of record, owner of the ledger, vendor of the intelligence. Nothing new is built before February beyond what the Funnel Builder is already briefed to build; the change is editorial.

## Today

- ~40 listings, six product types, three divisions (RSA, Feelings Unplugged, Altered Earth Press)
- 70/30 maker split coded Oct 17; no connected Stripe account yet, shares recorded as held
- `sales_orders` in grant_intelligence: 0 rows; two Honor & Bloom packs bought for veteran leadership did not record
- Analytics dark; home page leads with product-type tiles rather than buyers

## Three doors

| Door | Buyer | Products | Money |
|---|---|---|---|
| Send | Gift and memorial buyers | Cards, prints, originals, Line of the Month | Retail, 70/30 maker split |
| Programs | Hospices, veterans orgs, schools | Thirteen Months, Honor & Bloom bulk, FU educator pack | Wholesale by PO; measurement add-on $150/program/mo |
| Artists | Creatives who trade time for money | 20-image library → cards, prints, licenses | Artist keeps 70% retail, 60% licenses, 12% wholesale |

## Information architecture

| Route | Door | State |
|---|---|---|
| `/` | All — one piece large, three named doors | Edit |
| `/send` (catalog) | Send — cards first, filter by artist once two | Edit |
| `/hospice`, `/hospice/*`, `/survey/[program]` | Programs | Funnel Builder wk 1–4 |
| `/veterans` | Programs | Funnel Builder wk 2 |
| `/schools` | Programs — FU educator pack by PO | Phase 2 |
| `/artists`, `/artists/statement` | Artists — offer, terms, spec, application, maker statement | Phase 2 |
| `/partners` | Licensing lookbook for vendors | Funnel Builder wk 3 |
| `/make` | Party packs, paint-along, temporary tattoos, unfeatured | Edit |
| `/the-exchange`, `/wall`, `/free`, `/share` | Community — keep, footer links | Keep |

## Catalog decisions

- **Stay, featured:** Honor & Bloom, originals, framed prints, Line of the Month, FU gift set ($55)
- **Move to /make, unfeatured:** Paint & Party 01–04, paint-along sheets and party box, temporary tattoos
- **Move to /schools:** FU educator pack ($249)
- **Leave woopsi (sell at feelingsunplugged.com):** FU paperback, signed, bundle, workbook, templates
- **Fold:** twelve single line-drawing pages into Line of the Month and the tattoo sheets
- **Keep, footer shelf:** Altered Earth zine

## The Artists door is the business

Artist brings 20 images, one hour to approve files, a signed non-exclusive agreement. Platform does file prep, lookbook, listings and fulfilment, institutional pitch and sequences, licensing negotiation, invoicing, payouts, quarterly statement. Curated, two artists at a time, memorial and botanical first. Non-exclusive by category. Honor & Bloom and Thirteen Months are the case studies; the second artist is the proof it is a platform. Candidate pool on record: Prism Artfight artisans, Malia, FU facilitators, artists Lacey knows at AION and Hell City. Step one is a list of ten names.

## MA's role and the data

| Role | Today | By mid-2027 |
|---|---|---|
| Seller of record | Already how checkout works | Stripe Connect live for Lacey; entity/EIN resolved |
| Owner of the ledger | `sales_orders` (empty); pipeline tables briefed | `b2b_*`, `bereavement_responses`, maker statements from one ledger |
| Vendor of measurement | Add-on priced $150/mo | Annual outcomes reports for every Programs account |
| Vendor of intelligence | Nothing | Buyer-intelligence report to artists and licensees, aggregates only, no family data |

## Gap intelligence

| Unknown | Closes by | When |
|---|---|---|
| No demand data for any product type | Thirteen Months pilot as the study; fix the ledger | Now–Feb |
| Who the next two artists are | Ten names; two conversations about split and curation | Jan |
| Institutional FU demand | One district or counselor group offered the educator pack by PO | Phase 2 |
| Fulfilment economics | Two trade-printer quotes; cost sheet per product | Week 1 |
| Analytics dark | Pipeline tables and `b2b_touches` events | Weeks 1–2 |
| Entity and Stripe EIN | MA-level decision; attorney for licensing template | Week 2 |
| Whether Send converts | Checkout list capture, making-of cuts, 90 days of recorded orders | Feb review |

## Sequencing

1. **Phase 1 · Nov 2026–Feb 2027 (Programs first):** hospice and veterans pages, pipeline tables, ledger fixed, outreach domain, home page to three doors, catalog pruned, Stripe promotions terms accepted. Done = day-90 gate met or not; retail orders recording; three doors live.
2. **Phase 2 · Mar–Jun 2027 (Artists v1):** `/artists` and application, two artists onboarded, licensing template in use, Stripe Connect live, maker statement, `/schools` if the FU test says yes. Done = second artist's first institutional sale or license; first quarterly statements paid.
3. **Phase 3 · H2 2027 (data product):** buyer-intelligence report from twelve months of ledger and outcomes data; priced for artists and licensees. Done = first paid report.

## Success measures

| Measure | Feb 2027 | Jun 2027 | Dec 2027 |
|---|---|---|---|
| Programs accounts active | 3 | 8 | 15 |
| Artists on the platform | 1 | 3 | 5 |
| Retail orders recorded (cum.) | 20 | 80 | 250 |
| Licenses signed | 1 | 3 | 6 |
| Maker payouts (cum.) | $500 | $6,000 | $20,000 |
| Erica hours/month on woopsi | 40 | 20 | 12 |

## What woopsi.ink is not

Not a general marketplace; not the home of Feelings Unplugged; not holidayz or an events directory; not a place where any tattoo is sold (artist credit and studio URL only); not a Lacey project once the second artist's work sells to an institution.

## Decisions needed from Erica

1. Adopt the three-door scope and the catalog decisions.
2. Confirm artist deal terms (70 / 60 / 12) as the public offer.
3. Name ten candidate artists by January.
4. Decide whether FU's institutional surface lives on woopsi (`/schools`) or at feelingsunplugged.com.
5. Resolve the entity and Stripe EIN question before the first maker payout.
