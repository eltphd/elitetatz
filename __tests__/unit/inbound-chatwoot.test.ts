/**
 * @jest-environment node
 */
import { parseChatwootEvent, verifyWebhookKey } from '@/lib/inbound/chatwoot'

const incoming = {
  event: 'message_created',
  id: 9001,
  content: 'hi!! i want a peony on my forearm',
  message_type: 'incoming',
  private: false,
  conversation: { id: 77, channel: 'Channel::Instagram' },
  inbox: { id: 3, name: 'RawSunArt IG', channel_type: 'Channel::Instagram' },
  sender: { name: 'Maya R.', email: null, phone_number: null, additional_attributes: { social_profiles: { instagram: 'maya.inks' } } },
  attachments: [{ file_type: 'image', data_url: 'https://cdn.example/att/1.jpeg', extension: 'jpeg' }],
}

describe('parseChatwootEvent', () => {
  it('turns an incoming Instagram message into a normalized lead message', () => {
    const n = parseChatwootEvent(incoming)
    expect(n).not.toBeNull()
    expect(n?.channel).toBe('instagram')
    expect(n?.externalId).toBe('chatwoot:msg:9001')
    expect(n?.externalThreadId).toBe('chatwoot:77')
    expect(n?.senderName).toBe('Maya R.')
    expect(n?.attachments).toHaveLength(1)
    expect(n?.attachments[0].mime).toBe('image/jpeg')
    expect(n?.meta?.handle).toBe('maya.inks')
  })
  it('tells Messenger from Instagram and reads a phone number', () => {
    const n = parseChatwootEvent({ ...incoming, inbox: { channel_type: 'Channel::FacebookPage' }, conversation: { id: 78 }, sender: { name: '', phone_number: '(614) 555-0142' } })
    expect(n?.channel).toBe('facebook')
    expect(n?.phone).toBe('+16145550142')
    expect(n?.senderName).toBeNull()
  })
  it('ignores our own replies, private notes and other events', () => {
    expect(parseChatwootEvent({ ...incoming, message_type: 'outgoing' })).toBeNull()
    expect(parseChatwootEvent({ ...incoming, private: true })).toBeNull()
    expect(parseChatwootEvent({ ...incoming, event: 'conversation_status_changed' })).toBeNull()
    expect(parseChatwootEvent('nope')).toBeNull()
  })
})

describe('verifyWebhookKey', () => {
  it('matches only the exact secret', () => {
    expect(verifyWebhookKey('abc', 'abc')).toBe(true)
    expect(verifyWebhookKey('abd', 'abc')).toBe(false)
    expect(verifyWebhookKey(null, 'abc')).toBe(false)
    expect(verifyWebhookKey('abc', undefined)).toBe(false)
  })
})
