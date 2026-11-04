# Loop audit: is every loop closed? · 2026-11-04

**For:** Erica, ahead of Lacey's first week. **Method:** each loop traced through the code on `main`, the Supabase data, the Vercel env and the live routes on Nov 4 (00:00–01:30 UTC). Companion to the Nov 3 assessment; one-pager for Lacey: https://claude.ai/artifact/LSbyuEJxkDAoJYgTQ7ema5

**Bottom line.** Six loops are closed in code and verified live. Two are open by design and need a person at one point (Lacey tapping "Deposit received"; Lacey answering the Oct 7 lead). Three channels do not exist yet (email receiving, Instagram, texts), so anything sent there never becomes a card. The single highest-leverage fix for "how do I know I didn't miss anything" is two Dialpad variables: it turns every alert to Lacey into a text as well as an email.

## The answers to Lacey's expected questions

| Question | Answer, from the code |
|---|---|
| How often does it scrape my sources? | Never. Nothing is scraped. Every card is pushed the moment it happens: the rawsunart.com form, the concierge brief, the deposit webhook, and (once connected) email, Instagram and text webhooks. The only timers are the hourly hold check and the Reconnect send. The inbox is true within seconds. |
| Are my 197 in the system with their preferences? | They are in `rsa_contacts` as people, not as preferences: 197 emails, 194 first names, 93 phones, 98 last-service dates, 102 notes averaging 19 characters (labels such as source and year). No preferences or specifications exist anywhere to extract. A returning client's card says "on your October list, last seen YEAR"; their new piece is collected fresh by the brief. Say "we know who they are", never "we know what they like". |
| Who is chatting with my clients, from what source? | Only the concierge on the chat page (`/agent`), and it says it is her booking assistant. It is Claude (Sonnet 4.6) with her prompt: rate $250/hr, $100 deposit, no sketches before deposit, one or two questions per turn, quotes totals not hourly. It cannot send anything. Every email or text to a client goes out only when she taps Quote, Ask, Reply, Pass or Deposit received. The card assistant drafts into her reply box and has no send path. |
| Can I see the conversation? | Yes. Every card has a "Concierge transcript" (stored in `conversations.messages`, loaded on demand from `/api/dashboard/conversation`) and the live thread with the client under it. Her private notes and assistant exchanges never reach the client. |
| How am I sure I don't miss stuff? | Three nets. (1) An email per card to lacey@rawsunart.com, Erica copied. (2) Holds: at 36 h the client hears "still with Lacey, by Thursday" and she gets a nudge; at 72 h again; at 14 days she is told once. Nothing is closed or hidden. (3) Erica's Slack line (once the webhook is set). The weak point is that (1) is email only today. |

## Loops

| # | Loop | State | Gap | Fix · owner · effort |
|---|---|---|---|---|
| 1 | rawsunart.com form → card → email to Lacey → her reply → client's inquiry page → her inbox | **Closed**, verified | A client who taps Reply in their mail app answers lacey@rawsunart.com, which is her Gmail, not the inbox | Resend Receiving + Gmail forward (LEAD-INBOX step 3) · Erica · 20 min. Until then her Gmail is a second inbox. |
| 2 | Concierge chat → brief → card with transcript → same as 1 | **Closed**, verified | None in code. The one open card (concierge, Oct 7) has waited four weeks; holds skip it by design | Lacey answers or passes it on day one |
| 3 | Reconnect email → Keep / Take me off → `rsa_contacts` | **Closed**, test send accepted | None | — |
| 3b | Reconnect "tell me about a piece" → form with `reconnect1` → Returning card | **Closed** | A plain reply to the email lands in Gmail (same as 1) | Same fix as 1 |
| 3c | Reconnect run lines and day-3 report → Slack | **Open** | `SLACK_FOLLOWUPS_WEBHOOK` unset on both projects; the lines are logged, not posted | One incoming webhook for #followups-needed, set on elitetatz and woopsi-ink, redeploy · Erica · 5 min |
| 4 | Quote → AION checkout → deposit → "spot held" | **By hand by design** (external deposits send no signal back) | Hold C at 72 h re-sent the deposit link to everyone, including a client who had already paid at AION | Fixed today: the reminder says "already sent it? then you're set" (PR). Recommended: a Lacey-first check at 48 h ("did they pay? one tap"), client reminder at 72 h only if still unpaid · half a day |
| 5 | Holds cron (hourly, once-guard, quiet hours) | **Closed**, ran live | Lacey's alert channel is email only; SMS is off because Dialpad is not configured | `DIALPAD_API_TOKEN` + `DIALPAD_FROM_NUMBER` on elitetatz · Erica · 10 min. Every `notifyArtist` then also texts her line. **Do this first.** |
| 6 | Approval → sign-in (password, magic link, Google) → Approve → cron | **Closed**, verified | Card copy said "Erica sends it" | Fixed today (PR). Recommended: "sent N of 197" on the card · half a day |
| 7 | Email receiving, Instagram/Messenger, texts → cards | **Not connected** | Those messages never become cards; the routes answer 503 by design | LEAD-INBOX steps 3, 5, 4 in that order: email, Dialpad (also unlocks loop 5), Chatwoot |
| 8 | Google connection | **Unused** (0 connections) | Reads 25 recent mail headers and the calendar only when she opens Connections; nothing ingested; tokens die weekly while the app is in Testing | Drop the Gmail scope, keep Calendar, publish the consent screen (Nov 3 brief, Subtractive 1) |
| 9 | Deposit via platform (Stripe webhook → paid → payout) | **Off** (`PLATFORM_DEPOSITS` unset) | None; her money stays with AION on purpose | Leave off for the pilot |

## Fixes shipped today

- Deposit reminder (hold C) tells a client who already paid at AION that they are set.
- Approval card and approvals page say the send runs by itself on its schedule.
- Artists page no longer says "Live now · Hell City Phoenix".

## Recommended next, in order of leverage

1. Dialpad on elitetatz (two variables): alerts to Lacey become texts. 10 minutes.
2. Resend Receiving + Gmail forward: client email replies become cards. 20 minutes.
3. Slack webhook on both projects: Erica sees every run and every stuck card. 5 minutes.
4. Lacey-first deposit check at 48 h before any client reminder. Half a day.
5. "Sent N of 197" on the approval card. Half a day.
6. Artist and client onboarding built into the app (home-screen prompt, connection checklist with live status, first-card walkthrough; client side: the inquiry page already is the onboarding). Two days. Proposed as its own session.
