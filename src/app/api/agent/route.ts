import Anthropic from '@anthropic-ai/sdk'
import { linksConfigured, signBrief } from '@/lib/tokens'
import { Message } from '@/lib/types'
import { buildLaceySystemPrompt } from '@/lib/artists/lacey-rawson'
import { checkAbuse } from '@/lib/rate-limit'

const client = new Anthropic()

export async function POST(req: Request) {
  // The one endpoint that spends model tokens: per-IP window + daily circuit breaker.
  const limited = checkAbuse('agent', req, { max: 60, windowMs: 10 * 60_000, maxPerDay: 3000 })
  if (limited) return limited

  const { messages }: { messages: Message[] } = await req.json()

  // Every chat is Lacey's: the multi-artist concierge and its mock roster are gone.
  const systemPrompt = buildLaceySystemPrompt()

  const anthropicMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = ''

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages,
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullText += text

            // Don't stream the hidden brief JSON block
            const visibleText = text.replace(/```brief[\s\S]*?```/g, '')
            if (visibleText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: visibleText })}\n\n`))
            }
          }
        }

        // The brief goes out before briefReady so the client already holds it
        // when it saves. It carries a signature over its exact contents, which
        // /api/brief requires: only a brief this stream produced can open an
        // inquiry and send email or SMS.
        const briefMatch = fullText.match(/```brief\n([\s\S]+?)\n```/)
        if (briefMatch) {
          try {
            const brief = JSON.parse(briefMatch[1])
            const briefToken = linksConfigured() ? signBrief(brief) : null
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ brief, briefToken })}\n\n`))
          } catch {}
        }

        if (fullText.includes('BRIEF_READY')) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ briefReady: true })}\n\n`))
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Agent error' })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
