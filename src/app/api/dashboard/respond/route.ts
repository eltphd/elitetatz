import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId, action, price_cents, artist_response } = await req.json()

  // Verify this match belongs to the logged-in artist
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) return Response.json({ error: 'Not an artist account' }, { status: 403 })

  const { data: match } = await supabase
    .from('matches')
    .select('id, artist_id, client_id, status')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()

  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
  if (match.status !== 'pending') return Response.json({ error: 'Already responded' }, { status: 409 })

  const updates: Record<string, unknown> = {
    status: action === 'accept' ? 'accepted' : 'rejected',
    artist_responded_at: new Date().toISOString(),
    artist_response: artist_response ?? null,
    updated_at: new Date().toISOString(),
  }

  if (action === 'accept' && price_cents) {
    updates.offered_price_cents = price_cents
  }

  const { error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Insert notification for the client
  if (action === 'accept') {
    await supabase.from('artist_notifications').insert({
      artist_id: artist.id,
      match_id: matchId,
      type: 'accepted',
      message: artist_response ?? `Your inquiry was accepted! Deposit required to confirm your appointment.`,
    }).then(() => null)

    // Optional: email client via Resend if key set
    if (process.env.RESEND_API_KEY) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('email, name')
        .eq('id', match.client_id)
        .single()

      if (clientData?.email) {
        const depositUrl = `${process.env.NEXT_PUBLIC_APP_URL}/deposit/${matchId}`
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'TatzAI <noreply@tatzai.com>',
            to: clientData.email,
            subject: 'Your tattoo inquiry was accepted by Lacey Rawson',
            text: `Hey ${clientData.name ?? 'there'},\n\nLacey reviewed your inquiry and wants to work with you.\n\n${artist_response ? `Her note: "${artist_response}"\n\n` : ''}To confirm your appointment, pay the $100 deposit here:\n${depositUrl}\n\nThe deposit comes off your final price as long as you show up.\n\n— RawSunArt via TatzAI`,
          }),
        }).catch(() => null)
      }
    }
  }

  return Response.json({ ok: true })
}
