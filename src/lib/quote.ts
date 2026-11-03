import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// A starting number for Lacey, not a price for the client. Read from the
// brief the way she reads it herself: size first, then whether it is color or
// lines, then how much is in it. Every reason is a plain sentence she can
// check against the brief, and the number lands in her Accept box already
// typed so she edits instead of starting from zero.

export interface QuoteSuggestion {
  cents: number
  lowCents: number
  highCents: number
  /** Big enough that she quotes by the hour and settles the total in person. */
  hourly: boolean
  reasons: string[]
  /** The client's stated maximum is under the low end of the band. */
  belowBudget: boolean
  /** Size could not be read from the brief; the number is the one-hour minimum. */
  sizeUnknown: boolean
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : [])

// Her published bands (rawsunart.com/tattoos): $250–400, $400–700, $700–1,200, $1,200+.
const BANDS = [
  { maxIn: 2, low: 25000, high: 40000, start: 25000, label: 'under 2 inches' },
  { maxIn: 4, low: 25000, high: 40000, start: 32500, label: '2 to 4 inches' },
  { maxIn: 6, low: 40000, high: 70000, start: 50000, label: '4 to 6 inches' },
  { maxIn: 10, low: 70000, high: 120000, start: 85000, label: '6 to 10 inches' },
  { maxIn: Infinity, low: 120000, high: 250000, start: 120000, label: 'over 10 inches' },
] as const

// "3 inches", '3"', "3in", "3-4 in", "about 5 inch" → the largest inch figure
// named. Words are read when there is no number.
export function readInches(size: string, placement = '', concept = ''): number | null {
  const s = size.toLowerCase()
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to|–)?\s*(\d+(?:\.\d+)?)?\s*(?:"|''|in\b|inch|inches)/g)]
    .flatMap((m) => [Number(m[1]), m[2] ? Number(m[2]) : NaN])
    .filter((n) => Number.isFinite(n) && n > 0 && n < 60)
  if (nums.length) return Math.max(...nums)
  const bare = s.match(/^\s*(\d+(?:\.\d+)?)\s*$/)
  if (bare) return Number(bare[1])

  const all = `${s} ${placement.toLowerCase()} ${concept.toLowerCase()}`
  if (/full\s*sleeve|back\s*piece|full\s*back|whole\s*thigh|leg\s*sleeve/.test(all)) return 14
  if (/half\s*sleeve|quarter\s*sleeve|thigh|rib|sternum|chest|shoulder\s*cap|calf/.test(all) && !/small|tiny/.test(s)) return 9
  if (/forearm|upper\s*arm|bicep|shin|hip|side/.test(all) && /large|big|cover/.test(s)) return 8
  if (/medium|hand[-\s]?sized|hand|palm|4\s*x|fist/.test(s)) return 4.5
  if (/large|big|statement/.test(s)) return 8
  if (/tiny|micro|mini|dime|coin|quarter|small|dainty|delicate|finger|behind\s*the\s*ear|ankle|wrist/.test(all)) return 2
  return null
}

const roundTo25 = (cents: number) => Math.round(cents / 2500) * 2500
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export function suggestQuote(brief: Record<string, unknown>): QuoteSuggestion {
  const size = str(brief.size)
  const placement = str(brief.placement)
  const concept = str(brief.concept)
  const styles = list(brief.styles).map((x) => x.toLowerCase()).join(' ')
  const text = `${concept} ${styles} ${str(brief.reference_notes)}`.toLowerCase()

  const inches = readInches(size, placement, concept)
  const reasons: string[] = []

  if (inches == null) {
    const budgetMax = Number(brief.budget_max_cents) || 0
    reasons.push(`Size isn't in the brief. ${money(ARTIST_CONFIG.minimumCents)} is the one-hour minimum; ask for size before you quote.`)
    return {
      cents: ARTIST_CONFIG.minimumCents,
      lowCents: ARTIST_CONFIG.minimumCents,
      highCents: 40000,
      hourly: false,
      reasons,
      belowBudget: budgetMax > 0 && budgetMax < ARTIST_CONFIG.minimumCents,
      sizeUnknown: true,
    }
  }

  const band = BANDS.find((b) => inches <= b.maxIn) ?? BANDS[BANDS.length - 1]
  let cents: number = band.start
  reasons.push(`About ${inches % 1 === 0 ? inches : inches.toFixed(1)} inches${placement ? ` on the ${placement}` : ''}: your ${money(band.low)}–${money(band.high)} band (${band.label}).`)

  const color = /watercolor|water color|colou?r|vibrant|splash/.test(text) && !/black\s*(and|&)\s*gr[ea]y|lines?\s*only/.test(text)
  const linesOnly = /lines?\s*only|line\s*work\s*only|outline|minimal|fine\s*line|single\s*needle/.test(text) && !color
  if (color) { cents += (band.high - band.low) * 0.15; reasons.push('Color or watercolor: nudged up inside the band, the way you price it over lines.') }
  if (linesOnly) { cents -= (band.high - band.low) * 0.15; reasons.push('Lines only or fine line: nudged down, your cheaper option.') }

  const subjects = concept.split(/\s+(?:and|with|plus|\+)\s+|,\s*/).filter((x) => x.trim().length > 2).length
  if (subjects >= 3) { cents += (band.high - band.low) * 0.2; reasons.push(`Several elements (${subjects}) in one piece: more drawing time.`) }
  else if (subjects === 2) { cents += (band.high - band.low) * 0.1; reasons.push('Two elements in one piece.') }

  if (/cover[-\s]?up|cover\s*an?\s*old|rework|fix\s*an?\s*old/.test(text)) reasons.push('Cover-up or rework: see the old piece before you commit to a number.')
  if (/portrait|photo[-\s]?real|realism/.test(text)) reasons.push('Realism or portrait: quote the hour and tell the client the total is settled in person.')

  const hourly = inches > 10
  if (hourly) reasons.push(`Over 10 inches: quote ${money(ARTIST_CONFIG.hourlyRate * 100)}/hr and an estimated session count; settle the total in person.`)

  cents = roundTo25(clamp(cents, band.low, band.high))

  const budgetMax = Number(brief.budget_max_cents) || 0
  const belowBudget = budgetMax > 0 && budgetMax < band.low
  if (belowBudget) reasons.push(`Their budget tops out at ${money(budgetMax)}, under this band. Say so plainly, or offer lines only or a smaller size.`)
  else if (budgetMax > 0 && budgetMax < cents) reasons.push(`Their budget (${money(budgetMax)}) sits below the suggested number but inside the band.`)

  return { cents, lowCents: band.low, highCents: band.high, hourly, reasons, belowBudget, sizeUnknown: false }
}
