import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMatch } from '@/lib/tokens'
import { checkAbuse } from '@/lib/rate-limit'
import { CONSENT_SCOPES, WORDING_VERSION, isScope } from '@/lib/consent'

// POST /api/consent { matchId, t, choices: { artist_updates?, elitetatz_network? }, source }
// Records the client's choices against their inquiry. The signed inquiry
// link is the proof of who is asking; it is checked before any write.

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const limited = checkAbuse('consent', req, { max: 20, windowMs: 10 * 60_000, maxPerDay: 300 })
  if (limited) return limited

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const matchId = str(payload.matchId)
  if (!verifyMatch(matchId, str(payload.t))) {
    return Response.json({ error: 'This link isn\'t valid' }, { status: 404 })
  }
  const source = payload.source === 'inquiry_page' ? 'inquiry_page' : 'concierge'
  const choices = (payload.choices ?? {}) as Record<string, unknown>
  const rows = Object.entries(choices)
    .filter(([scope, granted]) => isScope(scope) && typeof granted === 'boolean')
    .map(([scope, granted]) => ({
      match_id: matchId,
      scope,
      granted: granted as boolean,
      wording: CONSENT_SCOPES[scope as keyof typeof CONSENT_SCOPES],
      wording_version: WORDING_VERSION,
      source,
    }))
  if (!rows.length) return Response.json({ error: 'No choices' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return Response.json({ error: 'Unavailable' }, { status: 503 })

  const { error } = await admin.from('client_consents').insert(rows)
  if (error) {
    console.error('consent insert:', error.message)
    return Response.json({ error: 'Could not save' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
