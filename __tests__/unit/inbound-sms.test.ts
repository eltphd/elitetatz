/**
 * @jest-environment node
 */
import { createHmac } from 'crypto'
import { parseDialpadSms, verifyDialpadJwt } from '@/lib/inbound/sms'

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
function jwt(payload: object, secret: string) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64url(JSON.stringify(payload))
  const s = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest())
  return `${h}.${p}.${s}`
}

describe('verifyDialpadJwt', () => {
  it('returns the payload for a token signed with the secret', () => {
    const token = jwt({ id: 1, text: 'hi' }, 's3cret')
    expect(verifyDialpadJwt(token, 's3cret')).toEqual({ id: 1, text: 'hi' })
  })
  it('rejects a bad secret, a tampered payload and other algorithms', () => {
    const token = jwt({ id: 1 }, 's3cret')
    expect(verifyDialpadJwt(token, 'other')).toBeNull()
    const [h, , s] = token.split('.')
    expect(verifyDialpadJwt(`${h}.${b64url(JSON.stringify({ id: 2 }))}.${s}`, 's3cret')).toBeNull()
    const none = `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url('{}')}.`
    expect(verifyDialpadJwt(none, 's3cret')).toBeNull()
  })
})

describe('parseDialpadSms', () => {
  it('normalizes an inbound text with an MMS image', () => {
    const n = parseDialpadSms({ id: 'm1', direction: 'inbound', from_number: '6145550199', to_number: '+16145550100', text: 'tiny wave behind my ear?', mms: true, mms_url: ['https://dialpad.example/mms/1.jpg'] })
    expect(n?.channel).toBe('sms')
    expect(n?.phone).toBe('+16145550199')
    expect(n?.externalId).toBe('dialpad:m1')
    expect(n?.externalThreadId).toBe('sms:+16145550199')
    expect(n?.attachments).toHaveLength(1)
  })
  it('ignores outbound texts and ones with no sender', () => {
    expect(parseDialpadSms({ id: 'm2', direction: 'outbound', from_number: '6145550100', text: 'hey' })).toBeNull()
    expect(parseDialpadSms({ id: 'm3', direction: 'inbound', text: 'hey' })).toBeNull()
  })
})
