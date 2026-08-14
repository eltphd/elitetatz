import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildWelcomeEmail } from '@/lib/resend'
import { getEventConfig } from '@/lib/community/events'

// Public community signup endpoint. Called from artist presence sites
// (rawsunart.com) and from /e/[slug] event funnels on this app.
// Records the member in Supabase and sends the branded welcome email.

const ALLOWED_ORIGINS = new Set([
  'https://rawsunart.com',
  'https://www.rawsunart.com',
  'https://rawsunart-web.vercel.app',
  'https://elitetatz.vercel.app',
  'http://localhost:3000',
])

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://rawsunart.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

interface SubscribeBody {
  email?: string
  name?: string
  source?: string
  eventSlug?: string
  artistHandle?: string
  giveawayEntry?: boolean
  intent?: string            // 'walkup' = wants a tattoo at the event, ping the artist now
  note?: string              // their idea, forwarded in the artist ping
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Valid email required' }, { status: 400, headers })
  }

  const name = (body.name ?? '').trim().slice(0, 120) || null
  const artistHandle = (body.artistHandle ?? 'rawsunart').trim().toLowerCase().slice(0, 60)
  const eventSlug = (body.eventSlug ?? '').trim().slice(0, 80) || null
  const source = (body.source ?? eventSlug ?? 'web').trim().slice(0, 80)
  const event = eventSlug ? getEventConfig(eventSlug) : null
  const giveawayEntry = Boolean(body.giveawayEntry && event?.giveaway)

  const supabase = createAdminClient()
  if (!supabase) {
    // Not configured yet — tell the caller so it can fall back (e.g. Formspree).
    return Response.json({ error: 'Community backend not configured' }, { status: 503, headers })
  }

  // Upsert keyed on (artist_handle, email): re-signups refresh source/name
  // but never duplicate, and never resurrect an unsubscribe.
  const { data: existing } = await supabase
    .from('community_members')
    .select('id, unsubscribed_at, welcome_sent_at')
    .eq('artist_handle', artistHandle)
    .eq('email', email)
    .maybeSingle()

  let memberId: string
  if (existing) {
    memberId = existing.id
    await supabase
      .from('community_members')
      .update({
        name: name ?? undefined,
        source,
        event_slug: eventSlug ?? undefined,
        giveaway_entry: giveawayEntry || undefined,
      })
      .eq('id', existing.id)
  } else {
    const { data: created, error } = await supabase
      .from('community_members')
      .insert({
        artist_handle: artistHandle,
        email,
        name,
        source,
        event_slug: eventSlug,
        giveaway_entry: giveawayEntry,
      })
      .select('id')
      .single()

    if (error || !created) {
      console.error('community insert:', error)
      return Response.json({ error: 'Could not save signup' }, { status: 500, headers })
    }
    memberId = created.id
  }

  // Welcome email — once per member, best-effort.
  const alreadyWelcomed = Boolean(existing?.welcome_sent_at)
  const unsubscribed = Boolean(existing?.unsubscribed_at)
  if (!alreadyWelcomed && !unsubscribed) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://elitetatz.vercel.app'
    const welcome = buildWelcomeEmail({
      artistName: event?.artistName ?? 'Lacey Rawson',
      artistHandle: event?.artistHandle === 'rawsunart' || artistHandle === 'rawsunart' ? 'RawSunArt' : artistHandle,
      instagramUrl: event?.instagramUrl ?? 'https://instagram.com/raw.sun.art',
      siteUrl: event?.siteUrl ?? 'https://rawsunart.com',
      recipientName: name?.split(' ')[0],
      eventTitle: event ? `${event.eventTitle} · ${event.city}` : undefined,
      giveawayEntry,
      unsubscribeUrl: `${appUrl}/api/community/unsubscribe?id=${memberId}`,
    })

    const sent = await sendEmail({ from: event?.fromEmail, to: email, ...welcome })
    if (sent) {
      await supabase
        .from('community_members')
        .update({ welcome_sent_at: new Date().toISOString() })
        .eq('id', memberId)
    }
  }

  // Walk-up interest: ping the artist immediately, Reply-To set to the client
  // so the artist's normal inbox reply goes straight to them — no dashboard.
  if (body.intent === 'walkup') {
    const note = (body.note ?? '').trim().slice(0, 2000)
    const artistInbox = event?.notifyEmail ?? process.env.ARTIST_NOTIFICATION_EMAIL
    if (artistInbox) {
      const where = event ? `${event.eventTitle} · ${event.city}` : source
      await sendEmail({
        from: event?.fromEmail,
        to: artistInbox,
        subject: `🔥 Walk-up interest${name ? `: ${name}` : ''} — ${where}`,
        html: `<p><strong>${name ?? 'Someone'}</strong> scanned your booth QR and wants a tattoo <strong>this weekend</strong>.</p>
${note ? `<p>Their idea: &ldquo;${note.replace(/</g, '&lt;')}&rdquo;</p>` : ''}
<p>Email: ${email}</p>
<p><strong>Just hit reply</strong> — your reply goes straight to them.</p>`,
        text: `${name ?? 'Someone'} scanned your booth QR and wants a tattoo this weekend.\n${note ? `Their idea: "${note}"\n` : ''}Email: ${email}\n\nJust hit reply — your reply goes straight to them.`,
        replyTo: email,
      })
    }
  }

  return Response.json({ ok: true, memberId }, { headers })
}
