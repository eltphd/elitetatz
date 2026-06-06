/**
 * Tests for the match scoring logic extracted from /api/match/route.ts
 * We test the scoring function in isolation by re-implementing its interface.
 */

import { Artist, ClientBrief } from '@/lib/types'
import { MOCK_ARTISTS } from '@/lib/mock-data'

// Mirror of the scoring function from the API route
function scoreArtist(artist: Artist, brief: ClientBrief): number {
  let score = 0

  const styleOverlap = brief.styles.filter((s) =>
    artist.styles.includes(s as Artist['styles'][0])
  ).length
  if (styleOverlap === 0) return 0
  score += styleOverlap * 40

  if (brief.budget_max_cents < artist.min_piece_cents) return 0
  score += 20

  const budgetRatio = brief.budget_max_cents / artist.min_piece_cents
  if (budgetRatio >= 1.3) score += 10
  if (budgetRatio >= 1.8) score += 5

  if (artist.available) score += 15
  score += Math.round((artist.rating - 4.0) * 20)

  const isComplex =
    brief.styles.includes('realism') ||
    brief.styles.includes('portrait') ||
    (brief.size?.toLowerCase().includes('sleeve') ?? false)
  if (isComplex && artist.years_experience >= 8) score += 10

  return score
}

const baseBrief: ClientBrief = {
  idea: 'A serpent wrapped around a dagger',
  styles: ['blackwork'],
  placement: 'forearm',
  size: '4 inches',
  budget_min_cents: 20000,
  budget_max_cents: 50000,
  timeline: 'flexible',
  reference_notes: '',
  location_preference: 'New York',
  readiness_score: 80,
}

describe('scoreArtist', () => {
  it('returns 0 when no style overlap', () => {
    const brief = { ...baseBrief, styles: ['watercolor' as const] }
    const marco = MOCK_ARTISTS.find((a) => a.id === '1')! // blackwork artist
    expect(scoreArtist(marco, brief)).toBe(0)
  })

  it('returns 0 when client budget is below artist minimum', () => {
    const brief = { ...baseBrief, budget_max_cents: 10000 }
    const marco = MOCK_ARTISTS.find((a) => a.id === '1')! // min 30000
    expect(scoreArtist(marco, brief)).toBe(0)
  })

  it('gives higher score for multi-style match', () => {
    const singleStyleBrief = { ...baseBrief, styles: ['blackwork' as const] }
    const multiStyleBrief = { ...baseBrief, styles: ['blackwork' as const, 'geometric' as const] }
    const marco = MOCK_ARTISTS.find((a) => a.id === '1')! // blackwork + geometric

    const singleScore = scoreArtist(marco, singleStyleBrief)
    const multiScore = scoreArtist(marco, multiStyleBrief)
    expect(multiScore).toBeGreaterThan(singleScore)
  })

  it('gives bonus when budget is well above minimum', () => {
    const tightBrief = { ...baseBrief, budget_max_cents: 30000 } // exactly min
    const comfyBrief = { ...baseBrief, budget_max_cents: 60000 } // 2x min
    const marco = MOCK_ARTISTS.find((a) => a.id === '1')!

    expect(scoreArtist(marco, comfyBrief)).toBeGreaterThan(scoreArtist(marco, tightBrief))
  })

  it('gives experience bonus for complex realism pieces', () => {
    const realismBrief = { ...baseBrief, styles: ['realism' as const], budget_max_cents: 50000 }
    const darius = MOCK_ARTISTS.find((a) => a.id === '4')! // realism, 9 yrs

    const score = scoreArtist(darius, realismBrief)
    // Should get style match + budget + availability + rating + experience bonus
    expect(score).toBeGreaterThan(60)
  })

  it('penalises unavailable artists (lower score, not 0)', () => {
    const kai = MOCK_ARTISTS.find((a) => a.id === '2')! // unavailable
    const brief = { ...baseBrief, styles: ['japanese' as const], budget_max_cents: 100000 }

    const scoreUnavailable = scoreArtist(kai, brief)

    const kaiAvailable = { ...kai, available: true }
    const scoreAvailable = scoreArtist(kaiAvailable, brief)

    expect(scoreAvailable).toBeGreaterThan(scoreUnavailable)
    expect(scoreUnavailable).toBeGreaterThan(0) // still matchable
  })
})
