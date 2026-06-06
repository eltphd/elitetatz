import {
  formatArtistContext,
  formatArtistRosterContext,
  formatRelevantArtists,
} from '@/lib/artist-context'
import { MOCK_ARTISTS } from '@/lib/mock-data'

describe('formatArtistContext', () => {
  const artist = MOCK_ARTISTS[0] // Marco Vega

  it('includes artist name', () => {
    expect(formatArtistContext(artist)).toContain('Marco Vega')
  })

  it('includes location', () => {
    const ctx = formatArtistContext(artist)
    expect(ctx).toContain('New York')
    expect(ctx).toContain('NY')
  })

  it('includes pricing in dollars', () => {
    const ctx = formatArtistContext(artist)
    expect(ctx).toContain('$250/hr')  // 25000 cents
    expect(ctx).toContain('$300')     // 30000 cents min
  })

  it('includes styles', () => {
    const ctx = formatArtistContext(artist)
    expect(ctx).toContain('blackwork')
    expect(ctx).toContain('geometric')
  })

  it('includes availability status', () => {
    const ctx = formatArtistContext(artist)
    expect(ctx).toContain('currently taking new clients')
  })

  it('handles waitlist artists', () => {
    const waitlisted = { ...MOCK_ARTISTS[1], available: false }
    expect(formatArtistContext(waitlisted)).toContain('waitlist only')
  })
})

describe('formatArtistRosterContext', () => {
  it('includes artist count', () => {
    const ctx = formatArtistRosterContext(MOCK_ARTISTS)
    expect(ctx).toContain(`${MOCK_ARTISTS.length} verified artists`)
  })

  it('lists all cities', () => {
    const ctx = formatArtistRosterContext(MOCK_ARTISTS)
    expect(ctx).toContain('New York')
    expect(ctx).toContain('Los Angeles')
    expect(ctx).toContain('Miami')
  })

  it('shows available count', () => {
    const availableCount = MOCK_ARTISTS.filter((a) => a.available).length
    const ctx = formatArtistRosterContext(MOCK_ARTISTS)
    expect(ctx).toContain(`${availableCount} of ${MOCK_ARTISTS.length}`)
  })

  it('groups styles correctly', () => {
    const ctx = formatArtistRosterContext(MOCK_ARTISTS)
    expect(ctx).toContain('blackwork')
    expect(ctx).toContain('japanese')
  })
})

describe('formatRelevantArtists', () => {
  it('filters by style', () => {
    const ctx = formatRelevantArtists(MOCK_ARTISTS, { styles: ['japanese'] })
    expect(ctx).toContain('Kai Nakamura')
    expect(ctx).not.toContain('Marco Vega')
  })

  it('filters by city', () => {
    const ctx = formatRelevantArtists(MOCK_ARTISTS, { city: 'Miami' })
    expect(ctx).toContain('Sofia Reyes')
    expect(ctx).not.toContain('Marco Vega')
  })

  it('filters by max budget', () => {
    // Only artists with min_piece_cents <= 25000
    const ctx = formatRelevantArtists(MOCK_ARTISTS, { maxBudgetCents: 25000 })
    expect(ctx).toContain('Sofia Reyes')  // min 25000
    expect(ctx).not.toContain('Kai Nakamura') // min 50000
  })

  it('returns fallback message when no artists match', () => {
    const ctx = formatRelevantArtists(MOCK_ARTISTS, {
      styles: ['tribal'],
      city: 'Denver',
    })
    expect(ctx).toContain('No artists currently match')
  })

  it('returns all artists when no filters applied', () => {
    const ctx = formatRelevantArtists(MOCK_ARTISTS, {})
    expect(ctx).toContain('Marco Vega')
    expect(ctx).toContain('Kai Nakamura')
  })

  it('sorts by rating descending', () => {
    const ctx = formatRelevantArtists(MOCK_ARTISTS, {})
    const kaiIdx = ctx.indexOf('Kai Nakamura') // rating 5.0
    const priyaIdx = ctx.indexOf('Priya Sharma') // rating 4.7
    expect(kaiIdx).toBeLessThan(priyaIdx)
  })
})
