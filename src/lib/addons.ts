// Extras an artist offers on top of the tattoo and tends to forget to mention
// when quoting (Erica, Nov 10, 2026): drafts before the session, and an
// original of the piece handed over at the appointment, drawn digitally or
// painted on watercolor paper, whichever the artist picks. The artist sets
// every price; nothing here assumes one.

export type OriginalArt = 'digital' | 'paper'

export const ORIGINAL_ART_LABEL: Record<OriginalArt, string> = {
  digital: 'Digital original (Procreate)',
  paper: 'Original on watercolor paper',
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export function isOriginalArt(v: unknown): v is OriginalArt {
  return v === 'digital' || v === 'paper'
}

/** One line for the thread and the client's email, or null when she did not add it. */
export function originalArtLine(kind: unknown, cents: number | null): string | null {
  if (!isOriginalArt(kind)) return null
  const what = kind === 'digital' ? 'A digital original of your piece, drawn in Procreate' : 'An original of your piece, painted on watercolor paper'
  const price = cents != null && Number.isFinite(cents) && cents > 0 ? `: ${money(cents)}` : ''
  return `${what}, yours to keep at the appointment${price} (separate from the deposit).`
}

/** For the assistant: what she offers, so it can remind her without inventing a price. */
export const ADD_ON_FACTS =
  'Add-ons she offers and tends to forget to mention when she quotes: design drafts before the session (a separate fee she sets); an original of the piece handed over at the appointment, either drawn digitally in Procreate or painted on watercolor paper, her choice (she sets the price). Never state a price for an add-on unless she gave one.'
