import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'
import { checkAbuse, isBot } from '@/lib/rate-limit'
import { corsHeaders, preflight } from '@/lib/cors'
import { passesTurnstile } from '@/lib/turnstile'
import { notifyArtist, notifyClient } from '@/lib/notify'
import { alertOperator } from '@/lib/alert'
import { inquiryUrl, appUrl, linksConfigured } from '@/lib/tokens'
import { recentInquiry, parseBudget } from '@/lib/inquiry'
import { cleanLabel } from '@/lib/labels'
import { PROBE_SOURCE, PROBE_HEADER, verifiedProbe } from '@/lib/probe-tag'
import { attachPhotos, photoLinks, verifiedPhotos, MAX_PHOTOS, type PhotoLink } from '@/lib/inquiry-photos'

// The inquiry form on rawsunart.com.
//
// The rule (Nov 9, 2026): every client message must reach Lacey's email,
// whether or not she ever opens the portal. So the order here is
//
//   1. validate; obvious bots (honeypot) get a fake success and nothing else
//   2. email Lacey the whole form, with the client's address as reply-to,
//      BEFORE anything is written: a database outage cannot lose the inquiry
//   3. record it in her portal inbox (a new match, or a note on the inquiry
//      this person already opened today) and count the source, server-side
//   4. send the client ONE confirmation with a copy of what they sent
//
// Since Nov 19, 2026 the form also carries (dev file F4, F6, F7):
//
//   - Up to five reference photos. They are uploaded ahead of the inquiry
//     (/api/community/inquiry/photo) and arrive here as signed tickets, so
//     her one email can show them as thumbnails. See src/lib/inquiry-photos.ts.
//     A photo that failed to upload never holds the inquiry back: the form
//     says how many did not come through, her email says so, and the client
//     is told to text them.
//   - An optional phone number and an unticked "OK to text me about this
//     inquiry" box. Both go to her email so she can text from her own phone.
//     The number is kept in the brief, NOT in matches.client_phone: that
//     column is what the portal texts from, and nothing automatic may text a
//     client (no SMS in production; TCPA). The consent is stored with the
//     time and the exact words.
//
// A failed bot check no longer turns anyone away: the inquiry is accepted,
// tagged "possible bot" in her email and in the thread, and she decides.
// Rate limits still bound the worst case. If both her email and the portal
// copy fail, the response is a 500 and rawsunart.com opens the client's mail
// app addressed to her, so the inquiry still has a way through.
//
// The daily probe (/api/cron/probe) posts here with found_via "test-probe"
// and a key signed with CRON_SECRET. It walks every step above so the check
// is real, except that nobody is mailed: her email is logged as skipped (so
// the probe can assert the route got that far) and there is no client
// receipt. The probe run, not this route, raises the alert when a probe step
// fails, so a miss is told once. The label alone is not enough: found_via is
// public input (rawsunart.com fills it from utm_source), so "test-probe"
// without a valid key is a real inquiry, handled in full, stored as "direct".
//
// Public and unauthenticated, so it is rate limited and honeypotted.

const str = (v: unknown, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max)

type ArtistRow = { id: string; payout_preference: string | null }

const WHERE: Record<string, string> = {
  columbus: `The studio (${ARTIST_CONFIG.studio})`,
  'future-convention': 'A future convention or guest spot',
  unsure: 'Not sure yet',
}

/** The sentence beside the box on the form. Stored with the consent, so the record says what was agreed to. */
export const TEXT_OK_WORDING = 'OK to text me about this inquiry.'

/** Her line as people write it: 614-858-5574. */
const artistPhone = () => {
  const d = (process.env.ARTIST_SMS_NUMBER ?? ARTIST_CONFIG.smsNumber).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d
}

/** A phone number as the client typed it, tidied. Empty unless it has enough digits to be one. */
export function cleanPhone(v: unknown): string {
  const typed = str(v, 40).replace(/[^\d+()\-.\s]/g, '').replace(/\s+/g, ' ').trim()
  const digits = typed.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? typed : ''
}

const ticked = (v: unknown) => v === true || /^(on|true|yes|1)$/i.test(str(v, 8))

// The confirmation repeats the client's own words back to the address they
// gave. Links are taken out of that copy so the form cannot be used to send
// someone else a message with a link in it under her name.
const noLinks = (s: string) => s.replace(/https?:\/\//gi, '').replace(/\bwww\./gi, '')

export function OPTIONS(req: Request) {
  return preflight(req)
}

export async function POST(req: Request) {
  const headers = corsHeaders(req)

  const limited = checkAbuse('form-inquiry', req, { max: 5, windowMs: 10 * 60_000, maxPerDay: 100 }, headers)
  if (limited) return limited

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers }) }

  // Report success to bots so they stop retrying and learn nothing.
  if (isBot(body)) return Response.json({ ok: true }, { headers })

  const clientName = str(body.name, 120)
  const clientEmail = str(body.email, 320).toLowerCase()
  const concept = str(body.concept, 2000)
  if (!clientName || !/^\S+@\S+\.\S+$/.test(clientEmail) || !concept) {
    return Response.json({ error: 'Name, a valid email and your idea are required' }, { status: 400, headers })
  }

  // The result travels with the inquiry instead of deciding it.
  const verified = await passesTurnstile(req, body.turnstileToken, 'inquiry')

  const placement = str(body.placement, 120)
  const size = str(body.size, 60)
  const style = str(body.style, 60)
  const budgetLabel = str(body.budget, 60)
  const where = WHERE[str(body.location, 40)] ?? ''
  const conventionCity = str(body.convention_city, 120)
  const reference = str(body.reference, 2000)
  const phone = cleanPhone(body.phone)
  // Texting is only ever okayed for a number that was given.
  const textOk = Boolean(phone) && ticked(body.text_ok)
  const label = cleanLabel(body.found_via, 'direct')
  const probe = label === PROBE_SOURCE && verifiedProbe(body.probe_tag, req.headers.get(PROBE_HEADER))
  // The probe's label is reserved for the probe. Anyone else who sends it is a
  // client like any other, and their source is recorded as direct.
  const foundVia = label === PROBE_SOURCE && !probe ? 'direct' : label
  if (label === PROBE_SOURCE && !probe) console.warn('form inquiry: "test-probe" label without a valid probe key; handled as a real inquiry')
  const whereLine = [where, conventionCity].filter(Boolean).join(': ')

  // Photos the form uploaded ahead of this request, proven by their tickets,
  // and how many more the client picked that did not make it.
  const photos = probe ? [] : verifiedPhotos(body.photos)
  const photosFailed = probe ? 0 : Math.max(0, Math.min(MAX_PHOTOS, Math.floor(Number(body.photos_failed) || 0)))

  // Who this belongs to, and whether it is a repeat. Reads only: if the
  // database is unreachable the email still goes.
  const db = createAdminClient()
  let artist: ArtistRow | null = null
  let priorMatchId: string | null = null
  let lookupError: string | null = db ? null : 'storage is not configured'
  if (db) {
    try {
      const { data, error } = await db.from('artists').select('id, payout_preference').eq('name', ARTIST_CONFIG.name).single()
      if (error || !data) lookupError = `artist lookup: ${error?.message ?? 'not found'}`
      artist = (data as ArtistRow | null) ?? null
      // A probe is always a fresh inquiry: yesterday's row must not make today's a follow-up.
      if (artist && !probe) priorMatchId = await recentInquiry(db, artist.id, clientEmail, '')
    } catch (err) {
      lookupError = `lookup threw: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // Links for her email. A read from storage, not a write, and it never
  // throws: with no links the email still goes and says where the photos are.
  const links: PhotoLink[] = db && photos.length ? await photoLinks(db, photos) : []

  const repeat = Boolean(priorMatchId)
  const matchId = priorMatchId ?? randomUUID()
  const dashboard = `${appUrl()}/dashboard`
  const firstName = ARTIST_CONFIG.name.split(' ')[0]
  const clientFirst = clientName.split(' ')[0] || 'the client'
  const herPhone = artistPhone()
  const plural = (n: number) => `${n} photo${n === 1 ? '' : 's'}`

  const phoneLine = !phone
    ? 'not given'
    : textOk
      ? `${phone} (ticked "OK to text me about this inquiry")`
      : `${phone} (did not tick "OK to text": call or email, do not text)`
  const photoLine = [
    photos.length ? (links.length === photos.length ? `${plural(photos.length)}, below` : `${plural(photos.length)}, on the card in your inbox (links could not be made for this email)`) : '',
    photosFailed ? `${plural(photosFailed)} did not come through; ${clientFirst} was told to text ${photosFailed === 1 ? 'it' : 'them'} to ${herPhone}` : '',
  ].filter(Boolean).join('. ') || 'none'

  // ---- 2. Lacey's copy, first ---------------------------------------------
  const details = `From: ${clientName}
Email: ${clientEmail}
Phone: ${phoneLine}
Idea: ${concept}
Placement: ${placement || 'not given'}
Size: ${size || 'not given'}
Style: ${style || 'not given'}
Budget: ${budgetLabel || 'not given'}
Where: ${whereLine || 'not given'}
Notes: ${reference || 'none'}
Photos: ${photoLine}
Found you via: ${foundVia}`

  const notice = await notifyArtist({
    kind: probe ? 'Probe inquiry' : repeat ? 'Inquiry follow-up' : verified ? 'New inquiry' : 'New inquiry (unverified)',
    ref: matchId,
    replyTo: clientEmail,
    // A new match does not exist yet; the log row is attached once it does.
    matchId: repeat ? matchId : null,
    artistId: artist?.id ?? null,
    skip: probe ? 'probe: not sent by design' : null,
    images: links,
    subject: `${probe ? '[test-probe] ' : ''}${verified ? '' : '[possible bot] '}${repeat ? 'Follow-up' : 'Inquiry'}: ${concept.slice(0, 60)}${placement ? ` (${placement})` : ''}`,
    text: `${repeat ? 'Another message from someone who sent an inquiry in the last 24 hours. It is added to that thread.' : 'New inquiry from the rawsunart.com form.'}
${verified ? '' : '\nThe bot check did not pass for this one. Most often that is a real person whose check expired; treat any links in it with care.\n'}
${details}

Reply to this email and it goes straight to ${clientFirst} (${clientEmail}).
It is also in your inbox: ${dashboard}
Accept with a quote, ask for more info, or pass. Ref ${matchId.slice(0, 8)}.`,
    sms: `${verified ? '' : '[possible bot] '}${repeat ? 'Follow-up' : 'New inquiry'}: ${concept.slice(0, 60)}${placement ? ` on ${placement}` : ''}. ${dashboard}`,
  })

  // ---- 3. The portal copy --------------------------------------------------
  let portal = false
  let portalError: string | null = lookupError
  let attached = 0
  const now = new Date().toISOString()
  if (db && artist && repeat) {
    const { error } = await db.from('match_messages').insert({
      match_id: matchId,
      sender: 'client',
      body: `Sent the form again:\n${details}`,
    })
    if (error) portalError = `follow-up insert: ${error.message}`
    else {
      portal = true
      await db.from('matches').update({ updated_at: now, last_client_message_at: now }).eq('id', matchId)
      attached = await attachPhotos(db, matchId, null, photos)
    }
  } else if (db && artist) {
    const brief = {
      concept,
      placement,
      size,
      styles: style ? [style] : [],
      ...parseBudget(budgetLabel),
      budget_label: budgetLabel,
      where,
      convention_city: conventionCity,
      has_reference: Boolean(reference) || photos.length > 0,
      client_name: clientName,
      client_email: clientEmail,
      // Hers to call or text from her own phone. Deliberately not `client_phone`:
      // the portal must never text this number by itself.
      ...(phone ? { contact_phone: phone, text_ok: textOk } : {}),
      ...(textOk ? { text_ok_at: now, text_ok_wording: TEXT_OK_WORDING } : {}),
      ...(photos.length ? { photos: photos.length } : {}),
      ...(photosFailed ? { photos_failed: photosFailed } : {}),
      source: 'rawsunart-form',
      // utm_source on the first page of the visit (rawsunart.com sets it), so a
      // Reconnect-driven inquiry reads "reconnect1" on the card as well as in the counts.
      found_via: foundVia,
      bot_check: verified ? 'passed' : 'failed',
    }
    const { error: matchErr } = await db
      .from('matches')
      .insert({
        id: matchId,
        artist_id: artist.id,
        status: 'pending',
        client_brief: JSON.stringify(brief),
        ai_summary: concept.slice(0, 200),
        offered_price_cents: ARTIST_CONFIG.minimumCents, // placeholder until the artist quotes
        placement: placement || null,
        client_name: clientName,
        client_email: clientEmail,
        payout_target: artist.payout_preference ?? 'artist',
        last_client_message_at: now,
      })
    if (matchErr) {
      portalError = `match insert: ${matchErr.message}`
      console.error('form inquiry: match insert', matchErr)
    } else {
      portal = true
      const sent = [photos.length ? `${plural(photos.length)} attached` : '', photosFailed ? `${plural(photosFailed)} did not come through` : ''].filter(Boolean).join('; ')
      await db.from('match_messages').insert([
        {
          match_id: matchId,
          sender: 'system',
          body: `Inquiry sent from the rawsunart.com form.${whereLine ? ` Where: ${whereLine}.` : ''}${sent ? ` ${sent[0].toUpperCase()}${sent.slice(1)}.` : ''}${verified ? '' : ' The bot check did not pass; this may be a real person whose check expired, or spam.'}`,
        },
        ...(reference ? [{ match_id: matchId, sender: 'client', body: reference }] : []),
      ])
      attached = await attachPhotos(db, matchId, null, photos)
      if (notice.logId) await db.from('artist_notifications').update({ match_id: matchId }).eq('id', notice.logId)
    }

    // Count where the client found Lacey: here, in the same request, once.
    // No person in the row. The monthly scorecard reads these.
    const { error: srcErr } = await db.from('inquiry_sources').insert({ artist_handle: 'rawsunart', source: foundVia })
    if (srcErr) console.error('form inquiry: inquiry_sources insert', srcErr)
  }

  // ---- 4. The client's confirmation -----------------------------------------
  // One email, never two: what happens next, a copy of what they sent, and
  // their inquiry page when there is one. Sent whenever the inquiry reached
  // Lacey by either route. The probe is not a client and gets none.
  const delivered = portal || notice.emailed
  let receipt = false
  if (delivered && !probe) {
    const page = portal && linksConfigured() ? inquiryUrl(matchId) : null
    // Their own words go back only when the bot check passed (see noLinks).
    const copy = verified
      ? `\nWhat you sent:\n${noLinks(`Idea: ${concept}
Placement: ${placement || 'not given'}
Size: ${size || 'not given'}
Style: ${style || 'not given'}
Budget: ${budgetLabel || 'not given'}
Where: ${whereLine || 'not given'}
Notes: ${reference || 'none'}
Phone: ${phone ? `${phone} (${textOk ? 'OK to text' : 'no texts'})` : 'not given'}
Photos: ${photos.length ? `${photos.length} received` : 'none'}`)}\n`
      : ''
    const photoHelp = photosFailed
      ? `${photosFailed === 1 ? 'One photo' : `${photosFailed} photos`} did not attach. Text ${photosFailed === 1 ? 'it' : 'them'} to ${herPhone} and ${photosFailed === 1 ? 'it' : 'they'} will reach ${firstName}.`
      : `Want to add a photo? Text it to ${herPhone}.`
    try {
      await notifyClient({
        email: clientEmail,
        subject: `Your inquiry with ${ARTIST_CONFIG.name} is in`,
        text: `Hey ${clientName.split(' ')[0] || 'there'},

Got it. ${firstName} reads every inquiry herself and replies within two days (she is in the studio Wednesday to Saturday).${repeat ? ' This was added to the inquiry you sent earlier.' : ''}
${copy}
${photoHelp}
${page ? `\nYour inquiry page: ${page}\nKeep that link. When she accepts, the $${ARTIST_CONFIG.depositCents / 100} deposit link appears there, and the deposit comes off your final price.\n` : ''}
— ${ARTIST_CONFIG.handle}`,
      })
      receipt = true
    } catch (err) {
      console.error('form inquiry: client confirmation', err)
    }
  }

  // ---- Outcome -------------------------------------------------------------
  // A probe's misses are reported by the probe run, which reads the rows this
  // request left (or did not), so nothing is raised twice.
  const strandedPhotos = photos.length - attached
  if (!portal && !notice.emailed && !probe) {
    // Both copies lost. notifyArtist already alerted on the email; say the
    // portal failed too, and let rawsunart.com hand it to the client's mail app.
    await alertOperator({
      subject: `Form inquiry LOST both ways (ref ${matchId.slice(0, 8)})`,
      text: `A rawsunart.com inquiry could not be emailed to Lacey (${notice.error ?? 'unknown'}) and could not be saved to the portal (${portalError ?? 'unknown'}). The site opened the client's mail app as a last resort. Ref ${matchId.slice(0, 8)}.${photos.length ? ` It came with ${plural(photos.length)}, which are in storage with no lead and will be swept in three days.` : ''}`,
    })
    return Response.json({ error: 'Could not deliver the inquiry' }, { status: 500, headers })
  }
  if (!portal && !probe) {
    await alertOperator({
      subject: `Form inquiry reached Lacey by email only (ref ${matchId.slice(0, 8)})`,
      text: `The portal could not record a rawsunart.com inquiry: ${portalError ?? 'unknown'}. Lacey has the email copy and can answer from it. Nothing is lost, but the portal and the source count are missing this one. Ref ${matchId.slice(0, 8)}.${photos.length ? ` It came with ${plural(photos.length)}: the links in her email work, but with no lead to hold them the files are swept in three days.` : ''}`,
    })
  } else if (portal && strandedPhotos > 0 && !probe) {
    // The inquiry is safe and her email has the links; only the card is missing the photos.
    await alertOperator({
      subject: `Inquiry photos not on the card (ref ${matchId.slice(0, 8)})`,
      text: `A rawsunart.com inquiry was saved, but ${plural(strandedPhotos)} could not be put on its card. The links in Lacey's email work for now; with no row to hold them the files are swept in three days. Ref ${matchId.slice(0, 8)}.`,
    })
  }

  if (!portal && !notice.emailed) return Response.json({ error: 'Could not deliver the inquiry' }, { status: 500, headers })

  return Response.json(
    {
      ok: true,
      portal,
      emailed: notice.emailed,
      // What the page tells the client: how many photos arrived, and whether a confirmation is on its way.
      photos: photos.length,
      receipt,
      ...(repeat ? { duplicate: true } : {}),
      // Only a verified probe is told which row it made, so it checks its own.
      ...(probe ? { ref: matchId } : {}),
      ...(verified ? {} : { unverified: true }),
    },
    { headers }
  )
}
