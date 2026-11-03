/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

const notify = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/notify', () => ({ notifyArtist: (...a: unknown[]) => notify(...a), notifyClient: jest.fn() }))

let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))

import { POST } from '@/app/api/inbound/chatwoot/route'

const event = {
  event: 'message_created',
  id: 501,
  content: 'hey, do you have room for a small moth in December?',
  message_type: 'incoming',
  conversation: { id: 31 },
  inbox: { channel_type: 'Channel::Instagram' },
  sender: { name: 'Jordan', additional_attributes: { social_profiles: { instagram: 'jordan.inks' } } },
  attachments: [],
}

function post(key: string | null, body: unknown) {
  const url = `http://localhost/api/inbound/chatwoot${key ? `?key=${key}` : ''}`
  return POST(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

beforeEach(() => {
  process.env.CHATWOOT_WEBHOOK_SECRET = 'hook-secret'
  notify.mockClear()
})

describe('POST /api/inbound/chatwoot', () => {
  it('refuses a missing or wrong key', async () => {
    db = fakeDb()
    expect((await post(null, event)).status).toBe(401)
    expect((await post('wrong', event)).status).toBe(401)
    expect(db.calls).toHaveLength(0)
  })

  it('opens a lead, records the event, saves the message and tells the artist', async () => {
    db = fakeDb((c: Call) => {
      if (c.table === 'inbound_events' && c.op === 'insert') return { data: { id: 1 } }
      if (c.table === 'artists') return { data: { id: 'artist-1', payout_preference: 'artist' } }
      if (c.table === 'matches' && c.op === 'select') return { data: [] }
      if (c.table === 'matches' && c.op === 'insert') return { data: { id: 'match-1' } }
      if (c.table === 'match_messages' && c.op === 'select') return { data: [] }
      if (c.table === 'match_messages' && c.op === 'insert') return { data: { id: 'msg-1' } }
      return { data: null }
    })
    const res = await post('hook-secret', event)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outcome).toBe('opened')
    expect(body.matchId).toBe('match-1')

    const [opened] = writes(db.calls, 'matches', 'insert')
    const row = opened.payload as Record<string, unknown>
    expect(row.channel).toBe('instagram')
    expect(row.external_thread_id).toBe('chatwoot:31')
    expect(row.client_name).toBe('Jordan')
    expect(row.status).toBe('pending')

    const msgs = writes(db.calls, 'match_messages', 'insert').map((c) => c.payload as Record<string, unknown>)
    expect(msgs.some((m) => m.sender === 'client' && m.external_id === 'chatwoot:msg:501')).toBe(true)

    expect(writes(db.calls, 'inbound_events', 'insert')[0].payload).toEqual({ channel: 'instagram', external_id: 'chatwoot:msg:501' })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].subject).toMatch(/Instagram DM: Jordan/)
  })

  it('treats a redelivered message as a no-op', async () => {
    db = fakeDb((c: Call) => {
      if (c.table === 'inbound_events' && c.op === 'insert') return { error: { code: '23505', message: 'duplicate' } }
      return { data: null }
    })
    const res = await post('hook-secret', event)
    expect((await res.json()).outcome).toBe('duplicate')
    expect(writes(db.calls, 'matches', 'insert')).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('ignores our own outgoing messages', async () => {
    db = fakeDb()
    const res = await post('hook-secret', { ...event, message_type: 'outgoing' })
    expect((await res.json()).outcome).toBe('ignored')
    expect(db.calls).toHaveLength(0)
  })
})
