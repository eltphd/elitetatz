import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, buildWelcomeEmail } from '@/lib/resend'
import { checkAbuse, isBot } from '@/lib/rate-limit'
import { corsHeaders, preflight } from '@/lib/cors'
import { passesTurnstile, failedCheck } from '@/lib/turnstile'
import { verifyStamp } from '@/lib/tokens'
import { normalizeEmail, emailRejectReason } from '@/lib/email-hygiene'
import { logRejection } from '@/lib/join-rejections'

// Collectors Club signup. Called from rawsunart.com.
//
// Three layers, all of them, because the first eight rows were bots:
//   1. honeypot (`website`) + page-load stamp (`ts`, signed, 3 s to 24 h old)
//      → bots get a fake success and nothing is written;
//   2. Cloudflare Turnstile → 403 until the widget passes;
//   3. address hygiene: role mailboxes and disposable domains → 400.
// Everything turned away is counted in join_rejections (reason, IP hash, UA).
// The welcome email carries a one-click confirm link; only rows with
// confirmed_at set are ever emailed after that.
//
// This endpoint sends mail, so it is also rate limited — see lib/rate-limit.ts
// for why CORS alone is not a control here.

export function OPTIONS(req: Request) {
  return preflight(req)
}

interface SubscribeBody {
  email?: string
  name?: string
  source?: string
  artistHandle?: string
  ts?: string
  turnstileToken?: string
  website?: string
  _gotcha?: string
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  const limited = checkAbuse('subscribe', req, { max: 5, windowMs: 60 * 60_000, maxPerDay: 200 }, headers)
  if (limited) return limited

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const artistHandle = (body.artistHandle ?? 'rawsunart').trim().toLowerCase().slice(0, 60)
  const supabase = createAdminClient()
  const fakeSuccess = async (reason: string) => {
    await logRejection(supabase, artistHandle, reason, req)
    // Report success to bots so they stop retrying and learn nothing.
    return Response.json({ ok: true }, { headers })
  }
  const refuse = async (reason: string, status: number, error: string) => {
    await logRejection(supabase, artistHandle, reason, req)
    return Response.json({ error }, { status, headers })
  }

  if (isBot(body as Record<string, unknown>)) return fakeSuccess('honeypot')

  const stamp = verifyStamp(body.ts)
  if (stamp === 'missing') return refuse('stamp_missing', 400, 'Reload the page and try again.')
  if (stamp !== 'ok') return fakeSuccess(`stamp_${stamp}`)

  if (!(await passesTurnstile(req, body.turnstileToken, 'subscribe'))) {
    await logRejection(supabase, artistHandle, 'turnstile', req)
    return failedCheck(headers)
  }

  const email = normalizeEmail(body.email)
  if (!email) return refuse('invalid_email', 400, 'Valid email required')
  const why = emailRejectReason(email)
  if (why) return refuse(why, 400, 'Use a personal email address.')

  const name = (body.name ?? '').trim().slice(0, 120) || null
  const source = (body.source ?? 'web').trim().slice(0, 80)

  if (!supabase) {
    // Not configured yet — tell the caller so it can say so.
    return Response.json({ error: 'Community backend not configured' }, { status: 503, headers })
  }

  // Upsert keyed on (artist_handle, email): re-signups refresh source/name
  // but never duplicate, and never resurrect an unsubscribe.
  const { data: existing } = await supabase
    .from('community_members')
    .select('id, unsubscribed_at, welcome_sent_at, confirmed_at')
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

  // Welcome + confirm email — once per member, best-effort.
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
      confirmUrl: `${appUrl}/api/community/confirm?id=${memberId}`,
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
