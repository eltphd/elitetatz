import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const matchId = pi.metadata.match_id

      if (matchId) {
        // Mark match as paid
        await supabase
          .from('matches')
          .update({
            status: 'paid',
            stripe_payment_intent_id: pi.id,
            final_price_cents: pi.amount,
          })
          .eq('id', matchId)

        // Transfer 80% to artist (TatzAI keeps 20% platform fee)
        const match = await supabase
          .from('matches')
          .select('artist_id, artists(stripe_account_id)')
          .eq('id', matchId)
          .single()

        const artistAccountId = (match.data?.artists as unknown as { stripe_account_id: string } | null)?.stripe_account_id
        if (artistAccountId) {
          const transfer = await stripe.transfers.create({
            amount: Math.floor(pi.amount * 0.8),
            currency: 'usd',
            destination: artistAccountId,
            metadata: { match_id: matchId },
          })

          await supabase
            .from('matches')
            .update({ stripe_transfer_id: transfer.id })
            .eq('id', matchId)
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      const matchId = pi.metadata.match_id
      if (matchId) {
        await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
