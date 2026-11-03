import { artistContext } from '@/lib/artist-session'
import { notifyClient } from '@/lib/notify'
import { inquiryUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { chatwootReply } from '@/lib/inbound/chatwoot'

// Artist posts a free-form message on a match thread. Does not change
// status — that is what /api/dashboard/respond is for.
//
// Body: { matchId, body }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const firstName = ARTIST_CONFIG.name.split(' ')[0]

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(payload.matchId)
  const body = str(payload.body).slice(0, 4000)
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!body) return Response.json({ error: 'Message is empty' }, { status: 400 })

  const { data: match } = await db
    .from('matches')
    .select('id, status, client_name, client_email, client_phone, ai_summary, external_thread_id')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })

  // Where the reply goes: back into the client's DM thread when the lead came
  // through Chatwoot, and by email and text when we have those. The thread
  // row is written first; delivery is best-effort and never undoes it.
  const dmThread = typeof match.external_thread_id === 'string' && match.external_thread_id.startsWith('chatwoot:') ? match.external_thread_id : null
  const row = { match_id: matchId, sender: 'artist', body }
  const { data: inserted, error } = await db.from('match_messages').insert(row).select('id, created_at').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const inquiry = inquiryUrl(matchId)
  const name = match.client_name || 'there'
  let delivered: string[] = []
  try {
    if (dmThread) {
      const ok = await chatwootReply(dmThread, body)
      if (ok) delivered.push('dm')
    }
    if (match.client_email || match.client_phone) delivered = delivered.concat([match.client_email ? 'email' : '', match.client_phone ? 'sms' : ''].filter(Boolean))
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
    delivered,
    message: { id: inserted?.id ?? null, sender: 'artist', body, created_at: inserted?.created_at ?? new Date().toISOString() },
  })
}
