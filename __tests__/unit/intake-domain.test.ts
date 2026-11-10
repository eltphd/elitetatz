/**
 * @jest-environment node
 */
import { intakeDomain, isOurs, normalizeEmail, readArtistReply, type ReceivedEmail } from '@/lib/inbound/email'

// The intake address was renamed from leads@ to studio@ on Nov 10, 2026,
// because clients see it beside their own address on Lacey's replies. Resend
// receives every address on the domain, so the old one keeps arriving and has
// to keep meaning the same thing.

const FORWARD = `---------- Forwarded message ---------
From: Devon Carter <devon@example.com>
Subject: Tattoo inquiry - moth piece
To: <lacey@rawsunart.com>

Hi Lacey, I'd love a fine-line moth on my sternum.`

const mail = (over: Partial<ReceivedEmail>): ReceivedEmail => ({ id: 'e1', from: 'Lacey <lacey@rawsunart.com>', to: ['studio@inbox.rawsunart.com'], subject: 'Fwd: moth', text: FORWARD, html: null, ...over })

beforeEach(() => {
  process.env.ARTIST_NOTIFICATION_EMAIL = 'lacey@rawsunart.com'
  process.env.INBOUND_EMAIL_ADDRESS = 'studio@inbox.rawsunart.com'
  delete process.env.ARTIST_NOTIFICATION_CC
})

describe('the intake domain', () => {
  it('is read from the intake address', () => {
    expect(intakeDomain()).toBe('inbox.rawsunart.com')
    process.env.INBOUND_EMAIL_ADDRESS = 'RawSunArt Studio <Studio@Inbox.RawSunArt.com>'
    expect(intakeDomain()).toBe('inbox.rawsunart.com')
    delete process.env.INBOUND_EMAIL_ADDRESS
    expect(intakeDomain()).toBeNull()
  })
  it('every address on it is ours, old name or new', () => {
    expect(isOurs('studio@inbox.rawsunart.com')).toBe(true)
    expect(isOurs('leads@inbox.rawsunart.com')).toBe(true)
    expect(isOurs('Leads <LEADS@inbox.rawsunart.com>')).toBe(true)
    expect(isOurs('devon@example.com')).toBe(false)
    // A lookalike domain is not ours.
    expect(isOurs('x@notinbox.rawsunart.com')).toBe(false)
    expect(isOurs('x@inbox.rawsunart.com.evil.example')).toBe(false)
  })
})

describe('the old intake address still works', () => {
  it('a forward she sends to leads@ is still a forward from the client', () => {
    const m = mail({ to: ['leads@inbox.rawsunart.com'] })
    expect(readArtistReply(m)).toBeNull()
    const n = normalizeEmail(m, [])
    if ('ignored' in n) throw new Error('should be read as a forward')
    expect(n.email).toBe('devon@example.com')
    expect(n.artistHasIt).toBe('forwarded')
  })
  it('her reply copied to either address is her reply to the client', () => {
    for (const intake of ['studio@inbox.rawsunart.com', 'leads@inbox.rawsunart.com']) {
      const r = readArtistReply(mail({ to: ['ana@example.com', intake], subject: 'Re: Inquiry', text: 'Hi Ana! Yes.' }))
      expect(r?.clients).toEqual(['ana@example.com'])
    }
  })
})
