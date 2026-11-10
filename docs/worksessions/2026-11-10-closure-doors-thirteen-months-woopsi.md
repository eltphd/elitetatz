# RawSunArt × Measurement Ally — Work Session Brief · 2026-11-10

**Closes the thread that ran Nov 5:** cold-outreach tolerance by ICP, the hospice bereavement stream (Thirteen Months), the four doors, the three-agent campaign package, and the woopsi.ink three-door scope and redesign.

**Session focus:** find the one buyer in the portfolio who tolerates cold outreach, design a revenue stream around them, and reshape woopsi.ink so each buyer sees a store built for them.

**Bottom line:** A complete, costed plan for a cold-tolerant revenue stream exists (Thirteen Months, four doors, three agents, targets, timeline) and woopsi.ink is live as three doors. Nothing in the plan has been started. Nothing decided on Nov 5 has been overridden since; the only work between Nov 5 and Nov 10 was on a different lane (EliteTatz inquiry delivery for Lacey). This thread can be deleted: every decision, file and link below lives in Notion, the repos or the artifacts.

## Where things actually stand (checked Nov 10)

| Lane | State | In motion? |
|---|---|---|
| EliteTatz reliability for Lacey (inquiry delivery, portal clarity) | PRs 45, 47, 48 merged and live; PR 46 open awaiting merge approval | **Yes. This is the one active lane.** |
| woopsi.ink three doors | Live since Nov 5: `/`, `/send`, `/make`, `/programs`, `/artists` return 200; Feelings Unplugged routes forward to feelingsunplugged.com. No commits since. | No. Shipped and resting. |
| Thirteen Months / four doors | Plan, briefs and agent package written and merged. Week-zero decisions not taken. No outreach domain, no samples, no list, no agents in the Console. | **No. Designed, not started.** |
| Artists program | Page live, takes applications by email. First cohort stated as 2027. | No. Waiting on Phase 2 (Mar–Jun 2027). |

So the honest count is one direction in motion, one shipped, two parked by default rather than by decision.

## Decisions (all still standing)

**ICP and stream (Nov 5)**
- Hospice bereavement coordinators are the only high-cold-tolerance buyer in the portfolio. Every relational ICP (tattoo clients, art buyers, artists for EliteTatz) is zero-to-moderate tolerance. *Because:* 42 CFR 418.64(d) requires hospices to run 13 months of bereavement contact, and roughly 69% assemble mailings by hand.
- The stream is **Thirteen Months**: six cards per family (sympathy; 3 weeks; 3, 6, 9, 13 months), $15 a set, case of 25 for $375, measurement add-on $150 per program per month.
- Four doors: Thirteen Months direct to hospices; **E** licenses to hospice mailing vendors; **A** licenses to Tukios/Aftercare.com and OGR; **V** Honor & Bloom to veterans organizations.
- Day-90 gate: 3 paying accounts and $5,000 committed annualized, else stop direct sales and keep the licenses.
- Rails: cold email only from a separate outreach domain, never woopsi.ink or rawsunart.com; no SMS; no family data; no tattoo offer anywhere a bereaved family can see; Erica's Slack reply is the only authorization for an agent to send or spend.

**woopsi.ink (Nov 5, adopted with Erica's revisions)**
- One store, three doors named for the buyer: **Send**, **Programs**, **Artists**. Make is an unfeatured shelf.
- Artist working terms: **80%** of one-of-a-kind originals, **60%** of retail and licenses, **10%** of wholesale. Shares accrue in the ledger; **no payout until 2027**, after Erica and Lacey as a partnership review results and settle artist fairness. Percentages are not published on the site.
- Entity and EIN for every door: **Measurement Ally, Inc.**
- Every Feelings Unplugged offer sells from feelingsunplugged.com. Nothing FU on woopsi.
- Market posture: monopoly and oligopoly positions, away from perfect competition. Never list the library on third-party marketplaces; never discount in Programs; never license non-exclusively into a category woopsi sells into.
- Ledger: every sale goes through a Stripe link. The two Honor & Bloom packs for veteran leadership were paid off-platform, which is why the ledger shows zero. Hand entry was offered twice and declined ("Not now").

## What supersedes what (read this before trusting an older page)

| Older document says | Current decision | Where the old line still appears |
|---|---|---|
| Lacey royalty 12% of wholesale | **10% of wholesale** | Nov 5 stream brief, Nov 5 campaign brief, `rawsunart-web/agents/bereavement/README.md` |
| Maker split 70/30 on retail | **80 / 60 / 10 working terms** (code updated) | Oct 17 launch decisions |
| $21 set with Feelings Unplugged inserts | **Unresolved.** FU left woopsi on Nov 5; the insert set was not carried onto the Programs page. | Nov 5 stream brief, campaign brief |
| Day-90 gate Feb 8, 2027 | The date assumed a Nov 10 start. Nothing started, so **the gate is unset** until a start date is chosen. | All Nov 5 bereavement documents, agent package |
| "Trace the missing Honor & Bloom order" | **Resolved:** paid outside the Stripe link | Campaign brief week-zero list |
| Entity / Stripe EIN open | **Resolved:** Measurement Ally, Inc. | First version of the woopsi brief |

The three-doors brief (artifact, version 2, "Adopted with revisions") is current and matches what is live. If you are printing the doors, that is the right page.

## Deliverables

| What | Where |
|---|---|
| Strategy brief: ICP tolerance and the bereavement stream | https://claude.ai/artifact/3HYAGiE3d5WM7v9ZSBgxAx · `elitetatz/docs/worksessions/2026-11-05-bereavement-stream-brief.md` |
| Campaign brief: 25 assets, stack, three agents, targets, timeline, buyer utility, LTV | https://claude.ai/artifact/Dr1UnGAJUR3wnVnakestZt · `elitetatz/docs/worksessions/2026-11-05-bereavement-campaign-brief.md` |
| woopsi.ink three-doors scope brief (adopted) | https://claude.ai/artifact/SL3nEyVHvayhDiAMwK9Ctb · `elitetatz/docs/worksessions/2026-11-05-woopsi-scope-brief.md` |
| Three-agent Managed Agent package (Director, Funnel Builder, Lead Manager) | `rawsunart-web/agents/bereavement/` (merged, rawsunart-web PR 15). Not created in the Console. |
| woopsi.ink redesign | Live. woopsi-ink PR 31: home, `/send`, `/make`, `/programs`, `/artists`, FU redirects, Honor & Bloom 25-pack at $100, tiered maker share |
| Source HTML for all three briefs | `~/Documents/Claude/Projects/Measurement Ally/_rsa_work/2026-11-05_MA_*.html` |
| Notion | Three Nov 5 pages plus this closure under "RawSunArt 2.0 \| Growth & Expansion Plan" |

## Language worth keeping

- "EliteTatz sells an artist's time. woopsi sells an artist's images. Same artist, two streams, one back end."
- "The artist owns the brand. Measurement Ally owns the platform and the data."
- "woopsi.ink is six stores pretending to be one."
- "Twenty images you already made. Buyers you could not reach alone."
- "Cards your program mails on schedule, by the case, with proof they landed."
- "A cardinal is the bird people say is a loved one visiting. Lacey paints the visit."
- "Retail is the shop window; it is not the business."
- "Supply the oligopolists instead of competing with them."
- "It becomes a platform the day the second artist's work sells to an institution."
- Erica: "It's a blend of talents that we can leverage with a bit of unknown gap intelligence."

## Action steps (ordered by leverage)

1. **Decide: start Thirteen Months, or park it with a date.** Erica · 10 minutes · no dependency. Everything below waits on this. A parked plan with a restart date is a decision; an unstarted plan with a live sample offer is an open loop.
2. **If start: take the week-zero decisions in one sitting.** Erica · about 1 hour. Outreach domain (working name thirteenmonths.co), confirm prices, pick the six images with Lacey (her one hour), resolve the FU-insert set, set the day-90 gate date from the real start.
3. **If start: two trade-printer quotes and a cost sheet per product.** Erica or an agent · 2–3 hours · needs the six images. Every margin in the projections is an estimate until this exists.
4. **If park: soften two live promises on woopsi.ink.** Claude · 15 minutes. `/programs` says "Samples go out within a week"; no printed Thirteen Months samples exist. `/artists` says "You hear back within two weeks." Either stays true only if someone is watching hello@woopsi.ink.
5. **Send buyers the Stripe link from now on.** Erica · zero effort. The Honor & Bloom 25-pack is live at $100; the veterans channel can record its next order today.
6. **Name ten candidate artists by January.** Erica with Lacey · 30 minutes · suggested deadline Jan 15, 2027. Needed only for the Artists door, Phase 2.
7. **Correct the 12% line in the agent package README to 10%.** Claude · 5 minutes. Only matters before the agents are created in the Console.

Not this thread's: elitetatz PR 46 awaiting merge approval; `rawsunart-web` has an uncommitted launch config and an untracked `agents/ads-director/` folder (scanned Nov 10, no secrets found, only a placeholder token pattern in the README).

## Open questions and risks

- **Live promises without a watcher.** Program sample requests and artist applications arrive at hello@woopsi.ink. The support agent escalates wholesale to Erica with a holding reply, so nothing is auto-answered wrongly, but a hospice coordinator who writes in and waits is a first impression spent.
- **Does the Feelings Unplugged insert set survive?** It was a $6 uplift per set and a bridge to FU's institutional audience. It conflicts with "nothing FU on woopsi" unless it is sold as a Measurement Ally program component rather than a woopsi product.
- **Licensing contract.** Doors A and E need an attorney-reviewed license template before any pitch. Not engaged.
- **Compliance stays as written.** CAN-SPAM (unsubscribe and physical address), no SMS (TCPA), no PHI and cards-only so no BAA. These are design constraints, not legal advice; counsel reviews before the first send.
- **Artist terms are working terms.** 80 / 60 / 10 is recorded in code and briefs, not in a signed agreement with Lacey. The 2027 review is the agreed moment.
- **No demand data yet.** Zero recorded orders. Every catalog and pricing decision is a hypothesis until the ledger has rows.

---

# Momentum analysis

This session was design work, not launch-critical delivery, so the accounting below is kept proportionate. Figures come from the Nov 5 briefs and are projections, not forecasts.

## If these steps are completed

- **Week-zero decisions (1 hour) unlock the whole build.** The Funnel Builder brief, the list, the copy and the sample run are all written against them. Nothing else in the plan needs Erica's judgment until samples are approved.
- **Pilot scale, three accounts:** $13,500 in cards and $3,600 in measurement a year, about $9,630 margin after Lacey's share (computed at the old 12%; slightly higher at 10%). The 90-day target in the campaign brief is $4,000–7,000 cash, about $18,000 annualized.
- **Ohio scale, ten accounts:** $45,000 cards, $10,800 measurement, about $30,900 margin. Year-one base in the campaign brief is 10 accounts.
- **Each account is also a dataset.** A program on the measurement add-on produces a de-identified outcomes record every month. Twelve months of that is the buyer-intelligence product scoped for late 2027, and it is evidence for Measurement Ally's own evaluation practice. This is the flywheel in miniature: program, data, product, revenue.
- **Lacey's cost is about four hours total** for income that arrives while she is tattooing. That is the proof case the Artists door needs before a second artist will believe it.
- **Recorded Honor & Bloom orders** turn the veterans door from an anecdote into a line in the ledger, at no build cost.

## If these steps stall — the cost of the open loop

- **Revenue foregone is modest and real.** At pilot scale, roughly $1,400 a month of cards and measurement not billed for each month the start slips (three accounts, $17,100 a year). This is a small number. It is also the only line in the RawSunArt portfolio that does not depend on warm relationships or on Lacey's hours.
- **The gate slips day for day.** The plan gave itself 90 days to prove or stop. With no start date there is no stop date either, and an unbounded experiment is the kind that quietly consumes attention.
- **Compounding is where the cost sits.** No accounts means no outcomes data, no annual report, no case study for licensing doors A and E, and no evidence for the Artists door. The 2027 partnership review with Lacey would then be judging artist fairness on retail alone, which today is zero recorded orders.
- **The built assets depreciate.** Three briefs, an agent package and two live pages were made for a campaign. Unlaunched, the pages keep making a sample offer nobody is fulfilling, and the briefs go stale against decisions made elsewhere (two lines already have).
- **The larger cost may be the opposite one.** Starting a fourth lane while the EliteTatz lane still needs daily attention for Lacey would spend the same hours twice. Parking Thirteen Months with a date costs about $1,400 a month in deferred pilot revenue. Splitting attention and shipping neither costs more. Parking on purpose is a legitimate answer.

**The one action that keeps the loop closed:** choose "start on a named date" or "parked until a named date" for Thirteen Months, and write that date on the Notion page.
