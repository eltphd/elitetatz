import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyClient } from '@/lib/notify'
import { inquiryUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Artist posts a free-form message on a match thread. Does not change
// status — that is what /api/dashboard/respond is for.
//
// Body: { matchId, body }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const firstName = ARTIST_CONFIG.name.split(' ')[0]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(payload.matchId)
  const body = str(payload.body).slice(0, 4000)
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!body) return Response.json({ error: 'Message is empty' }, { status: 400 })

  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) return Response.json({ error: 'Not an artist account' }, { status: 403 })

  const { data: match } = await supabase
    .from('matches')
    .select('id, status, client_name, client_email, client_phone, ai_summary')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })

  const row = { match_id: matchId, sender: 'artist', body }
  let { data: inserted, error } = await supabase.from('match_messages').insert(row).select('id, created_at').single()
  if (error) {
    const admin = createAdminClient()
    if (!admin) return Response.json({ error: error.message }, { status: 500 })
    const retry = await admin.from('match_messages').insert(row).select('id, created_at').single()
    inserted = retry.data
    error = retry.error
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  const inquiry = inquiryUrl(matchId)
  const name = match.client_name || 'there'
  try {
    await notifyClient({
      email: match.client_email,
      phone: match.client_phone,
      subject: `Message from ${firstName} about your piece`,
      text: `Hey ${name},

${firstName} wrote back about ${str(match.ai_summary) || 'your inquiry'}:

"${body}"

Reply on your inquiry page:
${inquiry}

— ${ARTIST_CONFIG.handle}`,
      sms: `${ARTIST_CONFIG.handle}: ${firstName} wrote back — "${body.slice(0, 100)}${body.length > 100 ? '…' : ''}" Reply here: ${inquiry}`,
    })
  } catch (err) {
    console.error('message notify:', err)
  }

  return Response.json({
    ok: true,
    message: { id: inserted?.id ?? null, sender: 'artist', body, created_at: inserted?.created_at ?? new Date().toISOString() },
  })
}
