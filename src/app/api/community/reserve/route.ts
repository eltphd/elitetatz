import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { sendSms } from '@/lib/sms'
import { getArtistDrops, findDropItem } from '@/lib/community/drops'

// Reserve a booth print: issue a pickup code, count "print N of 10", and hold
// it for 20 minutes. Buyer gets the code by email; the artist gets a hold
// notice (Reply-To buyer). Requires Supabase (to count/track) + Resend (code).

const HOLD_MINUTES = 20

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

function makeCode(): string {
  // Ambiguity-free alphabet (no O/0/I/1), 6 chars — easy to read aloud at a booth.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

interface ReserveBody {
  artistHandle?: string
  dropSlug?: string
  email?: string
  name?: string
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  let body: ReserveBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const artistHandle = (body.artistHandle ?? '').trim().toLowerCase()
  const dropSlug = (body.dropSlug ?? '').trim()
  const name = (body.name ?? '').trim().slice(0, 120) || null
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Valid email required' }, { status: 400, headers })
  }

  const artist = getArtistDrops(artistHandle)
  const item = findDropItem(artistHandle, dropSlug)
  if (!artist || !item) {
    return Response.json({ error: 'Unknown piece' }, { status: 404, headers })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    // Can't count or hold without storage — tell the client to fall back.
    return Response.json({ error: 'Reservations not configured' }, { status: 503, headers })
  }

  const nowIso = new Date().toISOString()

  // Expire stale holds first so their slots free up.
  await supabase
    .from('drop_claims')
    .update({ status: 'expired' })
    .eq('artist_handle', artistHandle)
    .eq('drop_slug', dropSlug)
    .eq('status', 'reserved')
    .lt('expires_at', nowIso)

  // Same email already holding this piece? Return their existing code.
  const { data: mine } = await supabase
    .from('drop_claims')
    .select('code, booth_index, expires_at')
    .eq('artist_handle', artistHandle)
    .eq('drop_slug', dropSlug)
    .eq('email', email)
    .in('status', ['reserved', 'picked_up'])
    .gt('expires_at', nowIso)
    .maybeSingle()
  if (mine?.code) {
    return Response.json(
      { ok: true, code: mine.code, boothIndex: mine.booth_index, total: item.boothQty, expiresAt: mine.expires_at, reused: true },
      { headers }
    )
  }

  // Count active holds + pickups toward the booth quantity.
  const { count: taken } = await supabase
    .from('drop_claims')
    .select('id', { count: 'exact', head: true })
    .eq('artist_handle', artistHandle)
    .eq('drop_slug', dropSlug)
    .in('status', ['reserved', 'picked_up'])

  const already = taken ?? 0
  if (already >= item.boothQty) {
    return Response.json(
      { ok: false, soldOut: true, total: item.boothQty, message: 'All booth copies are reserved — order online instead.' },
      { headers }
    )
  }

  const boothIndex = already + 1
  const code = makeCode()
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString()

  const { error } = await supabase.from('drop_claims').insert({
    drop_slug: dropSlug,
    artist_handle: artistHandle,
    email,
    name,
    status: 'reserved',
    code,
    booth_index: boothIndex,
    reserved_at: nowIso,
    expires_at: expiresAt,
  })
  if (error) {
    console.error('reserve insert:', error)
    return Response.json({ error: 'Could not reserve' }, { status: 500, headers })
  }

  const price = `$${(item.priceCents / 100).toFixed(0)}`

  // Buyer: the code + the deadline.
  await sendEmail({
    from: artist.fromEmail,
    to: email,
    subject: `Your ${item.title} print is on hold — code ${code}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
<h2 style="font-family:Georgia,serif;">You reserved <span style="color:#c9a050;">${item.title}</span></h2>
<p>Print <strong>${boothIndex} of ${item.boothQty}</strong> · ${price}</p>
<div style="border:2px dashed #c9a050;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
  <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6f2e;">Your pickup code</div>
  <div style="font-size:38px;font-weight:800;letter-spacing:6px;color:#0a0805;">${code}</div>
</div>
<p><strong>Show this code to Lacey at the booth within ${HOLD_MINUTES} minutes.</strong> After that the hold releases to the next collector. Can't make it in time? Just order online — reply to this email.</p>
<p style="color:#888;">— ${artist.artistName} · ${artist.instagramHandle}</p>
</div>`,
    text: `You reserved ${item.title} — print ${boothIndex} of ${item.boothQty} (${price}).\nPickup code: ${code}\nShow it to Lacey at the booth within ${HOLD_MINUTES} minutes or the hold releases.`,
  })

  // Artist: hold notice, Reply-To buyer.
  await sendEmail({
    from: artist.fromEmail,
    to: artist.notifyEmail,
    subject: `⏳ HOLD ${item.title} — code ${code} (${boothIndex}/${item.boothQty})`,
    html: `<p><strong>${name ?? 'Someone'}</strong> reserved <strong>${item.title}</strong> (print ${boothIndex} of ${item.boothQty}, ${price}).</p>
<p>Pickup code: <strong style="font-size:20px;">${code}</strong></p>
<p>Hold it until <strong>${new Date(expiresAt).toLocaleTimeString('en-US', { timeZone: 'America/Phoenix' })} (Phoenix)</strong>. They should show this code at the booth. Reply to reach them directly.</p>`,
    text: `${name ?? 'Someone'} reserved ${item.title} (${boothIndex}/${item.boothQty}, ${price}). Code ${code}. Hold until ${expiresAt}. Reply reaches the buyer.`,
    replyTo: email,
  })

  // One-line SMS heads-up (best-effort)
  if (artist.smsNumber) {
    await sendSms({
      to: artist.smsNumber,
      text: `🧾 ${name ?? 'Someone'} reserved ${item.title} print (${boothIndex}/${item.boothQty}) — code ${code}. Hold ${HOLD_MINUTES} min.`,
    })
  }

  return Response.json({ ok: true, code, boothIndex, total: item.boothQty, expiresAt }, { headers })
}
