import { artistHasLastWord, clientSaw, standing, type StandingLead, type StandingMessage } from '@/lib/standing'
import { parseReworded } from '@/lib/reword'
import { originalArtLine, isOriginalArt } from '@/lib/addons'
import { groupOf, type Lead } from '@/app/dashboard/LeadCard'
import { rewordPrompt, ASSISTANT_MODES, systemPrompt } from '@/lib/assistant'

// What Lacey hit on Nov 10, 2026: she answered a client from her email, opened
// the portal, and the card showed three buttons with no sign she had answered
// or of what the client had been sent.

const at = (h: number) => new Date(Date.parse('2026-11-10T20:00:00Z') - h * 3_600_000).toISOString()
const lead = (over: Partial<StandingLead> = {}): StandingLead => ({ status: 'pending', channel: 'web', created_at: at(30), ...over })
const m = (sender: StandingMessage['sender'], hoursAgo: number, body: string, extra: Partial<StandingMessage> = {}): StandingMessage => ({ sender, body, created_at: at(hoursAgo), ...extra })
const SYSTEM = m('system', 30, 'Inquiry sent from the rawsunart.com form.')
const EMAIL_REPLY = m('artist', 28, "Hi Ana! Yes, I'd love to do this.", { channel: 'email', mailbox: 'reply' })

describe('standing: what the card says first', () => {
  it('a new inquiry she has not touched is her move', () => {
    const s = standing(lead(), [SYSTEM], 'Ana')
    expect(s.whose).toBe('you')
    expect(s.headline).toBe('New. Ana is waiting to hear from you.')
  })
  it('after she answered by email it says so, shows her words, and promises no reminders', () => {
    const s = standing(lead(), [SYSTEM, EMAIL_REPLY], 'Ana')
    expect(s.whose).toBe('them')
    expect(s.headline).toBe('You already answered Ana by email.')
    expect(s.detail).toMatch(/Nothing is waiting on you/)
    expect(s.detail).toMatch(/no reminders/)
    expect(s.said).toEqual({ who: 'you', text: "Hi Ana! Yes, I'd love to do this." })
  })
  it('an unverified email reply is acknowledged without inventing her words', () => {
    const s = standing(lead(), [SYSTEM, m('artist', 28, 'Replied by email.', { channel: 'email', mailbox: 'reply' })], 'Ana')
    expect(s.headline).toBe('You already answered Ana by email.')
    expect(s.said).toBeUndefined()
  })
  it('when the client writes back it is her move again, with their words', () => {
    const s = standing(lead(), [SYSTEM, EMAIL_REPLY, m('client', 2, 'Weekdays are perfect.')], 'Ana')
    expect(s.whose).toBe('you')
    expect(s.headline).toBe('Ana wrote back.')
    expect(s.said).toEqual({ who: 'them', text: 'Weekdays are perfect.' })
  })
  it('a lead she forwarded from her own email is explained, not nagged about', () => {
    const s = standing(lead({ channel: 'email' }), [m('client', 30, 'Hi Lacey', { channel: 'email', mailbox: 'forwarded' })], 'Devon')
    expect(s.headline).toBe('This one came from your own email.')
    expect(s.detail).toMatch(/will not remind you/)
  })
  it('later stages read as plain sentences', () => {
    expect(standing(lead({ status: 'accepted', offered_price_cents: 45000 }), [SYSTEM, m('artist', 5, 'Accepted — quote $450.')], 'Ana').headline).toBe('You quoted $450. Waiting on the deposit.')
    expect(standing(lead({ status: 'paid', date_request: 'Nov 20 afternoon' }), [], 'Ana')).toMatchObject({ whose: 'you', headline: 'Ana paid the deposit and asked for a date.' })
    const NOW = Date.parse('2026-11-10T20:00:00Z')
    expect(standing(lead({ status: 'booked', appointment_at: '2026-11-20T19:00:00Z' }), [], 'Ana', NOW).headline).toBe('Booked for Fri, Nov 20, 2:00 PM.')
    expect(standing(lead({ status: 'booked', appointment_at: '2026-11-05T19:00:00Z' }), [], 'Ana', NOW).headline).toBe('The session was Thu, Nov 5, 2:00 PM.')
    expect(standing(lead({ status: 'rejected' }), [], 'Ana').whose).toBe('nobody')
  })
})

describe('grouping: an answered inquiry leaves "Needs you"', () => {
  const full = (status: string): Lead => ({
    id: 'x', status, channel: 'web', client_brief: null, ai_summary: null, offered_price_cents: null, placement: null, created_at: at(30), artist_response: null,
    conversation_id: null, client_name: 'Ana', client_email: 'a@example.com', client_phone: null, external_thread_id: null, proposed_dates: null, appointment_at: null,
    design_fee_cents: null, date_request: null, stripe_payment_intent_id: null, last_client_message_at: null, clients: null,
  })
  const t = (msgs: StandingMessage[]) => msgs.map((x, i) => ({ id: String(i), ...x }))
  it('new and untouched: needs her', () => {
    expect(groupOf(full('pending'), t([SYSTEM]))).toBe('needs_you')
    expect(artistHasLastWord([SYSTEM])).toBe(false)
  })
  it('answered by email, or from here: waiting on the client', () => {
    expect(groupOf(full('pending'), t([SYSTEM, EMAIL_REPLY]))).toBe('waiting')
    expect(groupOf(full('pending'), t([SYSTEM, m('artist', 3, 'Quick question first')]))).toBe('waiting')
  })
  it('the client writing back brings it home again', () => {
    expect(groupOf(full('pending'), t([SYSTEM, EMAIL_REPLY, m('client', 1, 'Yes!')]))).toBe('needs_you')
  })
})

describe('clientSaw: what the client has been sent', () => {
  it('a form inquiry: the receipt, then her email reply, in order', () => {
    const seen = clientSaw(lead(), [SYSTEM, EMAIL_REPLY], 'email')
    expect(seen.map((s) => s.what)).toEqual(['A note that their inquiry reached you', 'Your reply'])
    expect(seen[0].how).toMatch(/link to their own page/)
    expect(seen[1].how).toMatch(/your own mail app/)
  })
  it('messages from the portal and automatic waiting notes are listed with how they went', () => {
    const seen = clientSaw(lead(), [SYSTEM, m('artist', 20, 'How big?'), m('system', 4, 'Still with Lacey; you will hear by Thursday.', { channel: 'system' })], 'email and text')
    expect(seen.map((s) => s.what)).toEqual(['A note that their inquiry reached you', 'Your message', 'An automatic waiting note'])
    expect(seen[1].how).toBe('Sent by email and text, and shown on their page')
  })
  it('someone who emailed her directly has been sent nothing by the portal', () => {
    expect(clientSaw(lead({ channel: 'email' }), [m('client', 30, 'Hi', { channel: 'email', mailbox: 'forwarded' })], 'email')).toEqual([])
  })
})

describe('the wording helper', () => {
  it('reads the four labelled parts', () => {
    const r = parseReworded('MESSAGE: Hey Maya! I draw my own version.\nSecond line.\nWHY: Kept your no, led with her mom.\nCHECK: Did you mean no reference at all?\nADDONS: none')
    expect(r).toEqual({ message: 'Hey Maya! I draw my own version.\nSecond line.', why: 'Kept your no, led with her mom.', check: 'Did you mean no reference at all?', addons: '' })
  })
  it('shows a half-streamed answer as it arrives, and treats unlabelled text as the message', () => {
    expect(parseReworded('MESSAGE: Hey Maya! I dr').message).toBe('Hey Maya! I dr')
    expect(parseReworded('Hey Maya, yes.')).toEqual({ message: 'Hey Maya, yes.', why: '', check: '', addons: '' })
  })
  it('the prompt holds her decision fixed and asks instead of guessing', () => {
    const p = rewordPrompt("I won't tattoo AI art. 450.", false)
    expect(ASSISTANT_MODES).toContain('reword')
    expect(p).toMatch(/What she decided stands exactly as she said it/)
    expect(p).toMatch(/Do not turn a no into a maybe/)
    expect(p).toMatch(/ask her one short question rather than guessing/)
    expect(p).toMatch(/MESSAGE:[\s\S]*WHY:[\s\S]*CHECK:[\s\S]*ADDONS:/)
    expect(p.trim().endsWith("I won't tattoo AI art. 450.")).toBe(true)
    expect(rewordPrompt('x', true)).toMatch(/tattooed by her before/)
  })
  it('the assistant knows her add-ons and never prices them for her', () => {
    expect(systemPrompt()).toMatch(/original of the piece/)
    expect(systemPrompt()).toMatch(/Never state a price for an add-on unless she gave one/)
  })
})

describe('add-ons on a quote', () => {
  it('writes one line for the thread and the client email', () => {
    expect(originalArtLine('paper', 15000)).toBe('An original of your piece, painted on watercolor paper, yours to keep at the appointment: $150 (separate from the deposit).')
    expect(originalArtLine('digital', null)).toBe('A digital original of your piece, drawn in Procreate, yours to keep at the appointment (separate from the deposit).')
  })
  it('is nothing unless she chose one', () => {
    expect(originalArtLine('', 5000)).toBeNull()
    expect(originalArtLine('nft', 5000)).toBeNull()
    expect(isOriginalArt('paper')).toBe(true)
  })
})
