import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe, artistShareCents, matchConcept } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { appUrl, inquiryUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Stripe → TatzAI. Runs with the service role: nobody is signed in here.
//
//   payment_intent.succeeded      deposit landed → mark paid/booked, pay out 80%
//   payment_intent.payment_failed → back to 'accepted' so the client can retry
//   account.updated (Connect)     → flip stripe_onboarding_complete
//
// Stripe retries on non-2xx and may deliver an event twice, so every branch
// checks the match's current status before mutating.

const SETTLED = new Set(['paid', 'booked', 'completed'])

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return Response.json({ error: 'Webhook not configured' }, { status: 400 })

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret)
  } catch (err) {
    console.error('stripe webhook: bad signature', err)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Service unavailable' }, { status: 503 })

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await onDepositPaid(db, event.data.object)
        break
      case 'payment_intent.payment_failed':
        await onDepositFailed(db, event.data.object)
        break
      case 'account.updated':
        await onAccountUpdated(db, event.data.object)
        break
      default:
        break
    }
  } catch (err) {
    // A 500 makes Stripe retry, which is what we want for transient DB/Stripe
    // hiccups. Idempotency guards above make the retry safe.
    console.error(`stripe webhook: ${event.type} failed`, err)
    return Response.json({ error: 'Handler failed' }, { status: 500 })
  }

  return Response.json({ received: true })
}

type MatchRow = {
  id: string
  status: string
  artist_id: string | null
  offered_price_cents: number | null
  final_price_cents: number | null
  appointment_at: string | null
  proposed_dates: string | null
  payout_target: 'artist' | 'shop' | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  client_brief: string | null
  ai_summary: string | null
  stripe_transfer_id: string | null
}

type ArtistRow = {
  id: string
  name: string | null
  stripe_account_id: string | null
  shop_stripe_account_id: string | null
  shop_name: string | null
}

const MATCH_COLUMNS =
  'id, status, artist_id, offered_price_cents, final_price_cents, appointment_at, proposed_dates, payout_target, client_name, client_email, client_phone, client_brief, ai_summary, stripe_transfer_id'

async function loadMatch(db: SupabaseClient, matchId: string): Promise<MatchRow | null> {
  const { data, error } = await db.from('matches').select(MATCH_COLUMNS).eq('id', matchId).single()
  if (error || !data) {
    console.warn('stripe webhook: match not found', matchId, error?.message)
    return null
  }
  return data as MatchRow
}

async function systemMessage(db: SupabaseClient, matchId: string, body: string) {
  const { error } = await db.from('match_messages').insert({ match_id: matchId, sender: 'system', body })
  if (error) console.error('stripe webhook: match_messages insert failed', error.message)
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

async function onDepositPaid(db: SupabaseClient, pi: Stripe.PaymentIntent) {
  const matchId = pi.metadata?.match_id
  if (!matchId) {
    console.warn('stripe webhook: payment_intent.succeeded without match_id', pi.id)
    return
  }
  const match = await loadMatch(db, matchId)
  if (!match) return

  // Duplicate delivery, or the deposit already settled through another path.
  if (SETTLED.has(match.status)) {
    console.info('stripe webhook: deposit already recorded for', matchId)
    return
  }

  const now = new Date().toISOString()
  const nextStatus = match.appointment_at ? 'booked' : 'paid'

  // Conditional update: only the row still in 'accepted' flips, so two
  // concurrent deliveries can't both proceed to the payout step.
  const { data: flipped, error: updErr } = await db
    .from('matches')
    .update({
      status: nextStatus,
      stripe_payment_intent_id: pi.id,
      // The quote is the price of the tattoo; the deposit is only a credit
      // against it. Never let the $100 overwrite the quote.
      final_price_cents: match.final_price_cents ?? match.offered_price_cents,
      updated_at: now,
    })
    .eq('id', matchId)
    .eq('status', match.status)
    .select('id')
  if (updErr) throw updErr
  if (!flipped || flipped.length === 0) {
    console.info('stripe webhook: lost the race on', matchId, '— another delivery handled it')
    return
  }

  const depositDollars = pi.amount / 100
  await systemMessage(db, matchId, `Deposit of $${depositDollars} received.`)

  // ---- Payout: 80% to whichever account the artist chose --------------------
  let artist: ArtistRow | null = null
  if (match.artist_id) {
    const { data } = await db
      .from('artists')
      .select('id, name, stripe_account_id, shop_stripe_account_id, shop_name')
      .eq('id', match.artist_id)
      .single()
    artist = (data as ArtistRow | null) ?? null
  }

  const target = match.payout_target ?? 'artist'
  const destination = target === 'shop' ? artist?.shop_stripe_account_id : artist?.stripe_account_id
  const share = artistShareCents(pi.amount)
  let transferId: string | null = null

  if (destination) {
    try {
      const transfer = await stripe.transfers.create({
        amount: share,
        currency: pi.currency,
        destination,
        transfer_group: matchId,
        // Ties the transfer to the charge so it settles when the card funds
        // clear instead of failing on an empty platform balance.
        source_transaction: typeof pi.latest_charge === 'string' ? pi.latest_charge : undefined,
        metadata: {
          match_id: matchId,
          artist_id: match.artist_id ?? '',
          payout_target: target,
          payment_intent: pi.id,
        },
      })
      transferId = transfer.id
      const { error } = await db
        .from('matches')
        .update({ stripe_transfer_id: transfer.id, updated_at: new Date().toISOString() })
        .eq('id', matchId)
      if (error) console.error('stripe webhook: failed to store transfer id', transfer.id, error.message)
      await systemMessage(
        db,
        matchId,
        `$${(share / 100).toFixed(2)} sent to ${target === 'shop' ? (artist?.shop_name || 'the shop') : 'the artist'}'s Stripe account.`
      )
    } catch (err) {
      // Not fatal: the money is safe on the platform. The payouts page shows
      // it as held until the account is ready and it's paid out by hand.
      console.error(`stripe webhook: transfer to ${destination} failed for ${matchId}; holding on platform`, err)
      await systemMessage(db, matchId, `Payout to the ${target} account could not be sent yet; $${(share / 100).toFixed(2)} is held by TatzAI.`)
    }
  } else {
    console.warn(`stripe webhook: no connected ${target} account for artist ${match.artist_id}; holding $${share / 100} on platform for ${matchId}`)
    await systemMessage(db, matchId, `No connected ${target} payout account yet; $${(share / 100).toFixed(2)} is held by TatzAI until one is set up.`)
  }

  // ---- Notifications (best-effort) -----------------------------------------
  const concept = matchConcept(match)
  const client = match.client_name || match.client_email || 'a client'
  const dates = match.appointment_at
    ? `Appointment: ${formatWhen(match.appointment_at)}`
    : match.proposed_dates
      ? `Proposed dates: ${match.proposed_dates}`
      : 'No date set yet'
  const link = inquiryUrl(matchId)

  await db
    .from('artist_notifications')
    .insert({
      artist_id: match.artist_id,
      match_id: matchId,
      type: 'deposit_paid',
      message: `Deposit paid by ${client} for ${concept}. ${dates}.`,
    })
    .then(({ error }) => { if (error) console.warn('artist_notifications insert:', error.message) })

  const payoutLine = transferId
    ? `$${(share / 100).toFixed(2)} (80%) is on its way to your ${target === 'shop' ? 'shop' : 'personal'} Stripe account.`
    : `$${(share / 100).toFixed(2)} (80%) is being held by TatzAI until your payout account is connected: ${appUrl()}/dashboard/payouts`

  await Promise.allSettled([
    notifyArtist({
      subject: `Deposit paid — ${client} · ${concept}`,
      text: `${client} just paid the $${depositDollars} deposit for "${concept}".
${dates}.

${payoutLine}
The balance is settled at the studio as usual.

Open the inquiry: ${link}
Your inbox: ${appUrl()}/dashboard`,
      sms: `Deposit paid by ${client} for ${concept}, ${dates.toLowerCase()}. ${link}`,
    }),
    notifyClient({
      email: match.client_email,
      phone: match.client_phone,
      subject: `Deposit received — you're on ${ARTIST_CONFIG.name.split(' ')[0]}'s books`,
      text: `Hey ${match.client_name || 'there'},

Your $${depositDollars} deposit for "${concept}" is in. It comes off your final price; the balance is paid at the studio when you come in.

${match.appointment_at
  ? `Your appointment: ${formatWhen(match.appointment_at)}.`
  : `${ARTIST_CONFIG.name.split(' ')[0]} will confirm your date on your inquiry page.`}

Your inquiry page (keep this link): ${link}

${ARTIST_CONFIG.address}

— ${ARTIST_CONFIG.handle}`,
      sms: `${ARTIST_CONFIG.handle}: $${depositDollars} deposit received for ${concept}. ${match.appointment_at ? `See you ${formatWhen(match.appointment_at)}.` : 'Date confirmation is coming.'} ${link}`,
    }),
  ])
}

async function onDepositFailed(db: SupabaseClient, pi: Stripe.PaymentIntent) {
  const matchId = pi.metadata?.match_id
  if (!matchId) return
  const match = await loadMatch(db, matchId)
  if (!match) return
  // A failed attempt after a successful one (e.g. a retried card on a stale
  // page) must not un-pay the match.
  if (SETTLED.has(match.status)) return

  if (match.status !== 'accepted') {
    const { error } = await db
      .from('matches')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', matchId)
    if (error) throw error
  }
  const reason = pi.last_payment_error?.message ? ` (${pi.last_payment_error.message})` : ''
  await systemMessage(db, matchId, `Deposit payment failed${reason}. The client can try again from the deposit link.`)
}

async function onAccountUpdated(db: SupabaseClient, account: Stripe.Account) {
  const { data, error } = await db
    .from('artists')
    .select('id, payout_preference, stripe_account_id, shop_stripe_account_id, stripe_onboarding_complete')
    .or(`stripe_account_id.eq.${account.id},shop_stripe_account_id.eq.${account.id}`)
    .limit(1)
  if (error) throw error
  const artist = data?.[0]
  if (!artist) return

  const complete = Boolean(account.charges_enabled && account.payouts_enabled)
  const isPreferred =
    (artist.payout_preference ?? 'artist') === 'shop'
      ? artist.shop_stripe_account_id === account.id
      : artist.stripe_account_id === account.id

  // The flag describes the account the artist is actually paid through.
  if (!isPreferred) return
  if (artist.stripe_onboarding_complete === complete) return

  const { error: updErr } = await db
    .from('artists')
    .update({ stripe_onboarding_complete: complete })
    .eq('id', artist.id)
  if (updErr) throw updErr
  console.info(`stripe webhook: artist ${artist.id} ${account.id} onboarding ${complete ? 'complete' : 'incomplete'}`)
}
