import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'
import { getArtistDrops, findDropItem } from '@/lib/community/drops'

// "I want this" claim on a Booth Drop. Records the claim (best-effort) and
// pings the artist with Reply-To set to the buyer — the sale conversation
// is a normal inbox reply, no dashboard required.

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

interface ClaimBody {
  artistHandle?: string
  dropSlug?: string
  email?: string
  name?: string
  note?: string
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  let body: ClaimBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const artistHandle = (body.artistHandle ?? '').trim().toLowerCase()
  const dropSlug = (body.dropSlug ?? '').trim()
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Valid email required' }, { status: 400, headers })
  }

  const artist = getArtistDrops(artistHandle)
  const item = findDropItem(artistHandle, dropSlug)
  if (!artist || !item) {
    return Response.json({ error: 'Unknown piece' }, { status: 404, headers })
  }

  const name = (body.name ?? '').trim().slice(0, 120) || null
  const note = (body.note ?? '').trim().slice(0, 2000) || null

  // Record the claim — best-effort; the artist ping below is the critical path.
  const supabase = createAdminClient()
  if (supabase) {
    await supabase.from('drop_claims').insert({
      drop_slug: dropSlug,
      artist_handle: artistHandle,
      email,
      name,
      note,
    })
  }

  const price = `$${(item.priceCents / 100).toFixed(0)}`
  const sent = await sendEmail({
    from: artist.fromEmail,
    to: artist.notifyEmail,
    subject: `🧾 Print claim: ${item.title} (${price})${name ? ` — ${name}` : ''}`,
    html: `<p><strong>${name ?? 'Someone'}</strong> wants <strong>${item.title}</strong> (${price} · ${item.kind}).</p>
${note ? `<p>Their note: &ldquo;${note.replace(/</g, '&lt;')}&rdquo;</p>` : ''}
<p>Email: ${email}</p>
<p><img src="${item.imageUrl}" alt="${item.title}" width="240" style="border-radius:8px;" /></p>
<p><strong>Just hit reply</strong> — your reply goes straight to the buyer. Arrange pickup at the booth or shipping + payment.</p>`,
    text: `${name ?? 'Someone'} wants ${item.title} (${price} · ${item.kind}).\n${note ? `Note: "${note}"\n` : ''}Email: ${email}\n\nJust hit reply — it goes straight to the buyer.`,
    replyTo: email,
  })

  if (!supabase && !sent) {
    // Neither storage nor email configured — tell the caller so it can fall back.
    return Response.json({ error: 'Backend not configured' }, { status: 503, headers })
  }

  return Response.json({ ok: true }, { headers })
}
