# EliteTatz

The booking platform behind [rawsunart.com](https://rawsunart.com), running as a single-artist pilot for Lacey Rawson (RawSunArt).

A client chats with an AI concierge written in Lacey's voice. The concierge collects a brief and contact details, and Lacey answers from her inbox with one of three buttons: **Accept** (quote + dates), **Need more info**, or **Pass**. The client follows along on a signed link, which carries the studio's deposit link once Lacey accepts. Lacey's fee to the platform is $25 per booked lead, capped at 10 a month. Clients pay nothing beyond the deposit.

Stack: Next.js 16 (App Router, `src/proxy.ts`), Supabase (Postgres + Auth), Stripe (PaymentIntents + Connect), Anthropic (concierge), Resend (email), Dialpad (SMS), Cloudflare Turnstile. Hosted on Vercel.

## Run it locally

```bash
npm install
vercel env pull .env.local --environment=preview   # or copy .env.example and fill it in
npm run dev                                         # http://localhost:3000/rawsunart
```

`.env.example` documents every variable the code reads. Anything optional degrades instead of crashing: no Resend key skips email, no Dialpad token skips SMS.

**Deposits go to AION's own checkout** (Square) and Lacey marks them received in her inbox. The Stripe path with the 80/20 payout exists but stays off until `PLATFORM_DEPOSITS=on` *and* a Stripe key are set, so adding Stripe keys alone never changes where clients pay.

## Checks

| Command | What it runs |
|---|---|
| `npx tsc --noEmit` | Type check |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests (`__tests__/unit`, `src/**/__tests__`) |
| `npm run test:e2e` | Playwright against `npm run dev` (needs `.env.local`) |

CI (`.github/workflows/ci.yml`) runs the first three on every pull request and on `main`. Vercel deploys every branch as a preview and `main` to production.

## Where things are

| Path | What it is |
|---|---|
| `src/app/rawsunart` | Lacey's landing page and the entry to the concierge |
| `src/app/agent` + `api/agent`, `api/brief` | Concierge chat; a finished brief opens a match and notifies both sides |
| `src/app/inquiry/[matchId]`, `deposit/[matchId]` | Client pages, opened by signed links (`src/lib/tokens.ts`), no account |
| `src/app/dashboard` + `api/dashboard/*` | Lacey's inbox, payouts, billing and Google connection, behind Supabase login |
| `src/app/api/community/*` | Collectors Club: sign-up, confirm, unsubscribe, reconnect, artist leads, called from rawsunart.com |
| `src/app/api/stripe/*`, `api/webhooks/stripe` | Deposit PaymentIntents, Connect onboarding, webhook (paid → booked, 80% payout) |
| `src/app/artists` | Waitlist page for other artists |
| `src/lib/artists/lacey-rawson.ts` | Lacey's rates, deposit policy, voice and studio facts |
| `src/proxy.ts` | Session refresh, `/dashboard` guard, redirects for retired routes |
| `supabase/migrations` | Every database change, in order |
| `supabase/schema.sql` | Generated snapshot of production (reference only) |

## Database rules

- **Change the database only through a new numbered file in `supabase/migrations/`.** Apply it to production, note the date in its header, then regenerate `supabase/schema.sql`.
- **Private tables are deny-all to the browser** (migration 006): RLS on, no policies, no grants for `anon` or `authenticated`. Server routes check who is signed in, or verify a signed link, and then use the service role, filtered to that caller's rows (`src/lib/artist-session.ts`). The Supabase advisor's "RLS enabled, no policy" notices on those tables are expected.
- **Only the public catalog is readable:** `drops` and `artist_events`, select only.

## Public forms

Every public endpoint can trigger an email, so each one stacks defenses: a per-IP limit plus a daily cap (`src/lib/rate-limit.ts`), a honeypot field, a signed page-load stamp, Turnstile, and address hygiene. Sign-ups that get turned away are counted in `join_rejections`.

## Docs

- `docs/PILOT-STRATEGY-2026-09-21.md`: why the pilot is shaped this way.
- `AGENTS.md`: Next.js 16 differs from older versions; read `node_modules/next/dist/docs/` before changing framework code.
