/**
 * @jest-environment node
 */
import { addressedToIntake, ignoredSenders, isSystemSender, normalizeEmail, readArtistReply, type ReceivedEmail } from '@/lib/inbound/email'
import { cleanSubject } from '@/lib/resend'

// Nov 11 2026: a woopsi.ink order notice became a tattoo lead named "Hello".
// The Resend account also receives mail for woopsi.ink, and Resend hands every
// received message to every webhook on the account. Lacey was emailed a "new
// inquiry", a reminder, a "Hello replied by email" and a nightly listing about
// a card order. Mail that is not addressed to the intake, or that comes from
// one of our own systems, never becomes a lead.

const ENV = { ...process.env }
beforeEach(() => {
  process.env = { ...ENV, INBOUND_EMAIL_ADDRESS: 'leads@inbox.rawsunart.com', ARTIST_NOTIFICATION_EMAIL: 'lacey@rawsunart.com' }
  delete process.env.INBOUND_IGNORE_SENDERS
})
afterAll(() => { process.env = { ...ENV } })

const mail = (over: Partial<ReceivedEmail> = {}): ReceivedEmail => ({
  id: 'em_1', from: 'Devon Carter <devon@example.com>', to: ['leads@inbox.rawsunart.com'], subject: 'Tattoo idea', text: 'I would like a small fern on my forearm.', html: null, headers: {}, ...over,
})

describe('what the intake reads', () => {
  it('the Nov 11 order notice: sent to the woopsi desk, from the woopsi system, never a lead', () => {
    const order = mail({
      from: 'Hello <hello@woopsi.ink>',
      to: ['hello@woopsi.ink', 'operator@example.org'],
      subject: 'New order: 2 × Honor & Bloom — Forget-Me-Not Cards — 5-card pack ($50)',
      text: 'A paid order just arrived.\nSKU: rsa-honor-bloom-5',
    })
    expect(addressedToIntake(order)).toBe(false)
    expect(normalizeEmail(order, [])).toEqual({ ignored: 'not-addressed-to-intake' })
  })
  it('a customer writing to the woopsi support address is not a tattoo client either', () => {
    const support = mail({ from: 'Pat <pat@example.com>', to: ['hello@woopsi.ink'], subject: 'Where is my order?' })
    expect(normalizeEmail(support, [])).toEqual({ ignored: 'not-addressed-to-intake' })
  })
  it('a woopsi notice is refused even when it does reach the intake: forwarded by her mail, or sent there directly', () => {
    const autoForwarded = mail({ from: 'Hello <hello@woopsi.ink>', to: ['lacey@rawsunart.com'], headers: { 'X-Forwarded-To': 'leads@inbox.rawsunart.com' }, subject: 'New order' })
    expect(addressedToIntake(autoForwarded)).toBe(true)
    expect(normalizeEmail(autoForwarded, [])).toEqual({ ignored: 'system-sender' })
    expect(normalizeEmail(mail({ from: 'hello@woopsi.ink' }), [])).toEqual({ ignored: 'system-sender' })
    // She forwards the notice by hand: the real sender is inside, and still a system.
    const byHand = mail({ from: 'Lacey <lacey@rawsunart.com>', text: 'fyi\n\n---------- Forwarded message ---------\nFrom: Hello <hello@woopsi.ink>\nSubject: New order\n\nA paid order just arrived.' })
    expect(normalizeEmail(byHand, [])).toEqual({ ignored: 'system-sender' })
  })
  it('a real inquiry still lands: written to the intake, or to her and forwarded on', () => {
    expect(normalizeEmail(mail(), [])).toMatchObject({ channel: 'email', email: 'devon@example.com' })
    const viaHerMailbox = mail({ to: ['lacey@rawsunart.com'], headers: { 'X-Forwarded-For': 'lacey@rawsunart.com leads@inbox.rawsunart.com' } })
    expect(normalizeEmail(viaHerMailbox, [])).toMatchObject({ channel: 'email', email: 'devon@example.com', artistHasIt: 'delivered' })
    // An older intake address on the same domain is still ours.
    expect(addressedToIntake(mail({ to: ['intake@inbox.rawsunart.com'] }))).toBe(true)
    // Named only in a Received header (a blind copy).
    expect(addressedToIntake(mail({ to: [], headers: { Received: 'from mx.example.com by inbound.resend.com for <leads@inbox.rawsunart.com>; Tue, 10 Nov 2026' } }))).toBe(true)
  })
  it('fails open: no intake address configured, or no recipient recorded at all, reads as before', () => {
    expect(addressedToIntake(mail({ to: [], headers: {} }))).toBe(true)
    delete process.env.INBOUND_EMAIL_ADDRESS
    expect(addressedToIntake(mail({ to: ['hello@woopsi.ink'] }))).toBe(true)
  })
  it('her reply to a system address is not a reply to a client', () => {
    const reply = mail({ from: 'Lacey <lacey@rawsunart.com>', to: ['hello@woopsi.ink', 'leads@inbox.rawsunart.com'], subject: 'Re: Waiting a day: New order', text: 'Got it' })
    expect(readArtistReply(reply)).toBeNull()
    const real = mail({ from: 'Lacey <lacey@rawsunart.com>', to: ['devon@example.com', 'leads@inbox.rawsunart.com'], text: 'Yes, I would love to.' })
    expect(readArtistReply(real)?.clients).toEqual(['devon@example.com'])
  })
})

describe('system senders', () => {
  it('woopsi.ink is always one; INBOUND_IGNORE_SENDERS adds domains or single addresses', () => {
    expect(ignoredSenders(undefined)).toEqual(['woopsi.ink'])
    expect(ignoredSenders(' @Shop.example , billing@vendor.example ,')).toEqual(['woopsi.ink', 'shop.example', 'billing@vendor.example'])
    expect(isSystemSender('Hello <hello@woopsi.ink>')).toBe(true)
    expect(isSystemSender('orders@mail.woopsi.ink')).toBe(true)
    expect(isSystemSender('someone@notwoopsi.ink')).toBe(false)
    expect(isSystemSender('devon@example.com')).toBe(false)
    const list = ignoredSenders('shop.example,billing@vendor.example')
    expect(isSystemSender('a@shop.example', list)).toBe(true)
    expect(isSystemSender('billing@vendor.example', list)).toBe(true)
    expect(isSystemSender('sales@vendor.example', list)).toBe(false)
  })
})

describe('cleanSubject', () => {
  it('a subject built from a client’s own words is one line: Resend refuses a line break', () => {
    const s = cleanSubject('Waiting a day: My friend and I would both like to get meaningful tattoos done. \nMine: 4 intertwined flowers')
    expect(s).toBe('Waiting a day: My friend and I would both like to get meaningful tattoos done. Mine: 4 intertwined flowers')
    expect(cleanSubject('a\r\n\tb c')).toBe('a b c')
  })
  it('is kept to a sane length and leaves an ordinary subject alone', () => {
    expect(cleanSubject('Inquiry: small fern (forearm)')).toBe('Inquiry: small fern (forearm)')
    const long = cleanSubject('Inquiry: ' + 'x'.repeat(400))
    expect(long.length).toBe(200)
    expect(long.endsWith('…')).toBe(true)
  })
})
