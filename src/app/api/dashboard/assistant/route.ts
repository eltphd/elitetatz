import Anthropic from '@anthropic-ai/sdk'
import { artistContext } from '@/lib/artist-session'
import { ASSISTANT_MODES, modePrompt, buildLeadContext, systemPrompt, type AssistantMode, type LeadRow, type MsgRow, type NoteRow } from '@/lib/assistant'
import { clientHistory } from '@/lib/client-history'
import type { AttachmentRow } from '@/lib/attachments'

// Lacey asks the assistant about a lead. Streams the answer as SSE
// (`data: {text}` chunks, then `data: {done, noteId}`) and saves the exchange
// on the lead as assistant notes so the next question has the last one.
// Nothing here reaches a client.
//
// Body: { matchId, mode: 'ask' | 'intent' | 'clarify' | 'quote', question? }

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const client = new Anthropic()

function models(): string[] {
  const primary = process.env.ASSISTANT_MODEL?.trim() || 'claude-opus-5-5'
  return primary === 'claude-sonnet-4-6' ? [primary] : [primary, 'claude-sonnet-4-6']
}

export async function POST(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'The assistant is not configured (ANTHROPIC_API_KEY)' }, { status: 503 })

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const matchId = str(payload.matchId)
  const mode = str(payload.mode) as AssistantMode
  const question = str(payload.question).slice(0, 2000)
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })
  if (!ASSISTANT_MODES.includes(mode)) return Response.json({ error: 'Unknown mode' }, { status: 400 })
  if (mode === 'ask' && !question) return Response.json({ error: 'Ask something' }, { status: 400 })

  const { data: lead } = await db
    .from('matches')
    .select('id, status, channel, client_brief, ai_summary, offered_price_cents, placement, created_at, client_name, client_email, client_phone, conversation_id, proposed_dates, appointment_at, artist_response')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()
  if (!lead) return Response.json({ error: 'Match not found' }, { status: 404 })

  const [{ data: messages }, { data: notes }, { data: attachments }, historyMap] = await Promise.all([
    db.from('match_messages').select('id, sender, body, channel, created_at, meta').eq('match_id', matchId).order('created_at', { ascending: true }),
    db.from('lead_notes').select('id, author, kind, body, created_at').eq('match_id', matchId).order('created_at', { ascending: true }),
    db.from('lead_attachments').select('id, match_id, message_id, storage_path, filename, mime, size_bytes, source, created_at').eq('match_id', matchId).order('created_at', { ascending: true }),
    clientHistory(db, artist.id, [lead as LeadRow]),
  ])
  const history = historyMap.get(matchId)
  let transcript: Array<{ role: string; content: string }> | undefined
  if ((lead as LeadRow).conversation_id) {
    const { data: conv } = await db.from('conversations').select('messages').eq('id', (lead as LeadRow).conversation_id).single()
    if (Array.isArray(conv?.messages)) transcript = conv.messages as Array<{ role: string; content: string }>
  }

  const context = await buildLeadContext(db, lead as LeadRow, {
    messages: (messages ?? []) as MsgRow[],
    notes: (notes ?? []) as NoteRow[],
    attachments: (attachments ?? []) as AttachmentRow[],
    transcript,
    history,
  })

  const ask = mode === 'ask' ? question : modePrompt(mode, history?.kind === 'returning')
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: `${context.text}\n\n---\nLACEY ASKS:\n${ask}` },
    ...context.images,
  ]

  // The question is saved first so a dropped stream still leaves a trace.
  const kindOut = mode === 'clarify' ? 'draft' : 'answer'
  await db.from('lead_notes').insert({ match_id: matchId, author: 'assistant', kind: 'question', body: mode === 'ask' ? question : `[${mode}]` })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      let full = ''
      let lastErr: unknown = null
      for (const model of models()) {
        try {
          const response = await client.messages.create({
            model,
            max_tokens: 1200,
            system: systemPrompt(),
            messages: [{ role: 'user', content }],
            stream: true,
          })
          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              full += event.delta.text
              send({ text: event.delta.text })
            }
          }
          lastErr = null
          break
        } catch (err) {
          lastErr = err
          // A model this key cannot use: try the next one. Anything else stops.
          if (err instanceof Anthropic.NotFoundError || err instanceof Anthropic.BadRequestError) { full = ''; continue }
          break
        }
      }
      if (lastErr) {
        console.error('assistant:', lastErr)
        send({ error: 'The assistant could not answer just now. Try again in a moment.' })
        controller.close()
        return
      }
      const text = full.trim()
      let noteId: string | null = null
      if (text) {
        const { data } = await db.from('lead_notes').insert({ match_id: matchId, author: 'assistant', kind: kindOut, body: text }).select('id').single()
        noteId = data?.id ?? null
      }
      send({ done: true, noteId, kind: kindOut })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  })
}
