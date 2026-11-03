/**
 * @jest-environment node
 */
import { createHmac } from 'crypto'
import { bareAddress, displayName, isAutomated, normalizeEmail, stripQuoted, textBody, unwrapForward, verifyResendSignature, type ReceivedEmail } from '@/lib/inbound/email'

const SECRET_RAW = Buffer.from('0123456789abcdef0123456789abcdef')
const SECRET = `whsec_${SECRET_RAW.toString('base64')}`

function sign(id: string, ts: number, body: string) {
  return 'v1,' + createHmac('sha256', SECRET_RAW).update(`${id}.${ts}.${body}`).digest('base64')
}

describe('verifyResendSignature', () => {
  const body = '{"type":"email.received"}'
  const now = 1_700_000_000_000
  const ts = Math.floor(now / 1000)
  it('accepts a fresh, correctly signed body', () => {
    const h = new Headers({ 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': sign('msg_1', ts, body) })
    expect(verifyResendSignature(h, body, SECRET, now)).toBe(true)
  })
  it('rejects a tampered body and a stale timestamp', () => {
    const h = new Headers({ 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': sign('msg_1', ts, body) })
    expect(verifyResendSignature(h, body + ' ', SECRET, now)).toBe(false)
    expect(verifyResendSignature(h, body, SECRET, now + 10 * 60_000)).toBe(false)
  })
  it('rejects missing headers', () => {
    expect(verifyResendSignature(new Headers(), body, SECRET, now)).toBe(false)
  })
})

describe('address helpers', () => {
  it('reads bare addresses and names', () => {
    expect(bareAddress('Devon Carter <Devon.Carter@Example.com>')).toBe('devon.carter@example.com')
    expect(displayName('Devon Carter <devon@example.com>')).toBe('Devon Carter')
    expect(displayName('"Maya R." <maya@example.com>')).toBe('Maya R.')
    expect(displayName('jordan.lee@example.com')).toBe('Jordan Lee')
  })
})

describe('isAutomated', () => {
  const mail = (over: Partial<ReceivedEmail>): ReceivedEmail => ({ id: 'e', from: 'a@b.co', to: [], subject: 'hi', text: 'x', html: null, ...over })
  it('drops bounces, auto-replies and list mail', () => {
    expect(isAutomated(mail({ from: 'mailer-daemon@googlemail.com' }))).toBe(true)
    expect(isAutomated(mail({ headers: { 'Auto-Submitted': 'auto-replied' } }))).toBe(true)
    expect(isAutomated(mail({ headers: [{ name: 'List-Unsubscribe', value: '<x>' }] }))).toBe(true)
    expect(isAutomated(mail({ subject: 'Automatic reply: Tattoo' }))).toBe(true)
    expect(isAutomated(mail({}))).toBe(false)
  })
})

describe('forwarded mail', () => {
  const gmail = `FYI

---------- Forwarded message ---------
From: Devon Carter <devon@example.com>
Date: Mon, Nov 3, 2026 at 9:12 AM
Subject: Tattoo inquiry - moth piece
To: <lacey@rawsunart.com>


Hi Lacey, I'd love a fine-line moth on my sternum.
Budget up to $700.`
  it('recovers the real sender, subject and body from a Gmail forward', () => {
    const f = unwrapForward(gmail)
    expect(f?.from).toBe('Devon Carter <devon@example.com>')
    expect(f?.subject).toBe('Tattoo inquiry - moth piece')
    expect(f?.body).toMatch(/^Hi Lacey/)
  })
  it('returns null when there is nothing forwarded', () => {
    expect(unwrapForward('just a note')).toBeNull()
  })
  it('turns a forward from her own address into a lead for the client', () => {
    const n = normalizeEmail({ id: 'abc', from: 'Lacey <lacey@rawsunart.com>', to: ['inbox@rawsunart.com'], subject: 'Fwd: Tattoo inquiry - moth piece', text: gmail, html: null }, [])
    expect('ignored' in n).toBe(false)
    if ('ignored' in n) return
    expect(n.email).toBe('devon@example.com')
    expect(n.senderName).toBe('Devon Carter')
    expect(n.subject).toBe('Tattoo inquiry - moth piece')
    expect(n.text).toMatch(/^Hi Lacey/)
    expect(n.externalId).toBe('resend:abc')
  })
  it('ignores her own mail that is not a forward', () => {
    const n = normalizeEmail({ id: 'x', from: 'lacey@rawsunart.com', to: [], subject: 'note', text: 'remember to order ink', html: null }, [])
    expect(n).toEqual({ ignored: 'own-address' })
  })
})

describe('bodies', () => {
  it('strips quoted history and signatures', () => {
    const t = `Yes 5 inches works for me!\n\nOn Mon, Nov 3, 2026 at 9:12 AM Lacey <lacey@rawsunart.com> wrote:\n> how big?\n> thanks`
    expect(stripQuoted(t)).toBe('Yes 5 inches works for me!')
    expect(stripQuoted('Sure thing, see you Saturday at noon then.\n-- \nDevon\nSent from my phone')).toBe('Sure thing, see you Saturday at noon then.')
  })
  it('reads text out of html when there is no text part', () => {
    expect(textBody({ text: null, html: '<div>Hi <b>Lacey</b>,<br>Moth &amp; wash please</div><style>x{}</style>' })).toBe('Hi Lacey,\nMoth & wash please')
  })
})
