import { stripe, matchConcept } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMatch } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Client-side deposit: the signed link token is the only proof the visitor
// holds. Reads/writes go through the service role because the client has no
// session. Only the $100 deposit moves through the platform; the balance is
// settled at the studio.

const PAID_STATUSES = new Set(['paid', 'booked', 'completed'])

export async function POST(req: Request) {
  let body: { matchId?: unknown; t?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const matchId = typeof body.matchId === 'string' ? body.matchId : ''
  const t = typeof body.t === 'string' ? body.t : null
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!verifyMatch(matchId, t)) return Response.json({ error: 'Invalid or expired link' }, { status: 403 })

  const supabase = createAdminClient()
  if (!supabase) return Response.json({ error: 'Service unavailable' }, { status: 503 })

  const { data: match, error } = await supabase
    .from('matches')
    .select('id, status, artist_id, offered_price_cents, client_brief, ai_summary, client_email, client_name, proposed_dates, payout_target, stripe_payment_intent_id')
    .eq('id', matchId)
    .single()

  if (error || !match) return Response.json({ error: 'Match not found' }, { status: 404 })

  const concept = matchConcept(match)
  const summary = {
    amount: ARTIST_CONFIG.depositCents,
    concept,
    proposedDates: match.proposed_dates ?? null,
    offeredPriceCents: match.offered_price_cents ?? null,
    clientName: match.client_name ?? null,
  }

  if (PAID_STATUSES.has(match.status)) {
    return Response.json({ alreadyPaid: true, ...summary })
  }
  if (match.status !== 'accepted') {
    return Response.json(
      { error: 'This inquiry is not ready for a deposit yet. Lacey has to accept it first.', status: match.status },
      { status: 409 }
    )
  }

  // Reuse an open PaymentIntent so a refresh doesn't litter Stripe with
  // abandoned intents; fall through to a fresh one if it's dead.
  if (match.stripe_payment_intent_id) {
    try {
      const existing = await stripe.paymentIntents.retrieve(match.stripe_payment_intent_id)
      if (existing.status === 'succeeded') {
        return Response.json({ alreadyPaid: true, ...summary })
      }
      if (existing.status !== 'canceled' && existing.amount === ARTIST_CONFIG.depositCents && existing.client_secret) {
        return Response.json({ clientSecret: existing.client_secret, ...summary })
      }
    } catch (err) {
      console.warn('deposit: could not retrieve prior PaymentIntent', err)
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: ARTIST_CONFIG.depositCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: match.client_email ?? undefined,
    description: `Tattoo deposit — ${concept}`.slice(0, 1000),
    transfer_group: matchId,
    metadata: {
      match_id: matchId,
      payout_target: match.payout_target ?? 'artist',
      artist_id: match.artist_id ?? '',
      type: 'deposit',
    },
  })

  const { error: saveError } = await supabase
    .from('matches')
    .update({ stripe_payment_intent_id: paymentIntent.id, updated_at: new Date().toISOString() })
    .eq('id', matchId)
  if (saveError) console.error('deposit: failed to save payment intent id', saveError)

  return Response.json({ clientSecret: paymentIntent.client_secret, ...summary })
}
