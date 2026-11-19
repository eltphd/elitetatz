import { createAdminClient } from '@/lib/supabase/admin'
import { checkAbuse } from '@/lib/rate-limit'
import { corsHeaders, preflight } from '@/lib/cors'
import { verifyStamp } from '@/lib/tokens'
import { MAX_PHOTO_BYTES, photosConfigured, signPhoto, storePendingPhoto } from '@/lib/inquiry-photos'

// One reference photo from the rawsunart.com inquiry form, sent ahead of the
// inquiry itself (see src/lib/inquiry-photos.ts for why it goes first).
//
// POST multipart/form-data: file (one image), ts (the page-load stamp)
//   → 200 { ok, ticket, name }   the ticket goes in the inquiry's `photos`
//   → 4xx/5xx { error }          the form sends the inquiry without this photo
//                                and tells the client to text it instead
//
// Nothing is emailed and no database row is written here. The file sits in
// the private bucket until an inquiry claims it, or is swept after three days.
//
// Public and unauthenticated: rate limited per address and per day, gated by
// the signed page-load stamp (a script that never loaded the page has none),
// and only real JPEG, PNG or HEIC bytes are kept, whatever the file is called.
// The form shrinks large photos in the browser, because a request body on
// this host cannot be much over 4 MB; the 10 MB check here is the outer wall.

export const maxDuration = 60

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)
  const fail = (status: number, error: string) => Response.json({ error }, { status, headers })

  const limited = checkAbuse('form-inquiry-photo', req, { max: 15, windowMs: 10 * 60_000, maxPerDay: 300 }, headers)
  if (limited) return limited
  if (!photosConfigured()) return fail(503, 'Photos are not available right now')

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_PHOTO_BYTES + 64 * 1024) return fail(413, 'That photo is over 10 MB')

  let form: FormData
  try { form = await req.formData() } catch { return fail(400, 'Send the photo as a form') }

  const stamp = verifyStamp(form.get('ts'))
  if (stamp !== 'ok') return fail(403, 'Please reload the page and try again')

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return fail(400, 'Pick a photo')
  if (file.size > MAX_PHOTO_BYTES) return fail(413, 'That photo is over 10 MB')

  const db = createAdminClient()
  if (!db) return fail(503, 'Photos are not available right now')

  const stored = await storePendingPhoto(db, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
  if (!stored.ok) return fail(stored.status, stored.error)

  return Response.json({ ok: true, ticket: signPhoto(stored.photo), name: stored.photo.name }, { headers })
}
