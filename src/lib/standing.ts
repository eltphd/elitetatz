// Where a lead stands, in one plain sentence, and what the client has been
// sent. Both are read off the lead and its thread; nothing here is stored.
//
// Why this exists (Nov 10, 2026): Lacey opened the portal after answering a
// client from her email and saw three buttons and no sign that she had
// already answered, or of what the client had been shown. A card has to say
// what already happened before it offers anything to tap.

export interface StandingMessage {
  sender: 'artist' | 'client' | 'system'
  body: string
  created_at: string
  channel?: string | null
  /** Set on a message that lives in her own mailbox: 'reply', 'forwarded' or 'delivered'. */
  mailbox?: string | null
}

export interface StandingLead {
  status: string
  channel?: string | null
  created_at: string
  offered_price_cents?: number | null
  appointment_at?: string | null
  date_request?: string | null
}

const TZ = 'America/New_York'
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
export const whenWords = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })

function lastOf(thread: StandingMessage[], sender: 'artist' | 'client'): StandingMessage | null {
  let last: StandingMessage | null = null
  for (const m of thread) if (m.sender === sender && (!last || ms(m.created_at) >= ms(last.created_at))) last = m
  return last
}

/** She has written, and nothing from the client is newer: the ball is in their court. */
export function artistHasLastWord(thread: StandingMessage[]): boolean {
  const a = lastOf(thread, 'artist')
  const c = lastOf(thread, 'client')
  return Boolean(a) && (!c || ms(c.created_at) <= ms(a!.created_at))
}

/** Her reply went out from her own mail app and was copied to the portal. */
export const isEmailReply = (m: StandingMessage | null) => Boolean(m) && m!.sender === 'artist' && (m!.mailbox === 'reply' || m!.channel === 'email')

export interface Standing {
  /** Whose move it is. 'nobody' is a finished or settled lead. */
  whose: 'you' | 'them' | 'nobody'
  headline: string
  detail: string
  /** The words in question (her reply, or the client's), when showing them helps. */
  said?: { who: 'you' | 'them'; text: string }
}

export function standing(lead: StandingLead, thread: StandingMessage[], first: string, now = Date.now()): Standing {
  const a = lastOf(thread, 'artist')
  const c = lastOf(thread, 'client')
  const clientNewer = Boolean(c) && (!a || ms(c!.created_at) > ms(a.created_at))

  switch (lead.status) {
    case 'rejected':
      return { whose: 'nobody', headline: 'You passed on this one.', detail: `${first} was told.` }
    case 'cancelled':
      return { whose: 'nobody', headline: 'Cancelled.', detail: 'Nothing more to do.' }
    case 'completed':
      return { whose: 'nobody', headline: 'Done.', detail: 'The session happened.' }
    case 'booked':
      if (lead.appointment_at && ms(lead.appointment_at) < now) {
        return { whose: 'nobody', headline: `The session was ${whenWords(lead.appointment_at)}.`, detail: `When you are ready, you can thank ${first} and ask for a review below.` }
      }
      return {
        whose: 'nobody',
        headline: lead.appointment_at ? `Booked for ${whenWords(lead.appointment_at)}.` : 'Booked.',
        detail: `${first} has the date and the address. Nothing to do until the session.`,
      }
    case 'paid':
      if (lead.appointment_at) return { whose: 'nobody', headline: `Booked for ${whenWords(lead.appointment_at)}.`, detail: `${first} has the date.` }
      return lead.date_request
        ? { whose: 'you', headline: `${first} paid the deposit and asked for a date.`, detail: `They asked for: ${lead.date_request}. Confirm it or pick another below.` }
        : { whose: 'them', headline: 'The deposit is in.', detail: `${first} was asked to pick a date on their page. You can also set one below.` }
    case 'accepted':
      if (clientNewer) return { whose: 'you', headline: `${first} wrote back after your quote.`, detail: `${whenWords(c!.created_at)}. Your move.`, said: { who: 'them', text: c!.body } }
      return {
        whose: 'them',
        headline: `You quoted ${lead.offered_price_cents ? money(lead.offered_price_cents) : 'a price'}. Waiting on the deposit.`,
        detail: `${first} has the quote and the deposit link. When the studio has the deposit, tap the button below.`,
      }
  }

  // pending or info_requested: the conversation before a price.
  if (clientNewer && a) {
    return { whose: 'you', headline: `${first} wrote back.`, detail: `${whenWords(c!.created_at)}. Your move.`, said: { who: 'them', text: c!.body } }
  }
  if (a && isEmailReply(a)) {
    return {
      whose: 'them',
      headline: `You already answered ${first} by email.`,
      detail: `${whenWords(a.created_at)}. Nothing is waiting on you, and no reminders will go out. The buttons below are for when you are ready to give a price or ask something else.`,
      ...(a.body && a.body !== 'Replied by email.' ? { said: { who: 'you' as const, text: a.body } } : {}),
    }
  }
  if (a) {
    return { whose: 'them', headline: `You wrote to ${first}. Waiting on them.`, detail: `${whenWords(a.created_at)}. You will get one email when they answer.`, said: { who: 'you', text: a.body } }
  }
  if (c?.mailbox) {
    return {
      whose: 'you',
      headline: 'This one came from your own email.',
      detail: `${first}'s message is in your mailbox too. If you answer it there, the portal cannot see it, so it will not remind you about this one.`,
    }
  }
  return {
    whose: 'you',
    headline: `New. ${first} is waiting to hear from you.`,
    detail: 'Answer from your email or from here. Either way they get one message from you.',
  }
}

export interface ClientSaw {
  at: string
  what: string
  how: string
  body?: string
}

/**
 * What the client has been sent, oldest first. Read off the thread, so it is
 * what the portal sent and what she sent, not a guess at what they opened.
 * `replyVia` is how a message from the portal reaches them ("email and text").
 */
export function clientSaw(lead: StandingLead, thread: StandingMessage[], replyVia: string): ClientSaw[] {
  const out: ClientSaw[] = []
  const channel = lead.channel ?? 'web'
  if (channel === 'web' || channel === 'concierge') {
    out.push({ at: lead.created_at, what: 'A note that their inquiry reached you', how: 'One email, with the link to their own page' })
  }
  for (const m of thread) {
    if (m.sender === 'artist') {
      out.push(
        isEmailReply(m)
          ? { at: m.created_at, what: 'Your reply', how: 'An email from you, sent from your own mail app', body: m.body === 'Replied by email.' ? undefined : m.body }
          : { at: m.created_at, what: 'Your message', how: `Sent by ${replyVia}, and shown on their page`, body: m.body },
      )
    } else if (m.sender === 'system' && m.channel === 'system') {
      out.push({ at: m.created_at, what: 'An automatic waiting note', how: 'Sent for you by the portal, and shown on their page', body: m.body })
    }
  }
  return out.sort((x, y) => ms(x.at) - ms(y.at))
}
