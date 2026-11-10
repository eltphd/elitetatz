// The wording helper's answer, split into its parts. The assistant is asked
// to write four labelled sections; this reads them out of the text as it
// streams, so the card can show the suggested message apart from the note to
// her. Pure, shared by the route (to save only the message) and the card.

export interface Reworded {
  /** The message for the client, in her voice. The only part that can be sent. */
  message: string
  /** To her: what was kept, what was softened, and why it may land better. */
  why: string
  /** To her: one question, when her words could mean two things. Empty when none. */
  check: string
  /** To her: add-ons or pricing she may want to mention. Empty when none. */
  addons: string
}

type Label = 'MESSAGE' | 'WHY' | 'CHECK' | 'ADDONS'
const NONE = /^(none|n\/a|nothing|no)\.?$/i

export function parseReworded(text: string): Reworded {
  const out: Record<Label, string> = { MESSAGE: '', WHY: '', CHECK: '', ADDONS: '' }
  const marks: { label: Label; start: number; end: number }[] = []
  const re = /^[ \t]*(MESSAGE|WHY|CHECK|ADDONS)[ \t]*:[ \t]*/gim
  for (let m = re.exec(text); m; m = re.exec(text)) {
    marks.push({ label: m[1].toUpperCase() as Label, start: m.index, end: re.lastIndex })
  }
  // No labels at all (an older model, or a stream cut short): the whole thing is the message.
  if (!marks.length) return { message: text.trim(), why: '', check: '', addons: '' }
  marks.forEach((mark, i) => {
    const body = text.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim()
    if (!out[mark.label]) out[mark.label] = body
  })
  const clean = (s: string) => (NONE.test(s.trim()) ? '' : s.trim())
  return { message: out.MESSAGE.trim(), why: clean(out.WHY), check: clean(out.CHECK), addons: clean(out.ADDONS) }
}
