import { artistContext } from '@/lib/artist-session'
import { sendEmail } from '@/lib/resend'

// Lacey's decision on something in the approvals queue.
//   POST { id, decision: 'approve' | 'changes', notes? }
// Records the decision and tells the operator (OPERATOR_EMAIL, falling back
// to ARTIST_NOTIFICATION_CC). The thing itself is sent or published by the
// operator afterwards; approving here moves nothing to a client.

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let p: Record<string, unknown>
  try { p = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = str(p.id)
  const decision = str(p.decision)
  const notes = str(p.notes).slice(0, 4000) || null
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  if (decision !== 'approve' && decision !== 'changes') return Response.json({ error: 'decision must be approve or changes' }, { status: 400 })
  if (decision === 'changes' && !notes) return Response.json({ error: 'Say what should change' }, { status: 400 })

  const { data: item } = await db.from('approvals').select('id, kind, key, title, status').eq('id', id).eq('artist_id', artist.id).single()
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })
  if (['sent', 'published'].includes(item.status)) return Response.json({ error: 'This one already went out' }, { status: 409 })

  const status = decision === 'approve' ? 'approved' : 'changes_requested'
  const decidedAt = new Date().toISOString()
  const { error } = await db.from('approvals').update({ status, artist_notes: notes, decided_at: decidedAt, updated_at: decidedAt }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const to = process.env.OPERATOR_EMAIL?.trim() || process.env.ARTIST_NOTIFICATION_CC?.trim()
  if (to) {
    const text = `${artist.name ?? 'The artist'} ${decision === 'approve' ? 'approved' : 'asked for changes on'} "${item.title}" (${item.kind}, key ${item.key}).${notes ? `\n\nNotes:\n${notes}` : ''}\n\n${decision === 'approve' ? 'It is still unsent: run the send with the approval check on.' : 'Resubmit when revised; it will come back as pending.'}`
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    await sendEmail({
      to,
      subject: `${decision === 'approve' ? 'Approved' : 'Changes requested'}: ${item.title}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(text)}</div>`,
      text,
    }).catch(() => {})
  }
  return Response.json({ ok: true, status, decided_at: decidedAt })
}
