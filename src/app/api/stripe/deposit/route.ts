import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { matchId } = await req.json()

  // Verify match exists and is accepted
  const { data: match } = await supabase
    .from('matches')
    .select('id, status, offered_price_cents, clients(email, name)')
    .eq('id', matchId)
    .single()

  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
  if (!['accepted', 'pending'].includes(match.status)) {
    return Response.json({ error: 'Deposit already paid or not applicable' }, { status: 409 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const depositCents = ARTIST_CONFIG.depositCents

  const paymentIntent = await stripe.paymentIntents.create({
    amount: depositCents,
    currency: 'usd',
    metadata: { match_id: matchId, type: 'deposit' },
    description: `RawSunArt deposit — tattoo appointment (credited to final price)`,
    receipt_email: (match.clients as { email?: string })?.email ?? undefined,
  })

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    depositCents,
    depositDollars: depositCents / 100,
  })
}
