// "I already handled this." The portal only sees what happens inside it.
// Lacey answers people by text, by phone, in Messenger and at the shop, and to
// the portal all of that looks like silence, so it kept reminding her about
// people she had already answered (Nov 18 2026).
//
// Her note on the card is how she says so: typed in her own words ("Deposit
// request sent"), or left by one tap on "I already handled this" on the card,
// in a reminder email or in the digest. No schema: it is a lead_notes row,
// author 'artist', private, never shown to the client and never sent.
//
// Pure, no server imports: the card, the timers and the digest all read it.

/** The words the "I already handled this" tap leaves as her note. */
export const HANDLED_NOTE = 'Handled outside the portal.'

/** The statuses where a lead can be waiting on her answer. */
export const CAN_BE_HANDLED = ['pending', 'info_requested', 'accepted']

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

/**
 * Has she dealt with this somewhere the portal cannot see? True when she left
 * a note on the card and nobody has written in the thread since. The moment
 * the client writes again somewhere the portal sees, the note is older than
 * the last word and the lead is hers to answer again. Returns the note, or
 * null. Pass her own notes only (author 'artist').
 */
export function handledElsewhere<N extends { created_at: string }>(
  thread: { sender: string; created_at: string }[],
  notes: N[] | null | undefined
): N | null {
  let note: N | null = null
  for (const n of notes ?? []) if (!note || ms(n.created_at) >= ms(note.created_at)) note = n
  if (!note) return null
  let lastWord = 0
  for (const m of thread) if (m.sender !== 'system') lastWord = Math.max(lastWord, ms(m.created_at))
  return ms(note.created_at) >= lastWord ? note : null
}
