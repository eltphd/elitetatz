import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { ARTIST_CONFIG, LACEY_VOICE_PROFILE } from '@/lib/artists/lacey-rawson'
import { briefFollowUps, referenceLine } from '@/lib/brief'
import { CHANNEL_LABEL, type Channel } from '@/lib/channels'
import { attachmentAsImageBlock, type AttachmentRow } from '@/lib/attachments'
import { suggestQuote, money } from '@/lib/quote'
import { historyLine, type ClientHistory } from '@/lib/client-history'
import { ADD_ON_FACTS } from '@/lib/addons'

// The assistant in Lacey's inbox. It has read everything on the lead: the
// brief, the concierge transcript, every message on the thread by every
// channel, the reference photos, her private notes. It answers her, reads a
// client's intention, drafts a clarifying message in her voice, and reasons
// about a price. It never contacts a client: a draft is text in a box until
// she taps send.

export type AssistantMode = 'ask' | 'intent' | 'clarify' | 'quote' | 'reword'
export const ASSISTANT_MODES: AssistantMode[] = ['ask', 'intent', 'clarify', 'quote', 'reword']
/** The three one-tap reads. 'ask' and 'reword' carry her own words instead. */
export type ReadMode = 'intent' | 'clarify' | 'quote'

// "Say it for me" (Nov 10, 2026). She types or says what she wants to tell
// the client, however it comes out; the assistant hands back the same thing
// worded for that client. It is an aid and says so: her decision, her price
// and her boundaries are never changed, she is asked when her meaning is not
// clear, and nothing is sent unless she taps send on it herself.
//
// The answer has four labelled parts (read by lib/reword.ts). Only MESSAGE is
// for the client; the rest is the assistant talking to her.
export function rewordPrompt(herWords: string, returning: boolean): string {
  return `Lacey has told you, in her own words, what she wants to say to this client. Her words are at the end, after LACEY'S WORDS. Your job is the wording, nothing else.

She is the artist. What she decided stands exactly as she said it: what she will do, what she will not do, her price, her dates. Do not add an offer, a discount, a date, a price or a promise she did not make. Do not turn a no into a maybe. If she will not copy another artist's piece or tattoo art an AI generated, the message says so plainly and kindly; you may add what she does instead only when it is in her standing practice above (she interprets a reference and designs her own version; the design is finished together at the appointment).

Write the message she would send: first person, her register (warm, brief, direct, no emoji, no sales talk), and shaped for THIS client. Read how they write in the thread and what they care about (the meaning of the piece, the money, the nerves of a first tattoo, the date) and meet them there. Where she was blunt, be kind without losing the point. Where she gave a reason, keep it; a reason helps a client accept a no. Open with the thing they most want to know. ${returning ? 'They have been tattooed by her before: no introduction, no pitch.' : ''} Do not mention the assistant, the inbox or any software.

Then talk to Lacey, briefly and as a colleague, not a rule-giver:
- Say what you kept and what you softened or reordered, and why it may land better with this client. One or two sentences.
- If her words could mean two different things, or you had to guess at what she meant, ask her one short question rather than guessing. If you are confident, say so in a word.
- If she is giving a price or saying yes, and has not mentioned them, remind her of her add-ons (see the facts above). If her number sits under her published band for this size, say that in one line; it is her call.

Output exactly these four labelled parts, in this order, and nothing else:
MESSAGE: the message for the client, ready to send as it is.
WHY: your one or two sentences to Lacey.
CHECK: your one question to Lacey, or the word none.
ADDONS: your reminder to Lacey, or the word none.

LACEY'S WORDS:
${herWords}`
}

export const MODE_PROMPT: Record<ReadMode, string> = {
  intent:
    'Read everything on this lead and tell Lacey what this client actually wants: the piece, the feeling behind it, how set they are on the reference, how ready they are to book, and anything that does not add up. Then list, as short bullets, what is still unknown that she needs before quoting. End with one line: whether you would quote now, ask first, or pass, and why. Under 180 words.',
  clarify:
    'Draft the message Lacey would send this client to settle what is still open before she quotes. Write it as Lacey, in her register: warm, brief, direct, no fluff, no emoji, first person. Ask only what matters (at most three things), in the order she would ask. Do not quote a price. Do not mention the assistant or the inbox. Output only the message text, nothing before or after it.',
  quote:
    'Reason about the price for this piece using Lacey\'s bands and the suggested number below. Say whether the suggestion is right, high or low, in plain sentences she can check against the brief, and what would move it. If size or placement is unknown say so first. If the client\'s budget is under the band, say how she could meet it (lines only, smaller, or pass). End with a single line "Suggest: $X" or "Suggest: $X/hr, N sessions". Under 150 words.',
}

// A returning client is not a stranger. The same three buttons, read differently:
// no qualification she already did with them, no pitch, dates over questions.
export const RETURNING_MODE_PROMPT: Record<ReadMode, string> = {
  intent:
    'This client has been tattooed by Lacey before (see CLIENT HISTORY). Do not treat them as a stranger. Tell her what is new in this request against what she already knows: is it an addition to her earlier work, a touch-up, or a new piece; what they want and why; how ready they are. Do not relist the qualifying questions she settles with first-timers unless this piece genuinely leaves one open. End with one line: offer dates now, or ask one thing first, and which thing. Under 150 words.',
  clarify:
    'Draft the message Lacey would send to someone she has tattooed before. No introduction, no studio pitch, no deposit policy unless they asked. Warm and familiar, like picking up a conversation, in her register: brief, direct, no emoji, first person. Confirm the piece in one line, ask at most two things only if they are genuinely open, and offer to get them on the books. Do not quote a price. Do not mention the assistant or the inbox. Output only the message text, nothing before or after it.',
  quote:
    'Reason about the price for this piece using Lacey\'s bands and the suggested number below, knowing this is a returning client. Say whether the suggestion is right, high or low in plain sentences. If this is a touch-up or an addition to her own earlier work, say so: she may price that below the band, her call. End with a single line "Suggest: $X" or "Suggest: $X/hr, N sessions". Under 120 words.',
}

export function modePrompt(mode: ReadMode, returning: boolean): string {
  return returning ? RETURNING_MODE_PROMPT[mode] : MODE_PROMPT[mode]
}

export interface LeadRow {
  id: string
  status: string
  channel: string
  client_brief: string | null
  ai_summary: string | null
  offered_price_cents: number | null
  placement: string | null
  created_at: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  conversation_id: string | null
  proposed_dates: string | null
  appointment_at: string | null
  artist_response: string | null
}

export interface NoteRow { id: string; author: string; kind: string; body: string; created_at: string }
export interface MsgRow { id: string; sender: string; body: string; channel: string | null; created_at: string; meta?: Record<string, unknown> | null }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

export function systemPrompt(): string {
  const v = LACEY_VOICE_PROFILE
  return `You are the studio assistant inside ${ARTIST_CONFIG.name}'s (${ARTIST_CONFIG.handle}) lead inbox. You talk to Lacey only. You never talk to clients; when you write something for a client it is a draft that sits in a box until Lacey taps send, and you say so only if asked.

Facts about her practice (use them, do not invent others):
- Studio: ${ARTIST_CONFIG.studio}, ${ARTIST_CONFIG.address}. Hours: ${ARTIST_CONFIG.availability}.
- Styles: ${ARTIST_CONFIG.specialties.join(', ')}; ${ARTIST_CONFIG.primarySpecialty} is her signature.
- Pricing: $${ARTIST_CONFIG.hourlyRate}/hr, ${money(ARTIST_CONFIG.minimumCents)} one-hour minimum. Published bands: $250–400 under 2", $400–700 for 2–4", $700–1,200 for 4–10", $1,200+ above. Lines only is her cheaper option; color sits higher than lines.
- Deposit: ${ARTIST_CONFIG.depositPolicy}
- Design happens at the appointment; she does not send sketches ahead. She interprets references, she does not copy them, and she likes creative freedom.
- ${ADD_ON_FACTS}

How she talks, for drafts in her voice: ${v.closingStyle} Openers she uses: ${v.openingPhrases.slice(0, 2).map((p) => `"${p}"`).join(' / ')}. Questions she asks before quoting: ${v.qualifyingQuestions.slice(0, 5).join(' ')}

Rules:
- Ground every statement in the lead material below. If something is not there, say it is not there; never guess a client's size, budget or intent and present it as fact.
- Reference photos are attached as images when they exist: read them (subject, style, density, color, what would and would not hold at the stated size) and say what you see.
- Be brief and concrete. Plain sentences. No headers, no bold, no emoji. Short bullets only where you are listing unknowns.
- Lacey decides. Recommend, do not instruct.`
}

export async function buildLeadContext(
  db: SupabaseClient,
  lead: LeadRow,
  opts: { messages: MsgRow[]; notes: NoteRow[]; attachments: AttachmentRow[]; transcript?: Array<{ role: string; content: string }>; history?: ClientHistory },
): Promise<{ text: string; images: Anthropic.ImageBlockParam[] }> {
  let brief: Record<string, unknown> = {}
  try { brief = JSON.parse(lead.client_brief ?? '{}') } catch {}

  const lines: string[] = []
  lines.push(`LEAD ${lead.id.slice(0, 8)} · status ${lead.status} · arrived by ${CHANNEL_LABEL[(lead.channel as Channel)] ?? lead.channel} on ${new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
  lines.push(`Client: ${lead.client_name || 'name not given'}${lead.client_email ? ` · ${lead.client_email}` : ''}${lead.client_phone ? ` · ${lead.client_phone}` : ''}`)
  if (opts.history && opts.history.kind !== 'new') {
    const h = opts.history
    lines.push(`CLIENT HISTORY: ${h.kind === 'returning' ? 'RETURNING CLIENT' : 'HAS WRITTEN BEFORE, NEVER BOOKED'} · ${historyLine(h)}${h.sessions ? ` (${h.sessions} past session${h.sessions === 1 ? '' : 's'} in this inbox)` : ''}${h.onList ? ` · on her reviewed client list${h.listSource ? ` (${h.listSource})` : ''}` : ''}. Treat them accordingly: no pitch, no re-qualifying what she already knows about them.`)
  } else {
    lines.push('CLIENT HISTORY: first-timer (no earlier lead, not on her client list).')
  }
  lines.push('')
  lines.push('BRIEF (as captured; fields may be empty):')
  const fields: Array<[string, unknown]> = [
    ['concept', brief.concept ?? lead.ai_summary],
    ['styles', Array.isArray(brief.styles) ? brief.styles.join(', ') : brief.styles],
    ['placement', lead.placement ?? brief.placement],
    ['size', brief.size],
    ['budget', Number(brief.budget_max_cents) ? `${Number(brief.budget_min_cents) ? money(Number(brief.budget_min_cents)) + '–' : 'up to '}${money(Number(brief.budget_max_cents))}` : ''],
    ['has reference', brief.has_reference === true ? 'yes' : brief.has_reference === false ? 'no' : ''],
    ['creative freedom', brief.creative_freedom === true ? 'yes' : brief.creative_freedom === false ? 'no' : ''],
    ['deposit ready', brief.deposit_ready === true ? 'yes' : ''],
    ['reference is for', referenceLine(brief)],
    ['scale read', str(brief.scale_check) ? `${str(brief.scale_check)} (${brief.scale_confirmed === true ? 'client confirmed' : 'not confirmed'})` : ''],
    ['readiness', Number(brief.readiness_score) ? String(brief.readiness_score) : ''],
    ['subject line', brief.subject],
  ]
  for (const [k, v] of fields) if (str(v)) lines.push(`- ${k}: ${str(v)}`)
  const follow = briefFollowUps(brief)
  if (follow.length) {
    lines.push('Still open per the brief:')
    for (const f of follow) lines.push(`- (${f.kind}) ${f.text}`)
  }
  if (lead.offered_price_cents && lead.status !== 'pending') lines.push(`Quoted so far: ${money(lead.offered_price_cents)}${lead.proposed_dates ? ` · dates offered: ${lead.proposed_dates}` : ''}`)
  if (lead.appointment_at) lines.push(`Appointment: ${lead.appointment_at}`)

  const q = suggestQuote(brief)
  lines.push('')
  lines.push(`SUGGESTED STARTING NUMBER (rule of thumb from her bands, not a decision): ${q.hourly ? `$${ARTIST_CONFIG.hourlyRate}/hr, settle in person` : money(q.cents)}, band ${money(q.lowCents)}–${money(q.highCents)}.`)
  for (const r of q.reasons) lines.push(`- ${r}`)

  if (opts.transcript?.length) {
    lines.push('')
    lines.push('CONCIERGE TRANSCRIPT (the client talking to the booking concierge on the website before the inquiry was sent):')
    for (const m of opts.transcript) {
      if (m.role === 'system') continue
      const content = m.content.replace(/```brief[\s\S]*?```/g, '').replace(/BRIEF_READY/g, '').trim()
      if (content) lines.push(`${m.role === 'user' ? 'Client' : 'Concierge'}: ${content}`)
    }
  }

  lines.push('')
  lines.push('THREAD (every message on this lead, oldest first; "Lacey" is her, "Client" is them):')
  if (!opts.messages.length) lines.push('(no messages yet)')
  for (const m of opts.messages) {
    const who = m.sender === 'artist' ? 'Lacey' : m.sender === 'client' ? 'Client' : 'System'
    const via = m.channel && m.channel !== 'web' ? ` via ${CHANNEL_LABEL[m.channel as Channel] ?? m.channel}` : ''
    const subject = m.meta && typeof m.meta === 'object' && str((m.meta as Record<string, unknown>).subject) ? ` [subject: ${str((m.meta as Record<string, unknown>).subject)}]` : ''
    lines.push(`${who}${via} (${new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })})${subject}: ${m.body}`)
  }

  if (opts.attachments.length) {
    lines.push('')
    lines.push(`REFERENCE FILES (${opts.attachments.length}): ${opts.attachments.map((a) => `${a.filename}${a.mime ? ` (${a.mime})` : ''}`).join(', ')}. Images are attached below in the same order where they could be read.`)
  }

  const artistNotes = opts.notes.filter((n) => n.author === 'artist')
  const assistantNotes = opts.notes.filter((n) => n.author === 'assistant')
  if (artistNotes.length) {
    lines.push('')
    lines.push("LACEY'S PRIVATE NOTES (hers, never shown to the client):")
    for (const n of artistNotes) lines.push(`- ${n.body}`)
  }
  if (assistantNotes.length) {
    lines.push('')
    lines.push('EARLIER ASSISTANT EXCHANGES ON THIS LEAD (most recent last):')
    for (const n of assistantNotes.slice(-8)) lines.push(`[${n.kind}] ${n.body.slice(0, 600)}`)
  }

  const images: Anthropic.ImageBlockParam[] = []
  for (const a of opts.attachments.slice(0, 4)) {
    const block = await attachmentAsImageBlock(db, a)
    if (block) images.push(block)
  }
  return { text: lines.join('\n'), images }
}
