# TatzAI — Lacey Pilot: Readiness & Build Strategy · 2026-09-21

## Where we stood this morning

| Layer | State | Verdict |
|---|---|---|
| Concierge (`/agent?mode=rawsunart`) | Real. Claude Sonnet, Lacey's voice, 8-field brief, live and answering. | Works |
| Artist inbox (`/dashboard`) | Real. Reads matches, Accept-with-quote / Decline. Behind Supabase login. | Works, two buttons only |
| Database (Supabase `elitetatz`) | Schema exists, RLS on, Lacey is the one artist row. Zero clients, zero matches. | Exists, but anonymous writes were being rejected |
| Payments | $100 deposit via Stripe PaymentIntent. No Connect, no payout, `stripe_account_id` never set. **No Stripe keys in Vercel production.** | Not live |
| Notifications | Resend email from three different senders. SMS deleted Aug 27. No in-app. | Email only |
| Client side after the chat | Nothing. No contact captured, no email, no link, no record. | **The loop was open** |
| Marketplace pages | `/`, `/explore`, `/matches`, `/flash`, `/vault`, `/saved`, `/notifications`, `/artist/[id]` are mock data with fictional artists; `/payment` collects raw card numbers into dead inputs. | Must not be reachable in the pilot |

Four hard blockers made the loop impossible for a real client: (1) anonymous briefs were silently dropped by RLS, (2) the concierge never asked for contact details, (3) the deposit link 404'd for a logged-out client, (4) no payout path existed.

## The strategy

**Principle:** the agent is the consult. Lacey's surface is three buttons — Accept, Need more info, Pass. Everything else (contact, brief, quote delivery, deposit, dates, reminders, payout) is ours.

**Pilot loop (v1, shipping now):**
1. Client chats on rawsunart.com → concierge collects 8 fields + contact (9th field).
2. Brief saved with service role; match opened; client gets a signed inquiry link by email and text; Lacey gets email + text with the brief and a dashboard link.
3. Lacey taps one of three buttons. Accept = quote + proposed dates. Need more info = a question, which the client answers on their inquiry page (two-way thread). Pass = kind close.
4. Client pays the $100 deposit on a signed link (Stripe PaymentIntent, platform account).
5. Webhook marks paid/booked, keeps Lacey's quote as the final price, and transfers 80% to **her account or her shop's account** per her preference (Stripe Connect Express, both supported). If no account is connected yet, funds hold on the platform and the payouts page says so.
6. Balance is paid at the studio for the pilot. Full-price collection through the platform is v2.

**Containment:** with `SINGLE_ARTIST_MODE` set, every mock marketplace route redirects to `/rawsunart`; `/payment` is deleted; the bottom nav is hidden on client-facing pilot pages.

**v2 (after the first five real bookings):** full payment + balance invoicing, Google Calendar availability + real slot picking, automatic review request after the appointment, multi-artist registry replacing the hard-coded config, Vercel BotID on public routes.

## What ships in the `pilot-loop` branch

- Migration 005 (applied to the live DB): contact on matches, `info_requested` / `booked` statuses, `appointment_at`, `payout_target`, `match_messages` thread, artist payout preferences.
- `lib/tokens` signed links · `lib/sms` Dialpad restored · `lib/notify` one email+SMS surface.
- Concierge prompt: contact is required before BRIEF_READY.
- `/api/brief` rewritten; `/api/agent` rate limited.
- Artist inbox: three buttons, thread view, reply box, contact on every card. `/api/dashboard/respond` + `/api/dashboard/message`.
- Client inquiry page `/inquiry/[id]?t=` + `/api/inquiry`.
- Deposit: signed links, admin reads, accepted-only; confirmed page shows the date.
- Webhook: paid/booked, 80% transfer routed by `payout_target`, notifications both ways, Connect `account.updated`.
- `/api/stripe/connect` + `/dashboard/payouts`: "pay me" or "pay my shop", Express onboarding.
- Containment in `proxy.ts`; `/payment` deleted; `/auth/reset` + `/auth/update-password`; `.env.example`; `/rawsunart` facts aligned with the site and real images.

## What only Erica or Lacey can do (blocking go-live)

1. **Stripe:** decide which Stripe account is TatzAI's platform account (the MCP only sees "Feelings Unplugged"; `.env.local` holds some key). In that account enable **Connect** and Express accounts; add a webhook endpoint for `https://elitetatz.vercel.app/api/webhooks/stripe` with events `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`; then run:
   `vercel env add STRIPE_SECRET_KEY production`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL=https://elitetatz.vercel.app`, `MATCH_TOKEN_SECRET=<random 32+ chars>`.
2. **Dialpad:** create an API key in Dialpad (Admin → API keys, company-level, SMS scope) and add `DIALPAD_API_TOKEN` and `DIALPAD_FROM_NUMBER=+16148585574` to Vercel production. Without these, SMS is a silent no-op and email carries everything.
3. **Resend:** confirm `rawsunart.com` is verified (it sent the brief emails before, so likely yes); `elitetatz.com` is not, so all pilot mail now defaults to `RawSunArt <club@rawsunart.com>`.
4. **Lacey's login:** there is exactly one auth user and her artist row points at it. Confirm she can log in at `/auth/login` (or send her a magic link) and set `SINGLE_ARTIST_MODE=lacey` in production so the marketplace is sealed.
5. **Test run:** one fake client end to end with a Stripe test card before any real client.

## Success measures for the pilot

- Time from chat end to Lacey's first response (target under 24 h).
- Deposit conversion on accepted inquiries (target 60%+).
- Zero client emails/texts sent by hand by Lacey for a booked inquiry.
- Payout arrives in the chosen account within Stripe's standard schedule.
