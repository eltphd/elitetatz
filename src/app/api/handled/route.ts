import { createAdminClient } from '@/lib/supabase/admin'
import { verifyHandled } from '@/lib/tokens'
import { checkAbuse } from '@/lib/rate-limit'
import { CAN_BE_HANDLED, HANDLED_NOTE, handledElsewhere } from '@/lib/handled'

// The button behind the "Already answered them another way?" link in a
// reminder or the digest. No sign-in: the link was sent to the artist's own
// inbox and is signed for this one lead (lib/tokens.ts, signHandled). It
// leaves her private note on the card, which is what stops the reminders
// (lib/handled.ts). Nothing is sent to anyone, and a second tap changes nothing.
//
// POST { matchId, t } → { ok, already? }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const blocked = checkAbuse('handled', req, { max: 20, windowMs: 60_000 })
  if (blocked) return blocked

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const matchId = str(payload.matchId)
  if (!verifyHandled(matchId, str(payload.t))) return Response.json({ error: 'This link is not valid any more' }, { status: 401 })

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })

  const { data: match } = await db.from('matches').select('id, status').eq('id', matchId).maybeSingle()
  if (!match) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!CAN_BE_HANDLED.includes(match.status)) return Response.json({ ok: true, already: true })

  const [{ data: thread }, { data: notes }] = await Promise.all([
    db.from('match_messages').select('sender, created_at').eq('match_id', matchId),
    db.from('lead_notes').select('created_at').eq('match_id', matchId).eq('author', 'artist'),
  ])
  if (handledElsewhere(thread ?? [], notes ?? [])) return Response.json({ ok: true, already: true })

  const { error } = await db.from('lead_notes').insert({ match_id: matchId, author: 'artist', kind: 'note', body: HANDLED_NOTE })
  if (error) return Response.json({ error: 'Could not save. Try again.' }, { status: 500 })
  return Response.json({ ok: true })
}
