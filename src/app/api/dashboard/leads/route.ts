import Anthropic from '@anthropic-ai/sdk'
import { artistContext } from '@/lib/artist-session'
import { appendClientMessage, findOpenLead, isChannel, openLead, type Channel } from '@/lib/channels'
import { toE164 } from '@/lib/sms'

// Lacey adds a lead by hand: a DM she pastes in, a voicemail she transcribes,
// a conversation at the shop. The text is read for the brief fields the
// concierge would have captured so the card looks like every other card.
// The client is not contacted; nothing leaves this route.
//
// Body: { channel, name?, email?, phone?, handle?, text, subject? }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const MANUAL_CHANNELS: Channel[] = ['instagram', 'facebook', 'email', 'sms', 'manual']

interface Extracted {
  concept?: string
  styles?: string[]
  placement?: string
  size?: string
  budget_min_cents?: number
  budget_max_cents?: number
  has_reference?: boolean
  open_questions?: string[]
}

async function extractBrief(text: string): Promise<Extracted> {
  if (!process.env.ANTHROPIC_API_KEY) return {}
  try {
    const client = new Anthropic()
    const res = await client.messages.create({
      model: process.env.ASSISTANT_MODEL?.trim() || 'claude-opus-5-5',
      max_tokens: 600,
      system: 'You read a tattoo inquiry a studio received and fill a brief. Reply with one JSON object and nothing else, keys: concept (one line, what they want), styles (array of words like watercolor, fine line, black and grey, color, lines only), placement, size (as written, e.g. "about 4 inches", else ""), budget_min_cents, budget_max_cents (integers, 0 when not stated), has_reference (true only if they mention sending or having a reference or photo), open_questions (array, what the artist would still need to know before quoting: size, placement, color vs black and grey, lines vs shading, reference). Never invent a value that is not in the text.',
      messages: [{ role: 'user', content: text.slice(0, 6000) }],
    })
    const out = res.content.find((b) => b.type === 'text')
    if (!out || out.type !== 'text') return {}
    const json = out.text.match(/\{[\s\S]*\}/)?.[0]
    return json ? (JSON.parse(json) as Extracted) : {}
  } catch (err) {
    console.warn('brief extraction skipped:', err instanceof Error ? err.message : err)
    return {}
  }
}

export async function POST(req: Request) {
  const ctx = await artistContext<{ id: string; name: string | null; payout_preference: string | null }>('id, name, payout_preference')
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const channel = str(payload.channel)
  const text = str(payload.text).slice(0, 8000)
  const name = str(payload.name).slice(0, 120) || null
  const email = str(payload.email).toLowerCase().slice(0, 200) || null
  const phone = toE164(str(payload.phone))
  const handle = str(payload.handle).replace(/^@/, '').slice(0, 80) || null
  const subject = str(payload.subject).slice(0, 200) || null

  if (!isChannel(channel) || !MANUAL_CHANNELS.includes(channel)) return Response.json({ error: 'Pick where it came from' }, { status: 400 })
  if (!text) return Response.json({ error: 'Paste what the client wrote' }, { status: 400 })
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'That email does not look right' }, { status: 400 })

  const extracted = await extractBrief(text)
  const concept = str(extracted.concept) || subject || text.split(/\n+/)[0].slice(0, 120)

  const existing = await findOpenLead(db, artist.id, { email, phone })
  const displayName = name || (handle ? `@${handle}` : null)

  let matchId: string
  let appended = false
  if (existing) {
    matchId = existing.id
    appended = true
    if (!existing.client_phone && phone) await db.from('matches').update({ client_phone: phone }).eq('id', matchId)
    if (!existing.client_email && email) await db.from('matches').update({ client_email: email }).eq('id', matchId)
  } else {
    const opened = await openLead(db, artist, {
      channel,
      name: displayName,
      email,
      phone,
      externalThreadId: handle ? `${channel}:@${handle.toLowerCase()}` : null,
      concept,
      brief: {
        ...(Array.isArray(extracted.styles) && extracted.styles.length ? { styles: extracted.styles.map(str).filter(Boolean) } : {}),
        ...(str(extracted.placement) ? { placement: str(extracted.placement) } : {}),
        ...(str(extracted.size) ? { size: str(extracted.size) } : {}),
        ...(Number(extracted.budget_max_cents) > 0 ? { budget_max_cents: Math.round(Number(extracted.budget_max_cents)) } : {}),
        ...(Number(extracted.budget_min_cents) > 0 ? { budget_min_cents: Math.round(Number(extracted.budget_min_cents)) } : {}),
        has_reference: extracted.has_reference === true,
        ...(Array.isArray(extracted.open_questions) && extracted.open_questions.length ? { open_questions: extracted.open_questions.map(str).filter(Boolean).slice(0, 5) } : {}),
        ...(handle ? { handle: `@${handle}` } : {}),
        ...(subject ? { subject } : {}),
        added_by: 'artist',
      },
    })
    if (!opened) return Response.json({ error: 'Could not save the lead' }, { status: 500 })
    matchId = opened.id
  }

  const msg = await appendClientMessage(db, matchId, {
    body: text,
    channel,
    externalId: null,
    meta: { pasted_by: 'artist', ...(subject ? { subject } : {}), ...(handle ? { handle: `@${handle}` } : {}) },
  })
  if (!msg) return Response.json({ error: 'Could not save the message' }, { status: 500 })

  return Response.json({ ok: true, matchId, appended })
}
