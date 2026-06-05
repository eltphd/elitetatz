import { Artist, ArtistStyle } from './types'

/**
 * Formats a single artist's full profile into a compact LLM-readable block.
 * Used per-artist in the match engine for pricing/pitch generation.
 */
export function formatArtistContext(artist: Artist): string {
  const rate = `$${artist.hourly_rate_cents / 100}/hr`
  const min = `$${artist.min_piece_cents / 100} minimum`
  const location = `${artist.location_city}, ${artist.location_state}`
  const styles = artist.styles.map((s) => s.replace(/-/g, ' ')).join(', ')
  const availability = artist.available ? 'currently taking new clients' : 'waitlist only'
  const instagram = artist.instagram_handle ? `@${artist.instagram_handle}` : 'no public handle'

  return `
ARTIST: ${artist.name}
Location: ${location}
Styles: ${styles}
Pricing: ${rate}, ${min}
Experience: ${artist.years_experience} years
Rating: ${artist.rating}/5.0 (${artist.review_count} reviews)
Availability: ${availability}
Instagram: ${instagram}
Bio: ${artist.bio}
`.trim()
}

/**
 * Formats the full artist roster into a condensed summary for the agent's
 * system prompt. Gives the LLM enough to answer budget/style questions
 * without overwhelming the context window.
 */
export function formatArtistRosterContext(artists: Artist[]): string {
  const byStyle: Partial<Record<ArtistStyle, string[]>> = {}

  for (const artist of artists) {
    for (const style of artist.styles) {
      if (!byStyle[style]) byStyle[style] = []
      byStyle[style]!.push(artist.name)
    }
  }

  const styleMap = Object.entries(byStyle)
    .map(([style, names]) => `  ${style}: ${names.join(', ')}`)
    .join('\n')

  const artistLines = artists.map((a) => {
    const loc = `${a.location_city}, ${a.location_state}`
    const price = `$${a.min_piece_cents / 100}+ min`
    const avail = a.available ? '✓' : 'waitlist'
    const styles = a.styles.slice(0, 3).join('/')
    return `  • ${a.name} (${loc}) — ${styles} — ${price} — ${avail} — ${a.rating}★`
  })

  const cities = [...new Set(artists.map((a) => a.location_city))].join(', ')
  const minPrice = Math.min(...artists.map((a) => a.min_piece_cents)) / 100
  const maxPrice = Math.max(...artists.map((a) => a.min_piece_cents)) / 100

  return `
## Platform Artist Roster (${artists.length} verified artists)

Cities covered: ${cities}
Price range: $${minPrice}–$${maxPrice}+ minimum pieces
Available now: ${artists.filter((a) => a.available).length} of ${artists.length}

Artists:
${artistLines.join('\n')}

Styles available on platform:
${styleMap}
`.trim()
}

/**
 * Formats artists filtered/ranked for a specific client context.
 * Used mid-conversation when the client has revealed location or style preference.
 */
export function formatRelevantArtists(
  artists: Artist[],
  opts: {
    styles?: ArtistStyle[]
    city?: string
    maxBudgetCents?: number
  }
): string {
  let relevant = [...artists]

  if (opts.styles?.length) {
    relevant = relevant.filter((a) =>
      a.styles.some((s) => opts.styles!.includes(s))
    )
  }

  if (opts.city) {
    const cityLower = opts.city.toLowerCase()
    relevant = relevant.filter(
      (a) =>
        a.location_city.toLowerCase().includes(cityLower) ||
        a.location_state.toLowerCase().includes(cityLower)
    )
  }

  if (opts.maxBudgetCents) {
    relevant = relevant.filter((a) => a.min_piece_cents <= opts.maxBudgetCents!)
  }

  if (relevant.length === 0) return '(No artists currently match these exact filters — expand location or budget.)'

  return relevant
    .sort((a, b) => b.rating - a.rating)
    .map((a) => formatArtistContext(a))
    .join('\n\n---\n\n')
}
