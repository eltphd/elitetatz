import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ClientBrief, Artist } from '@/lib/types'
import { MOCK_ARTISTS } from '@/lib/mock-data'

const client = new Anthropic()

export async function POST(req: Request) {
  const { brief }: { brief: ClientBrief } = await req.json()

  // Score each artist against the brief
  const scored = MOCK_ARTISTS.map((artist) => ({
    artist,
    score: scoreArtist(artist, brief),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  // Use Claude to generate a personalized pitch price for each match
  const matches = await Promise.all(
    scored.map(async ({ artist, score }) => {
      const priceRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Given this tattoo brief and artist pricing, suggest a fair offer price in cents.

Brief: ${JSON.stringify(brief)}
Artist min piece: $${artist.min_piece_cents / 100}
Artist hourly: $${artist.hourly_rate_cents / 100}/hr

Respond ONLY with a JSON object: {"offered_price_cents": number, "rationale": "one sentence"}`,
          },
        ],
      })

      let offered_price_cents = brief.budget_max_cents
      let rationale = 'Market rate for this piece type'

      try {
        const parsed = JSON.parse((priceRes.content[0] as { text: string }).text)
        offered_price_cents = parsed.offered_price_cents
        rationale = parsed.rationale
      } catch {}

      return {
        artist_id: artist.id,
        artist,
        match_score: score,
        offered_price_cents,
        price_rationale: rationale,
      }
    })
  )

  return NextResponse.json({ matches })
}

function scoreArtist(artist: Artist, brief: ClientBrief): number {
  let score = 0

  // Style match (highest weight)
  const styleOverlap = brief.styles.filter((s) => artist.styles.includes(s as Artist['styles'][0])).length
  score += styleOverlap * 40

  // Budget match
  if (brief.budget_max_cents >= artist.min_piece_cents) {
    score += 20
    // Bonus if well within budget
    if (brief.budget_max_cents >= artist.min_piece_cents * 1.5) score += 10
  } else {
    return 0 // Can't afford this artist
  }

  // Availability
  if (artist.available) score += 15

  // Rating bonus
  score += (artist.rating - 4) * 10

  return score
}
