import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ClientBrief, Artist } from '@/lib/types'
import { MOCK_ARTISTS } from '@/lib/mock-data'
import { formatArtistContext } from '@/lib/artist-context'

const client = new Anthropic()

export async function POST(req: Request) {
  const { brief }: { brief: ClientBrief } = await req.json()

  // Score and rank artists against the brief
  const scored = MOCK_ARTISTS.map((artist) => ({
    artist,
    score: scoreArtist(artist, brief),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  // For each top match, use Claude with full artist context to generate
  // a realistic price offer and a personalized pitch summary for the client
  const matches = await Promise.all(
    scored.map(async ({ artist, score }) => {
      const artistContext = formatArtistContext(artist)

      const prompt = `You are a pricing expert for a tattoo booking platform.

## Artist Profile
${artistContext}

## Client Brief
- Idea: ${brief.idea}
- Styles requested: ${brief.styles.join(', ')}
- Placement: ${brief.placement}
- Size: ${brief.size}
- Budget range: $${brief.budget_min_cents / 100}–$${brief.budget_max_cents / 100}
- Timeline: ${brief.timeline}
- Notes: ${brief.reference_notes}

## Your Task
Based on this artist's actual rates, style expertise, and the client's brief:

1. Suggest a fair offer price in cents (what TatzAI should offer the artist on the client's behalf)
2. Write a 1-sentence pitch to show the client WHY this artist is a good match
3. Flag any potential friction (e.g. artist doesn't typically do cover-ups, client budget is at the floor, etc.)

Respond ONLY with valid JSON:
{
  "offered_price_cents": <number>,
  "match_pitch": "<1 sentence for the client explaining why this artist fits>",
  "price_rationale": "<1 sentence on how the price was determined>",
  "friction_flag": "<null or brief note about any mismatch>"
}`

      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const defaults = {
        offered_price_cents: brief.budget_max_cents,
        match_pitch: `${artist.name} specializes in ${artist.styles[0]} and is based in ${artist.location_city}.`,
        price_rationale: 'Based on artist hourly rate and estimated session time.',
        friction_flag: null,
      }

      try {
        const parsed = JSON.parse((res.content[0] as { text: string }).text)
        return {
          artist_id: artist.id,
          artist,
          match_score: score,
          ...defaults,
          ...parsed,
        }
      } catch {
        return { artist_id: artist.id, artist, match_score: score, ...defaults }
      }
    })
  )

  return NextResponse.json({ matches })
}

function scoreArtist(artist: Artist, brief: ClientBrief): number {
  let score = 0

  // Style match (highest weight — this is the core compatibility signal)
  const styleOverlap = brief.styles.filter((s) =>
    artist.styles.includes(s as Artist['styles'][0])
  ).length
  if (styleOverlap === 0) return 0 // Hard filter: no style match = no match
  score += styleOverlap * 40

  // Budget viability
  if (brief.budget_max_cents < artist.min_piece_cents) return 0 // Client can't afford
  score += 20
  // Sweet spot: client budget is 1.3–2x the minimum (artist won't lowball the job)
  const budgetRatio = brief.budget_max_cents / artist.min_piece_cents
  if (budgetRatio >= 1.3) score += 10
  if (budgetRatio >= 1.8) score += 5

  // Availability
  if (artist.available) score += 15

  // Rating (0–10 bonus)
  score += Math.round((artist.rating - 4.0) * 20)

  // Experience bonus for complex pieces
  const isComplex =
    brief.styles.includes('realism') ||
    brief.styles.includes('portrait') ||
    brief.size?.toLowerCase().includes('sleeve')
  if (isComplex && artist.years_experience >= 8) score += 10

  return score
}
