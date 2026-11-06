# 2026-11-05 — Thirteen Months campaign brief: assets, stack, agents, targets, timeline

Repo mirror of the Nov 5 campaign brief. Full document: `Measurement Ally/_rsa_work/2026-11-05_MA_bereavement-campaign-brief.html`
(artifact https://claude.ai/artifact/Dr1UnGAJUR3wnVnakestZt) and the Notion child page under "RawSunArt 2.0 | Growth & Expansion Plan".
Agent package: `rawsunart-web/agents/bereavement/` (PR on that repo).

## Doors, buyer utility, LTV

| Door | Buyer | Short-term utility | Long-term utility | Cold tolerance | Annual value / account | LTV (gross) |
|---|---|---|---|---|---|---|
| Thirteen Months (hospices mailing in-house, ~69%) | Bereavement Coordinator | hours back; a designed program; compliance evidence day one | CAHPS emotional-support items; annual outcomes report; survives staff turnover | high, fast | $5,580 (cards $4,500 + measurement $1,080 at 60% take) | $27,900 over ~5 yrs (margin ~$17k) |
| E (hospices buying pre-printed, ~30%, via vendors) | publisher / mailing vendor | artist-signed art without hiring | a line competitors cannot copy; cheap renewal | high | $1,440–3,600 royalty | ~$12,000 / 5 yrs |
| A (funeral homes via Tukios/Aftercare.com, OGR) | partnerships lead at incumbent | named artist series inside a white-label program | aftercare = retention marketing for funeral homes | high | $262–49,950 royalty by adoption | $16,300 base / 3-yr term |
| V (veterans orgs: posts, departments, auxiliaries, survivor groups) | adjutant, auxiliary president, chaplain; Emblem Sales for catalog | handmade condolence for a member's or Gold Star family | standing condolence / Memorial Day practice; ritual retains members | moderate | $100–300 per post; $1,000+ per department | $500–1,500 per post; departments open |
| Retail (woopsi.ink) | gift / memorial buyers | art you send, not scroll | repeat at next loss | none | $25 | $33 |

Veterans signal: two Honor & Bloom packs bought for veteran leadership. `sales_orders` (grant_intelligence) still has 0 rows →
either the purchase went around woopsi or the Stripe webhook is not writing. Trace before the funnel depends on that table.
Market facts: VFW 5,556 posts; American Legion ~13,000; VA 157 national cemeteries, 130,693 interments FY2025.

## Asset list (25 items, owner, week) — see brief §2
Product (6 cards, 6 inserts, sample pack, case packaging, Honor & Bloom 25-pack) · Pages on woopsi.ink (/hospice, /hospice/sample,
/hospice/order, /hospice/measure, /survey/[program], /veterans, /partners, /unsubscribe) · Outreach (sending domain on Resend, Ohio list,
chain HQ list, four-touch sequence, A/E pitch + lookbook, V sequence, booking link) · Data (b2b_leads, b2b_touches, b2b_accounts,
b2b_orders, b2b_sequences, suppression, bereavement_responses; weekly scorecard; annual outcomes report template) · Legal/finance
(licensing template, Lacey royalty agreement, W-9 and vendor packet).

## Stack
woopsi.ink (Next.js 16, Vercel) · Stripe Checkout + Invoicing (net 30, ACH) + Subscriptions · Supabase grant_intelligence · Resend +
Resend Receiving on a new outreach domain (never woopsi.ink / rawsunart.com) · Dialpad (human calls) · Slack #followups-needed (YOUR MOVE /
YES EXECUTE) · Claude Managed Agents ×3 · ODH list + public sources · trade printer · Google Calendar booking · GitHub PRs · Vercel analytics
stays script-only.

## Agents
Director (opus-5-5, weekly): scorecard, briefs on metrics under floor two weeks running, strategy, gate report. Funnel Builder (opus-5-5,
on demand): pages/tables/Stripe/cron by PR only. Lead Manager (sonnet-5-5, daily): lists, approved copy inside daily cap, replies,
walkthroughs, orders, license follow-ups. Shared rails: no Lacey list, no SMS, no family data, no tattoo offer, no sends from brand domains,
Erica's Slack reply is the only authorization, two failures = stop.

## Targets
90 days (Nov 10 – Feb 8, 2027): 150 sequenced · 25 samples · 10 walkthroughs · 3 POs · 2 measurement subs · 1 license LOI · 1 E adoption
conversation · 3 V orders · $4–7k cash, ~$18k annualized. Year one base/stretch: 10/20 accounts · 6/12 subs · 2,000/4,500 sets · 80/90%
reorder · $44k/$90k booked · Lacey $5k/$11k · 2/3 licenses · CAC ≤$300/$200 · Erica ≤20/12 h per month after month 3.
Weekly floors: sends 150 · reply 10% · bounce <3% · sample→walkthrough 35% · walkthrough→PO 25% · page conversion 3% · complaints 0.

## Timeline
Week 0 decisions (domain, prices, six images, Console, trace the order) · Weeks 1–2 build + list + copy · Week 3 samples mailed, A/E/V pitched ·
Weeks 4–6 calls, walkthroughs, measure + survey live · Weeks 7–12 POs, reorders, chain list · Day 90 gate Feb 8, 2027 · Months 4–6 chains,
second state, automated reporting · Month 9 ten accounts · Month 12 review.
