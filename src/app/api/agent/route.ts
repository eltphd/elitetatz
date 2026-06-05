import Anthropic from '@anthropic-ai/sdk'
import { Message, ArtistStyle } from '@/lib/types'
import { MOCK_ARTISTS } from '@/lib/mock-data'
import { formatArtistRosterContext, formatRelevantArtists } from '@/lib/artist-context'

const client = new Anthropic()

function buildSystemPrompt(conversationHints: ConversationHints): string {
  // Build artist context tuned to what we know about the client so far
  const relevantArtistContext =
    conversationHints.styles?.length || conversationHints.city
      ? formatRelevantArtists(MOCK_ARTISTS, {
          styles: conversationHints.styles,
          city: conversationHints.city,
          maxBudgetCents: conversationHints.maxBudgetCents,
        })
      : formatArtistRosterContext(MOCK_ARTISTS)

  return `You are TatzAI, a sophisticated tattoo concierge AI for an elite tattoo matching platform. Your role is to help clients:

1. REFINE their tattoo idea into a clear, detailed brief that artists can work from
2. EDUCATE them on style, placement, sizing, and what affects pricing
3. ASSESS their budget realistically for what they want
4. DETERMINE their readiness to be matched with an artist

Your personality: knowledgeable, warm, not pretentious. You speak the tattoo community's language but make it accessible. You're honest about costs and timelines.

---

${relevantArtistContext}

---

## Using Artist Context
You know the artists on this platform — their styles, pricing floors, locations, and reputations. Use this to:
- Give accurate budget guidance ("for a half sleeve in blackwork, you're looking at $2,500–$5,000 — we have artists in NYC starting at $250/hr who specialize in that")
- Set realistic expectations ("fine line portraits start around $300 minimum on our platform")
- Gently steer style choices toward what's available ("we have strong Japanese traditional artists in LA and NYC — are you open to either?")
- Never name a specific artist as "the one" — the matching algorithm does that after brief submission. You can say "we have several artists who do this well."

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
- Don't commit to specific artists — the matching engine handles that.
- Keep responses concise and conversational. This is a mobile chat UI.
- Use bullet points sparingly. Prefer natural prose.`
}

// Extract hints from conversation history to tune artist context
interface ConversationHints {
  styles?: ArtistStyle[]
  city?: string
  maxBudgetCents?: number
}

function extractConversationHints(messages: Message[]): ConversationHints {
  const allText = messages.map((m) => m.content.toLowerCase()).join(' ')

  const STYLE_KEYWORDS: Record<ArtistStyle, string[]> = {
    blackwork: ['blackwork', 'black work', 'dark', 'solid black'],
    geometric: ['geometric', 'geometry', 'mandala', 'sacred geometry'],
    realism: ['realism', 'realistic', 'photorealistic', 'lifelike'],
    japanese: ['japanese', 'irezumi', 'koi', 'dragon', 'samurai', 'oni'],
    'fine-line': ['fine line', 'fineline', 'delicate', 'thin lines', 'minimal'],
    portrait: ['portrait', 'face', 'person', 'pet', 'dog', 'cat'],
    watercolor: ['watercolor', 'water color', 'colorful', 'vibrant', 'splash'],
    'neo-traditional': ['neo trad', 'neo-traditional', 'neo traditional'],
    traditional: ['traditional', 'old school', 'sailor jerry', 'americana'],
    tribal: ['tribal', 'polynesian', 'maori', 'samoan'],
    illustrative: ['illustrative', 'illustration', 'cartoon', 'animated'],
    'cover-up': ['cover up', 'cover-up', 'coverup', 'hide old tattoo'],
  }

  const detectedStyles: ArtistStyle[] = []
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some((kw) => allText.includes(kw))) {
      detectedStyles.push(style as ArtistStyle)
    }
  }

  const CITY_PATTERNS = [
    { pattern: /new york|nyc|brooklyn|manhattan/, city: 'New York' },
    { pattern: /los angeles|la\b|hollywood|venice|dtla/, city: 'Los Angeles' },
    { pattern: /miami|south beach|brickell/, city: 'Miami' },
    { pattern: /chicago|chi-town|wicker park/, city: 'Chicago' },
    { pattern: /atlanta|atl\b/, city: 'Atlanta' },
    { pattern: /houston|htx/, city: 'Houston' },
  ]

  let city: string | undefined
  for (const { pattern, city: c } of CITY_PATTERNS) {
    if (pattern.test(allText)) { city = c; break }
  }

  // Rough budget detection: look for dollar amounts
  const budgetMatch = allText.match(/\$(\d[\d,]*)\s*(?:to|-)\s*\$?(\d[\d,]*)|budget.*?\$(\d[\d,]+)|(\d[\d,]+)\s*dollars?/)
  let maxBudgetCents: number | undefined
  if (budgetMatch) {
    const raw = budgetMatch[2] || budgetMatch[3] || budgetMatch[4]
    if (raw) maxBudgetCents = parseInt(raw.replace(/,/g, '')) * 100
  }

  return { styles: detectedStyles.length ? detectedStyles : undefined, city, maxBudgetCents }
}

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

  const hints = extractConversationHints(messages)
  const systemPrompt = buildSystemPrompt(hints)

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

        if (fullText.includes('BRIEF_READY')) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ briefReady: true })}\n\n`))
        }

        const briefMatch = fullText.match(/```brief\n([\s\S]+?)\n```/)
        if (briefMatch) {
          try {
            const brief = JSON.parse(briefMatch[1])
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ brief })}\n\n`))
          } catch {}
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
