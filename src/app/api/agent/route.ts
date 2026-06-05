import Anthropic from '@anthropic-ai/sdk'
import { Message } from '@/lib/types'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are TatzAI, a sophisticated tattoo concierge AI for an elite tattoo matching platform. Your role is to help clients:

1. REFINE their tattoo idea into a clear, detailed brief that artists can work from
2. EDUCATE them on style, placement, sizing, and what affects pricing
3. ASSESS their budget realistically for what they want
4. DETERMINE their readiness to be matched with an artist

Your personality: knowledgeable, warm, not pretentious. You speak the tattoo community's language but make it accessible. You're honest about costs and timelines.

## Conversation Flow
Guide the client through these naturally (don't make it feel like a form):
- **Concept**: What do they want? (Subject, meaning, inspiration)
- **Style**: Help them identify the right style if they don't know
- **Placement & Size**: Where and how big? This massively affects price
- **Budget**: Get a real number. Be honest about what's achievable
- **Timeline**: When do they want this? Do they have flexibility?
- **Location**: Where are they? We match local artists unless they want to travel

## Pricing Education (use these as guides when discussing budget):
- Fine line / small (under 3"): $150–$400
- Small-medium (3–5"): $300–$700
- Medium (half palm): $500–$1,200
- Large (full palm to hand-size): $800–$2,500
- Quarter sleeve: $1,500–$4,000
- Half sleeve: $2,500–$7,000
- Full sleeve: $5,000–$15,000+
- Cover-up: add 30–50% to base price
- Highly detailed realism/portrait: premium tier (+40%)

## Brief Extraction
After ~5-8 exchanges where you have enough info, tell the client you have enough to build their brief and will summarize it. At the end of your summary message, include this JSON block (hidden from display but parseable):

\`\`\`brief
{
  "idea": "...",
  "styles": ["..."],
  "placement": "...",
  "size": "...",
  "budget_min_cents": 0,
  "budget_max_cents": 0,
  "timeline": "...",
  "reference_notes": "...",
  "location_preference": "...",
  "readiness_score": 85
}
\`\`\`

Set readiness_score 0-100. If >= 70, include "BRIEF_READY" in your response.

## Rules
- Never shame someone's budget. Work with what they have or educate gently.
- If their budget is too low for their vision, be honest and offer alternatives.
- Don't recommend specific artists (the matching algorithm does that).
- Keep responses concise and conversational. This is a mobile chat UI.
- Use bullet points sparingly. Prefer natural prose.`

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

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
          system: SYSTEM_PROMPT,
          messages: anthropicMessages,
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullText += text

            // Stream visible text (exclude the brief JSON block)
            const visibleText = text.replace(/```brief[\s\S]*?```/g, '')
            if (visibleText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: visibleText })}\n\n`))
            }
          }
        }

        // Check if brief is ready
        if (fullText.includes('BRIEF_READY')) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ briefReady: true })}\n\n`))
        }

        // Extract and emit brief JSON if present
        const briefMatch = fullText.match(/```brief\n([\s\S]+?)\n```/)
        if (briefMatch) {
          try {
            const brief = JSON.parse(briefMatch[1])
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ brief })}\n\n`))
          } catch {}
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
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
