import { artistContext } from '@/lib/artist-session'

// Private notes on a lead. The artist's own words to herself: never shown to
// the client, never sent anywhere. The assistant's questions and answers land
// in the same table (author 'assistant') from /api/dashboard/assistant.
//
// POST   { matchId, body }  → one note
// DELETE { id }             → removes a note on one of her own leads

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const matchId = str(payload.matchId)
  const body = str(payload.body).slice(0, 4000)
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!body) return Response.json({ error: 'Write something first' }, { status: 400 })

  const { data: match } = await db.from('matches').select('id').eq('id', matchId).eq('artist_id', artist.id).single()
  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })

  const { data, error } = await db
    .from('lead_notes')
    .insert({ match_id: matchId, author: 'artist', kind: 'note', body })
    .select('id, author, kind, body, created_at')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, note: data })
}

export async function DELETE(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = str(payload.id)
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { data: note } = await db.from('lead_notes').select('id, match_id').eq('id', id).single()
  if (!note) return Response.json({ error: 'Not found' }, { status: 404 })
  const { data: match } = await db.from('matches').select('id').eq('id', note.match_id).eq('artist_id', artist.id).single()
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db.from('lead_notes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
