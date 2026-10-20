import type { ConciergeBrief, ReferenceKeeper } from '@/lib/types'

// The brief the concierge writes is JSON the model produced, so every field
// is read defensively here, once, and the inbox, the client page and the
// artist's email all show the same reading of it.

export type FollowUpKind = 'open' | 'scale' | 'feasibility'

export interface FollowUp {
  kind: FollowUpKind
  text: string
}

const KEEPERS = ['subject', 'style', 'density', 'size', 'color', 'flow'] as const

const str = (v: unknown) => (v == null ? '' : String(v)).trim()
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : [])

// Each reference the client described, with what it is there for. A keeper
// the model invented outside the six words is kept as a note, not dropped.
export function briefReferences(brief: Partial<ConciergeBrief> | Record<string, unknown>): ReferenceKeeper[] {
  const raw = (brief as Record<string, unknown>).reference_keepers
  if (!Array.isArray(raw)) return []
  return raw
    .map((r): ReferenceKeeper | null => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      const forAll = list(o.for).map((k) => k.toLowerCase())
      const known = forAll.filter((k): k is ReferenceKeeper['for'][number] => (KEEPERS as readonly string[]).includes(k))
      const extra = forAll.filter((k) => !(KEEPERS as readonly string[]).includes(k))
      const note = [str(o.note), ...extra].filter(Boolean).join(' · ')
      if (!known.length && !note) return null
      return { for: known, note }
    })
    .filter((r): r is ReferenceKeeper => r !== null)
}

// Everything the artist still has to settle before quoting, in the order she
// should read it: what the client could not answer, whether the scale was
// confirmed, then the tattoo-ability notes.
export function briefFollowUps(brief: Partial<ConciergeBrief> | Record<string, unknown>): FollowUp[] {
  const b = brief as Record<string, unknown>
  const out: FollowUp[] = []
  for (const q of list(b.open_questions)) out.push({ kind: 'open', text: q })

  const scale = str(b.scale_check)
  const hasReference = Boolean(b.has_reference) || briefReferences(brief).length > 0
  if (hasReference && b.scale_confirmed !== true) {
    out.push({
      kind: 'scale',
      text: scale
        ? `Scale not confirmed by the client: "${scale}"`
        : 'Scale not confirmed: check how the reference lands at their size and placement before quoting.',
    })
  }

  for (const f of list(b.feasibility_flags)) out.push({ kind: 'feasibility', text: f })
  return out
}

// The one-line reading of the references for a card or an email.
export function referenceLine(brief: Partial<ConciergeBrief> | Record<string, unknown>): string {
  const refs = briefReferences(brief)
  if (!refs.length) return ''
  return refs
    .map((r, i) => {
      const what = r.for.length ? r.for.join(' + ') : 'unspecified'
      return `Ref ${i + 1}: for ${what}${r.note ? ` (${r.note})` : ''}`
    })
    .join('; ')
}

// Lines for the artist's email, under the brief. Empty when nothing is open.
export function followUpLines(brief: Partial<ConciergeBrief> | Record<string, unknown>): string[] {
  const label: Record<FollowUpKind, string> = { open: 'Ask', scale: 'Scale', feasibility: 'Note' }
  return briefFollowUps(brief).map((f) => `${label[f.kind]}: ${f.text}`)
}

// A draft of the "Need more info" message in the artist's own register, built
// from what the client could not settle. She edits or sends as is.
export function suggestedQuestion(brief: Partial<ConciergeBrief> | Record<string, unknown>): string {
  const open = briefFollowUps(brief).filter((f) => f.kind === 'open' || f.kind === 'scale')
  if (!open.length) return ''
  const asks = open.map((f) => (f.kind === 'scale' ? scaleAsk(brief) : toAsk(f.text)))
  const body = asks.length === 1 ? asks[0] : asks.map((a, i) => `${i + 1}. ${a}`).join('\n')
  return `Hey! Quick thing before I quote this:\n${body}\nOnce I have that I can get you a price and we'll set a time.`
}

function toAsk(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (/\?$/.test(t)) return t
  // "whether the flowers wrap or stay on the outer arm" → a question
  return `Can you tell me ${t.replace(/^(whether|if|how|what|which|where)\b/i, (m) => m.toLowerCase())}?`
}

function scaleAsk(brief: Partial<ConciergeBrief> | Record<string, unknown>): string {
  const b = brief as Record<string, unknown>
  const size = str(b.size)
  const placement = str(b.placement)
  const where = [size, placement].filter(Boolean).join(' on the ')
  return where
    ? `Your reference will land a lot smaller once it's ${where}. Is the amount of detail in it what you want, or is it there for the style?`
    : 'Your reference will land differently at your size and placement. Is the amount of detail what you want, or is it there for the style?'
}
