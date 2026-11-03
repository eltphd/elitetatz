import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMatch, appUrl } from '@/lib/tokens'
import { checkAbuse } from '@/lib/rate-limit'
import { notifyArtist } from '@/lib/notify'
import { storeAttachment, ALLOWED_MIMES, MAX_ATTACHMENT_BYTES } from '@/lib/attachments'

// A client adds reference photos from their inquiry page. The signed token in
// the link is the proof; files go to the private bucket under the lead and
// Lacey sees them on the card. No email attachments, no "did you get it".
//
// POST multipart/form-data: matchId, t, files (up to 6)

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const MAX_FILES = 6

export async function POST(req: Request) {
  const limited = checkAbuse('inquiry-upload', req, { max: 20, windowMs: 10 * 60_000, maxPerDay: 300 })
  if (limited) return limited

  let form: FormData
  try { form = await req.formData() } catch { return Response.json({ error: 'Send the files as a form' }, { status: 400 }) }

  const matchId = str(form.get('matchId'))
  const token = str(form.get('t'))
  if (!verifyMatch(matchId, token)) return Response.json({ error: "This link isn't valid" }, { status: 404 })

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FILES)
  if (!files.length) return Response.json({ error: 'Pick at least one image or PDF' }, { status: 400 })
  for (const f of files) {
    if (f.size > MAX_ATTACHMENT_BYTES) return Response.json({ error: `${f.name} is over 25 MB` }, { status: 413 })
    if (f.type && !ALLOWED_MIMES.has(f.type.toLowerCase())) return Response.json({ error: `${f.name}: images and PDFs only` }, { status: 415 })
  }

  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Unavailable' }, { status: 503 })

  const { data: match } = await db.from('matches').select('id, status, client_name, ai_summary').eq('id', matchId).single()
  if (!match) return Response.json({ error: "This link isn't valid" }, { status: 404 })
  if (['rejected', 'cancelled'].includes(match.status)) return Response.json({ error: 'This inquiry is closed' }, { status: 409 })

  const { data: sys } = await db
    .from('match_messages')
    .insert({ match_id: matchId, sender: 'system', body: `Client added ${files.length} reference file${files.length === 1 ? '' : 's'}.`, channel: 'web' })
    .select('id')
    .single()

  const stored: Array<{ id: string; filename: string }> = []
  for (const f of files) {
    const row = await storeAttachment(db, { matchId, messageId: sys?.id ?? null, filename: f.name, mime: f.type || null, bytes: await f.arrayBuffer(), source: 'client' })
    if (row) stored.push({ id: row.id, filename: row.filename })
  }
  if (!stored.length) {
    if (sys?.id) await db.from('match_messages').delete().eq('id', sys.id)
    return Response.json({ error: 'Those files could not be saved. Images and PDFs under 25 MB work.' }, { status: 422 })
  }
  if (stored.length !== files.length && sys?.id) {
    await db.from('match_messages').update({ body: `Client added ${stored.length} reference file${stored.length === 1 ? '' : 's'}.` }).eq('id', sys.id)
  }
  await db.from('matches').update({ updated_at: new Date().toISOString(), last_client_message_at: new Date().toISOString() }).eq('id', matchId)

  const who = match.client_name || 'A client'
  await notifyArtist({
    kind: 'Reference files added',
    ref: matchId,
    subject: `${who} added ${stored.length} reference file${stored.length === 1 ? '' : 's'}`,
    text: `${who} added ${stored.length} reference file${stored.length === 1 ? '' : 's'} to their inquiry (${str(match.ai_summary) || 'their piece'}).\n\nSee them on the card: ${appUrl()}/dashboard\nRef ${matchId.slice(0, 8)}.`,
    sms: `${who} added ${stored.length} reference file${stored.length === 1 ? '' : 's'}. ${appUrl()}/dashboard`,
  })

  return Response.json({ ok: true, files: stored })
}
