# RawSunArt × EliteTatz — Work Session Brief · 2026-11-03

**Session focus:** Assess the whole RawSunArt digital presence, then build the one place Lacey's leads land (email, Instagram, Messenger, texts, web form) with an assistant that drafts and an approvals tab that keeps every outbound send behind her tap.

**Bottom line:** This morning EliteTatz was believed undeployed and Lacey's leads lived in five inboxes. Tonight EliteTatz is confirmed as the live backend for every rawsunart.com form, the unified lead inbox with returning-client detection and an Approvals tab is merged and in production, and the Reconnect email to 197 past clients is sitting in Lacey's queue, unsent, waiting for her okay. Nothing reached a client.

## Decisions

1. **EliteTatz is the backend, not a future project.** elitetatz.vercel.app already receives inquiry, concierge, Collectors Club, for-artists and keep/goodbye posts from rawsunart.com. "Deploy EliteTatz" is off the list; the constraint is traffic, not conversion mechanics.
2. **The inbox lives inside EliteTatz's existing dashboard.** No new SaaS, no ManyChat. Leads stay in `matches`, with a `channel` column, so the dashboard Lacey already has becomes the one place.
3. **Chatwoot bridges Instagram and Messenger**, not ManyChat (auto-reply oriented, no clean outbound API) and not the Meta Graph API directly (weeks of App Review). The adapter interface lets a direct `meta` adapter replace it later without touching the inbox.
4. **The assistant drafts; it never sends.** It has no outbound call. "Offer to reach out for her" was deliberately not built: if it ever is, it is one allowlisted action with a confirm, not a default.
5. **Approval is a record, not a send.** Lacey's Approve tap writes a row; the Reconnect script reads that row and refuses to run without it. The "nothing without explicit approval" rule is enforced in code, not remembered.
6. **First-timers and returning clients are different leads.** Detection happens at display time from past sessions and the client list, with nothing new stored. Returning clients get a green badge, "skip the pitch" guidance, and an assistant that confirms the piece and offers dates instead of qualifying.
7. **Runs alongside, not instead.** Lacey changes nothing in her current process to try it. Pitch: "try this tool out alongside what you already do."
8. **Env placement:** every app secret goes in Vercel (Production, then redeploy). Supabase takes migrations only. The operator's woopsi-ink `.env.local` holds the submit and send keys.
9. **Reversal:** the Reconnect email preview was first published as a standalone artifact, then moved into the dashboard as an Approvals tab (Email campaigns / Blog posts) so review and sign-off happen where she already works.
10. **Vetoed for now:** Dialpad voice calls into the inbox (voicemail transcription is a later adapter) and anything touching Lacey's personal cell.

## Deliverables (with links/paths)

| What | Where | Purpose |
|---|---|---|
| Digital presence assessment | scratchpad `digital-presence-assessment-2026-11-03.md` (delivered in chat) | Measurement, traffic, acquisition, conversion, decision points D1–D5 |
| Unified lead inbox | https://github.com/eltphd/elitetatz/pull/26 (merged) | Email, Chatwoot IG/FB, Dialpad SMS, by-hand leads → one dashboard; assistant drafts only |
| Returning clients + Approvals tab | https://github.com/eltphd/elitetatz/pull/27 (merged) | `client-history.ts`, `/dashboard/approvals`, `/api/approvals`, migration 015 |
| Schema snapshots | https://github.com/eltphd/elitetatz/pull/28 (merged) | `supabase/schema.sql` after migrations 014 and 015 |
| Reconnect send gate | https://github.com/eltphd/woopsi-ink/pull/26 (merged) | `rsa-reconnect.mjs` refuses to send without an approved row; `--submit-approval` queues the email |
| Blog schema + click events | https://github.com/eltphd/rawsunart-web/pull/12 (**open**) | Article JSON-LD, OG tags, tracked clicks on shop, deposit, Instagram, phone, concierge |
| Demo inbox | elitetatz `/demo/inbox` | What Erica shows Lacey: five fixture leads incl. a returning client; nothing sends |
| Demo approvals | elitetatz `/demo/approvals` | Email campaign + blog post review cards |
| Reconnect email preview | https://claude.ai/artifact/NFYrQ6qshgHYbs8h5YS3tm (private) | Standalone review copy for Lacey |
| Reconnect email in her queue | `/dashboard/approvals`, key `rsa-reconnect-1`, id `f8eb8826…`, status pending | The real approval record; Lacey was notified by email |
| Build doc | `elitetatz/docs/LEAD-INBOX-2026-11-03.md` | Architecture, trust rules, setup order, env placement |
| Operator CLI | `elitetatz/scripts/submit-approval.mjs` | Puts a campaign or post in her queue; checks status |
| Weekly scorecard | `elitetatz/supabase/scorecard.sql`; presence-monitor step 11 | Leads by channel, hours to first reply, quoted, deposit paid, waiting > 48 h |
| Tests | 20 suites / 137 tests passing | client-history (8), approvals route (5) added |

## Language worth keeping

- "DO NOT SEND ANYTHING TO HER CLIENT LIST WITHOUT EXPLICIT APPROVAL." (Erica, the rule the whole system enforces)
- "I just want you to try this tool out alongside what you already do, and maybe you'll find more actionable info sooner and clearer." (the pitch to Lacey)
- "Approve is a record, not a send."
- "The assistant has read the whole lead · drafts only, you send."
- "They know you. Skip the pitch: confirm the piece and offer dates." (returning-client card)
- "A channel that is not configured does not exist."
- "Nothing changes in what you do now."
- "Traffic, not conversion mechanics, is the constraint."

## Action steps (ordered by leverage; owner · effort · dependency · target)

1. **Lacey opens `/dashboard/approvals` and taps Approve (or asks for changes).** Lacey · 10 min · needs Erica to send her the link and the "try it alongside" framing · **by Nov 6**. Unblocks the only revenue lever that costs nothing.
2. **Fill the three empty values in woopsi-ink `.env.local`:** `RSA_SUPABASE_SERVICE_ROLE_KEY`, `RSA_MAIL_STREET`, `RESEND_API_KEY`. Erica · 10 min · none · **by Nov 5**.
3. **Run the Reconnect send** once step 1 is approved: `node scripts/rsa-reconnect.mjs --confirm-lacey-reviewed --cap 150`, then the remainder the next day. Erica only · 15 min · steps 1 and 2 · **Nov 6–7**. Reaches 197 past clients.
4. **Merge rawsunart-web PR 12.** Erica · 5 min · none · **Nov 4**. Article schema and tracked clicks start accumulating.
5. **Connect email to the inbox:** Resend Receiving on `inbox.rawsunart.com`, webhook to `/api/inbound/email`, Gmail auto-forward from Lacey's account. Erica (Lacey logs in once) · 45 min · DNS access · **week of Nov 10**.
6. **Connect Instagram + Messenger through Chatwoot.** Erica + Lacey (one login) · 60 min · Instagram Business account linked to the Facebook Page · **week of Nov 10**.
7. **Connect Dialpad SMS webhook** and set `GOOGLE_REVIEW_URL`. Erica · 30 min · Dialpad API token · **week of Nov 10**.
8. **Put `/dashboard` on Lacey's home screen** and walk her through `/demo/inbox` first. Erica + Lacey · 20 min · steps 5–7 make it real · **week of Nov 10**.
9. **Re-run the scorecard after 14 days** (`supabase/scorecard.sql`, or the monthly presence monitor) and decide whether the inbox earned its place. Erica · 15 min · step 8 · **Nov 24** (suggested).
10. **Decide measurement (D1 from the assessment):** keep Vercel Hobby analytics (script only, no query API) or move to a plan or tracker that reports. Erica · decision · none · **Nov 24** with step 9.

## Open questions & risks

- **Lacey's decision on the Reconnect copy.** If she asks for changes, the edit happens in `rsa-reconnect.mjs` and is resubmitted with the same key; the gate re-opens on her next Approve.
- **Service role key handling.** It must be pasted by Erica; the assistant never reads or prints it. The footer street line is absent from the preview until `RSA_MAIL_STREET` is set (CAN-SPAM requires it on the real send).
- **Instagram linkage.** Chatwoot needs the Instagram Business account tied to the Facebook Page; if Lacey's account is personal, that conversion is a prerequisite.
- **Analytics are plan-gated.** The insights script loads but the query API returns 404 on every project; custom events may be dropped on Hobby. Numbers in the scorecard come from Supabase, not Vercel.
- **Presence monitor** showed a last-run date with no November run record; verify on the next scheduled run.
- **Consent language:** the Reconnect email is opt-out ("Keep me" / goodbye) per the Oct 16 decisions; 521 contacts remain `held` and are not in this send.

---

# Momentum Analysis

## If these steps are completed

- **197 past clients hear from Lacey within the week** (step 3). These are people who already paid her once; the 14 she skipped and the 521 held are excluded. Even a 3–5% reply rate (estimate, not from her data) is 6–10 live conversations landing in an inbox that now tags them "Returning · tattooed by you" and tells the assistant to skip the pitch. At the $375 starting number used in the demo, 6–10 bookings is roughly $2,250–$3,750 of chair revenue plus deposits (estimate).
- **Every reply has one landing place** (steps 5–8). Lacey stops triaging Gmail, Instagram, Messenger and texts separately; the scorecard measures hours-to-first-reply, which is the number that converts an inquiry into a deposit.
- **The flywheel starts.** Each lead, quote and outcome is a row in `matches`; two weeks of that is the first real training and evaluation data for the quote suggester and the assistant, and the evidence base for pitching EliteTatz to a second artist. That is the programs → data → products → revenue loop at tattoo-shop scale.
- **Trust is earned by the gate, not asked for.** Lacey sees that the system asked her before it sent, which is the condition she needs to adopt the rest.

## If these steps stall — the cost of the open loop

- **Revenue foregone:** 197 warm contacts stay cold. The list was built Oct 16; every month unsent, more addresses go stale and the "we moved, here's how to find Lacey" message loses its reason to exist. A reactivation email that goes out in January is a different, weaker email.
- **Compounding losses:** no send → no replies → no inbox traffic → the scorecard reads zero → no data to tune quotes or prove the product → no second-artist pitch. The 137 passing tests and merged PRs depreciate quietly; an inbox nobody connects converts no one.
- **Positioning decay:** the shop move is the one-time excuse to contact everyone. Local competitors and AION's own marketing fill the gap; the Dublin watercolor-tattoo niche does not wait.
- **Momentum cost:** two days of build sit behind three environment values and one tap. Lacey's attention was engaged today by the notification email; if the link she received leads nowhere for a week, the next ask is harder.

**The one next action that keeps the loop closed:** send Lacey the `/dashboard/approvals` link tonight with the "try it alongside what you already do" line, and fill the three woopsi-ink env values so the send can go the morning she approves.
