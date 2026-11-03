import { replyRoute, threadId, isChannel } from '@/lib/channels'
import { conceptFrom } from '@/lib/inbound/ingest'

describe('channels', () => {
  it('names the reply route in words', () => {
    expect(replyRoute({ channel: 'instagram', external_thread_id: 'chatwoot:12' })).toBe('Instagram DM')
    expect(replyRoute({ channel: 'facebook', external_thread_id: 'chatwoot:12', client_email: 'a@b.co' })).toBe('Messenger and email')
    expect(replyRoute({ channel: 'email', client_email: 'a@b.co', client_phone: '+16145550100' })).toBe('email and text')
    expect(replyRoute({ channel: 'manual' })).toMatch(/nowhere yet/)
  })
  it('builds thread ids', () => {
    expect(threadId('chatwoot', '42')).toBe('chatwoot:42')
    expect(threadId('email', 'Jo@Example.com ')).toBe('email:jo@example.com')
  })
  it('knows its channels', () => {
    expect(isChannel('instagram')).toBe(true)
    expect(isChannel('carrier pigeon')).toBe(false)
  })
})

describe('conceptFrom', () => {
  it('prefers a meaningful subject', () => {
    expect(conceptFrom('Re: Fwd: Moth tattoo on sternum', 'hi there', 'email')).toBe('Moth tattoo on sternum')
  })
  it('skips a generic subject for the first sentence', () => {
    expect(conceptFrom('Tattoo inquiry', 'I want a watercolor peony on my forearm. It is for my mom.', 'email')).toBe('I want a watercolor peony on my forearm.')
  })
  it('labels an empty message', () => {
    expect(conceptFrom(null, '', 'sms')).toBe('New text message')
  })
})
