import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend'

// Artist / shop-owner waitlist for the platform ("I want this for my work").
// Fed by /artists on this app and /for-artists on artist presence sites.

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

interface LeadBody {
  name?: string
  email?: string
  instagram?: string
  role?: string
  city?: string
  message?: string
  source?: string
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  let body: LeadBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const name = (body.name ?? '').trim().slice(0, 120)
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return Response.json({ error: 'Name and valid email required' }, { status: 400, headers })
  }

  const role = ['artist', 'shop_owner', 'other'].includes(body.role ?? '') ? body.role! : 'artist'
  const lead = {
    name,
    email,
    instagram: (body.instagram ?? '').trim().replace(/^@/, '').slice(0, 80) || null,
    role,
    city: (body.city ?? '').trim().slice(0, 120) || null,
    message: (body.message ?? '').trim().slice(0, 2000) || null,
    source: (body.source ?? 'web').trim().slice(0, 80),
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return Response.json({ error: 'Backend not configured' }, { status: 503, headers })
  }

  const { error } = await supabase
    .from('artist_leads')
    .upsert(lead, { onConflict: 'email' })

  if (error) {
    console.error('artist lead insert:', error)
    return Response.json({ error: 'Could not save' }, { status: 500, headers })
  }

  // Notify the founder — a hot lead from the convention floor shouldn't wait.
  const notify = process.env.ARTIST_NOTIFICATION_EMAIL
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `🔥 New artist lead: ${name}${lead.city ? ` (${lead.city})` : ''}`,
      html: `<p><strong>${name}</strong> (${role.replace('_', ' ')}) wants an artist hub.</p>
<ul>
<li>Email: ${email}</li>
<li>Instagram: ${lead.instagram ? '@' + lead.instagram : '—'}</li>
<li>City: ${lead.city ?? '—'}</li>
<li>Source: ${lead.source}</li>
</ul>
${lead.message ? `<p>Message: ${lead.message}</p>` : ''}`,
      text: `${name} (${role}) wants an artist hub. Email: ${email}. IG: ${lead.instagram ?? '—'}. City: ${lead.city ?? '—'}. Source: ${lead.source}. ${lead.message ?? ''}`,
      replyTo: email,
    })
  }

  return Response.json({ ok: true }, { headers })
}
