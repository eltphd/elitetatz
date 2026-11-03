import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { artistForInbound } from '@/lib/channels'
import { checkAbuse } from '@/lib/rate-limit'
import { notifyArtist } from '@/lib/notify'
import { isKind } from '@/lib/approvals'
import { appUrl } from '@/lib/tokens'

// The operator's door to the approvals queue. A script (or Erica, by curl)
// submits a rendered email or blog post for Lacey to read and decide on, and
// reads the decision back before sending or publishing anything.
//
//   POST /api/approvals   header x-operator-key: $OPERATOR_API_KEY
//        { kind, key, title, summary?, subject?, body_html?, body_text?, audience?, audience_count? }
//        → upserts on (artist, key); resubmitting a decided item resets it to pending
//   GET  /api/approvals?key=rsa-reconnect-1   → { status, decided_at, artist_notes }
//
// Nothing here sends to a client. Submitting notifies Lacey that something is
// waiting; that is the only message it produces.

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

function authorized(req: Request): boolean {
  const secret = process.env.OPERATOR_API_KEY?.trim()
  const given = req.headers.get('x-operator-key')?.trim()
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const blocked = checkAbuse('approvals', req, { max: 30, windowMs: 60_000 })
  if (blocked) return blocked
  if (!process.env.OPERATOR_API_KEY) return Response.json({ error: 'Approvals are not configured (OPERATOR_API_KEY)' }, { status: 503 })
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const artist = await artistForInbound(db)
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 503 })

  let p: Record<string, unknown>
  try { p = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const kind = str(p.kind)
  const key = str(p.key).slice(0, 120)
  const title = str(p.title).slice(0, 200)
  if (!isKind(kind)) return Response.json({ error: 'kind must be email_campaign or blog_post' }, { status: 400 })
  if (!key || !title) return Response.json({ error: 'key and title required' }, { status: 400 })
  const bodyHtml = str(p.body_html).slice(0, 400_000) || null
  const bodyText = str(p.body_text).slice(0, 100_000) || null
  if (!bodyHtml && !bodyText) return Response.json({ error: 'body_html or body_text required' }, { status: 400 })
  const count = Number.isFinite(Number(p.audience_count)) ? Math.max(0, Math.round(Number(p.audience_count))) : null

  const row = {
    artist_id: artist.id,
    kind,
    key,
    title,
    summary: str(p.summary).slice(0, 2000) || null,
    subject: str(p.subject).slice(0, 300) || null,
    body_html: bodyHtml,
    body_text: bodyText,
    audience: str(p.audience).slice(0, 300) || null,
    audience_count: count,
    status: 'pending',
    artist_notes: null,
    decided_at: null,
    submitted_by: str(p.submitted_by).slice(0, 80) || 'operator',
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db.from('approvals').upsert(row, { onConflict: 'artist_id,key' }).select('id, status').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // appUrl() always yields a full https link: a missing NEXT_PUBLIC_APP_URL
  // once produced a bare "/dashboard/approvals" in her email.
  const link = `${appUrl()}/dashboard/approvals`
  await notifyArtist({
    kind: 'approval',
    ref: data.id,
    subject: `Waiting for your okay: ${title}`,
    text: `${kind === 'email_campaign' ? 'An email to your list' : 'A blog post'} is waiting for your okay in the inbox. Nothing goes out until you tap Approve.\n\n${link}`,
    sms: `Waiting for your okay in the inbox: ${title}. Nothing goes out until you approve it. ${link}`,
  })
  return Response.json({ ok: true, id: data.id, status: data.status })
}

export async function GET(req: Request) {
  const blocked = checkAbuse('approvals', req, { max: 60, windowMs: 60_000 })
  if (blocked) return blocked
  if (!process.env.OPERATOR_API_KEY) return Response.json({ error: 'Approvals are not configured (OPERATOR_API_KEY)' }, { status: 503 })
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const key = str(new URL(req.url).searchParams.get('key'))
  if (!key) return Response.json({ error: 'key required' }, { status: 400 })
  const db = createAdminClient()
  if (!db) return Response.json({ error: 'Storage is not configured' }, { status: 503 })
  const artist = await artistForInbound(db)
  if (!artist) return Response.json({ error: 'Artist not found' }, { status: 503 })
  const { data } = await db.from('approvals').select('id, kind, key, title, status, decided_at, artist_notes').eq('artist_id', artist.id).eq('key', key).maybeSingle()
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}
