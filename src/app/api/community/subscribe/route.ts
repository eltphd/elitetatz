import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildWelcomeEmail } from '@/lib/resend'
import { checkAbuse, isBot } from '@/lib/rate-limit'

// Collectors Club signup. Called from rawsunart.com.
//
// This endpoint sends mail, so it is rate limited and honeypotted — see
// lib/rate-limit.ts for why CORS alone is not a control here.
//
// The convention walk-up ping and Dialpad SMS heads-up that used to live in
// this route were removed: the event ended, and as unauthenticated
// email/SMS triggers they were the vector for the spam that followed.

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
  artistHandle?: string
  _gotcha?: string
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  const limited = checkAbuse('subscribe', req, { max: 5, windowMs: 10 * 60_000, maxPerDay: 200 }, headers)
  if (limited) return limited

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  // Report success to bots so they stop retrying and learn nothing.
  if (isBot(body as Record<string, unknown>)) {
    return Response.json({ ok: true }, { headers })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Valid email required' }, { status: 400, headers })
  }

  const name = (body.name ?? '').trim().slice(0, 120) || null
  const artistHandle = (body.artistHandle ?? 'rawsunart').trim().toLowerCase().slice(0, 60)
  const source = (body.source ?? 'web').trim().slice(0, 80)

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
      .update({ name: name ?? undefined, source })
      .eq('id', existing.id)
  } else {
    const { data: created, error } = await supabase
      .from('community_members')
      .insert({ artist_handle: artistHandle, email, name, source })
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
      artistName: 'Lacey Rawson',
      artistHandle: artistHandle === 'rawsunart' ? 'RawSunArt' : artistHandle,
      instagramUrl: 'https://instagram.com/raw.sun.art',
      siteUrl: 'https://rawsunart.com',
      recipientName: name?.split(' ')[0],
      unsubscribeUrl: `${appUrl}/api/community/unsubscribe?id=${memberId}`,
    })

    const sent = await sendEmail({ to: email, ...welcome })
    if (sent) {
      await supabase
        .from('community_members')
        .update({ welcome_sent_at: new Date().toISOString() })
        .eq('id', memberId)
    }
  }

  return Response.json({ ok: true, memberId }, { headers })
}
