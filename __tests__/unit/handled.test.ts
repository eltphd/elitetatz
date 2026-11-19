/**
 * @jest-environment node
 */
import { fakeDb, writes, type Call } from '../helpers/fake-db'

// "I already handled this" (Nov 18 2026). Lacey answers people by text, by
// phone, in Messenger and at the shop; the portal saw none of it and kept
// telling her those people were waiting. Her note on the card is how she says
// so, and one tap leaves that note for her.

let db: ReturnType<typeof fakeDb>
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.db }))

import { CAN_BE_HANDLED, HANDLED_NOTE, handledElsewhere } from '@/lib/handled'
import { standing, type StandingLead, type StandingMessage } from '@/lib/standing'
import { groupOf, ownNotes, type Lead } from '@/app/dashboard/LeadCard'
import type { ThreadMessage } from '@/components/InquiryThread'
import { signHandled, verifyHandled, signMatch, handledUrl } from '@/lib/tokens'
import { POST } from '@/app/api/handled/route'

const at = (h: number) => new Date(Date.parse('2026-11-18T20:00:00Z') - h * 3_600_000).toISOString()
const msg = (sender: StandingMessage['sender'], hoursAgo: number, body = 'hi'): StandingMessage => ({ sender, body, created_at: at(hoursAgo) })
const note = (hoursAgo: number, body = HANDLED_NOTE, author = 'artist') => ({ id: 'n' + hoursAgo, author, kind: 'note', body, created_at: at(hoursAgo) })

describe('handledElsewhere', () => {
  const thread = [msg('system', 200, 'Inquiry sent from the form.'), msg('client', 200, 'I will email ideas.')]
  it('is her newest note, while nobody has written since', () => {
    expect(handledElsewhere(thread, [])).toBeNull()
    expect(handledElsewhere(thread, null)).toBeNull()
    expect(handledElsewhere(thread, [note(180, 'Deposit request sent')])?.body).toBe('Deposit request sent')
    expect(handledElsewhere(thread, [note(180, 'first'), note(100, 'second')])?.body).toBe('second')
  })
  it('ends when the client writes again where the portal sees it', () => {
    expect(handledElsewhere([...thread, msg('client', 5, 'Any update?')], [note(180)])).toBeNull()
  })
  it('ends when she writes from the portal herself: the normal thread rules take over', () => {
    expect(handledElsewhere([...thread, msg('artist', 5, 'Here is your quote')], [note(180)])).toBeNull()
  })
  it('a system line (an automatic note in the thread) is not somebody writing', () => {
    expect(handledElsewhere([...thread, msg('system', 5, 'Client added 1 reference file.')], [note(180)])).not.toBeNull()
  })
  it('a note written before the inquiry’s only message does not count', () => {
    expect(handledElsewhere(thread, [note(300)])).toBeNull()
  })
})

describe('the card', () => {
  const lead = (over: Partial<StandingLead> = {}): StandingLead => ({ status: 'pending', channel: 'web', created_at: at(200), ...over })
  const thread = [msg('client', 200, 'I will email ideas.')]

  it('says in her own words that she noted it, and that nothing goes to the client', () => {
    const s = standing(lead(), thread, 'Amy', Date.now(), { created_at: at(180), body: 'Deposit request sent' })
    expect(s.whose).toBe('them')
    expect(s.headline).toBe('You noted this one as handled.')
    expect(s.said).toEqual({ who: 'you', text: 'Deposit request sent' })
    expect(s.detail).toContain('No reminders will go out about it, and nothing is sent to Amy about waiting.')
    expect(s.detail).toContain('Delete the note to undo.')
  })
  it('the one-tap note reads as marked, without quoting the stock words back', () => {
    const s = standing(lead({ channel: 'facebook' }), thread, 'Kevin', Date.now(), { created_at: at(2), body: HANDLED_NOTE })
    expect(s.headline).toBe('You marked Kevin as handled outside the portal.')
    expect(s.said).toBeUndefined()
  })
  it('a lead she added herself says so, and that the portal will not time it or write to the client', () => {
    const s = standing(lead({ channel: 'facebook' }), [{ ...msg('client', 150, 'Very cool!'), pasted: true }], 'Kevin')
    expect(s.whose).toBe('you')
    expect(s.headline).toBe('You added this one yourself.')
    expect(s.detail).toContain('it will not remind you about this one or send Kevin anything')
  })
  it('without a note the same card is her move', () => {
    expect(standing(lead(), thread, 'Amy').whose).toBe('you')
  })
  it('a note does not rewrite a lead that is past answering: paid, booked, closed', () => {
    const noted = { created_at: at(1), body: HANDLED_NOTE }
    expect(standing(lead({ status: 'paid', date_request: 'Nov 20' }), thread, 'Amy', Date.now(), noted).whose).toBe('you')
    expect(standing(lead({ status: 'rejected' }), thread, 'Amy', Date.now(), noted).headline).toBe('You passed on this one.')
    expect(CAN_BE_HANDLED).toEqual(['pending', 'info_requested', 'accepted'])
  })
  it('a client who wrote back after her quote and was answered by text is noted the same way', () => {
    const quoted = [msg('artist', 100, 'Accepted — quote $450.'), msg('client', 50, 'Can we do Friday?')]
    expect(standing(lead({ status: 'accepted', offered_price_cents: 45000 }), quoted, 'Amy').whose).toBe('you')
    expect(standing(lead({ status: 'accepted', offered_price_cents: 45000 }), quoted, 'Amy', Date.now(), { created_at: at(40), body: 'Texted her, Friday works' }).whose).toBe('them')
  })

  it('moves out of "Needs you" into "Waiting on client", and back when the client writes', () => {
    const base = { id: 'm1', status: 'pending', channel: 'web', created_at: at(200) } as Lead
    const group = (t: StandingMessage[], notes?: Parameters<typeof groupOf>[2]) => groupOf(base, t as unknown as ThreadMessage[], notes)
    expect(group(thread)).toBe('needs_you')
    expect(group(thread, [note(180, 'Deposit request sent')])).toBe('waiting')
    expect(group([...thread, msg('client', 3, 'Any update?')], [note(180)])).toBe('needs_you')
    // The assistant's lines live in the same table and are not her saying anything.
    expect(group(thread, [note(180, 'Help me say: super vague', 'assistant')])).toBe('needs_you')
    expect(ownNotes([note(1), note(2, 'x', 'assistant')])).toHaveLength(1)
  })
})

describe('the link in a reminder', () => {
  const ENV = { ...process.env }
  beforeEach(() => { process.env = { ...ENV, MATCH_TOKEN_SECRET: 'test-secret', NEXT_PUBLIC_APP_URL: 'https://elitetatz.app' } })
  afterAll(() => { process.env = { ...ENV } })

  it('is signed for one lead, for 30 days', () => {
    const issued = Date.UTC(2026, 10, 18)
    const t = signHandled('match-a', issued)
    expect(verifyHandled('match-a', t, issued)).toBe(true)
    expect(verifyHandled('match-b', t, issued)).toBe(false)
    expect(verifyHandled('match-a', t, issued + 29 * 86_400_000)).toBe(true)
    expect(verifyHandled('match-a', t, issued + 31 * 86_400_000)).toBe(false)
    expect(verifyHandled('match-a', '')).toBe(false)
    expect(handledUrl('match-a')).toMatch(/^https:\/\/elitetatz\.app\/handled\/match-a\?t=/)
  })
  it('a client’s own inquiry link cannot mark anything as handled', () => {
    expect(verifyHandled('match-a', signMatch('match-a'))).toBe(false)
  })
  it('without a signing secret in production there is no link at all', () => {
    delete process.env.MATCH_TOKEN_SECRET
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    expect(handledUrl('match-a')).toBeNull()
  })
})

describe('POST /api/handled', () => {
  const ENV = { ...process.env }
  beforeEach(() => { process.env = { ...ENV, MATCH_TOKEN_SECRET: 'test-secret' } })
  afterAll(() => { process.env = { ...ENV } })
  let n = 0
  const post = (body: unknown) =>
    POST(new Request('http://x/api/handled', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.' + ++n }, body: JSON.stringify(body) }))
  const world = (status: string, thread: unknown[] = [], notes: unknown[] = []) =>
    fakeDb((c: Call) => {
      if (c.table === 'matches') return { data: { id: 'match-a', status } }
      if (c.table === 'match_messages') return { data: thread }
      if (c.table === 'lead_notes' && c.op === 'select') return { data: notes }
      return undefined
    })

  it('refuses a missing, wrong or borrowed token and reads nothing', async () => {
    db = world('pending')
    expect((await post({ matchId: 'match-a' })).status).toBe(401)
    expect((await post({ matchId: 'match-a', t: 'abc.def' })).status).toBe(401)
    expect((await post({ matchId: 'match-b', t: signHandled('match-a') })).status).toBe(401)
    expect((await post({ matchId: 'match-a', t: signMatch('match-a') })).status).toBe(401)
    expect(db.calls).toHaveLength(0)
  })
  it('leaves her private note on the lead, and nothing else: no message, no email, no status change', async () => {
    db = world('pending', [{ sender: 'client', created_at: at(30) }])
    const res = await post({ matchId: 'match-a', t: signHandled('match-a') })
    expect(await res.json()).toEqual({ ok: true })
    expect(writes(db.calls, 'lead_notes', 'insert').map((c) => c.payload)).toEqual([{ match_id: 'match-a', author: 'artist', kind: 'note', body: HANDLED_NOTE }])
    expect(db.calls.filter((c) => c.op !== 'select' && c.table !== 'lead_notes')).toHaveLength(0)
  })
  it('a second tap, or a lead that is already past answering, writes nothing', async () => {
    db = world('pending', [{ sender: 'client', created_at: at(30) }], [{ created_at: at(2) }])
    expect(await (await post({ matchId: 'match-a', t: signHandled('match-a') })).json()).toEqual({ ok: true, already: true })
    expect(writes(db.calls, 'lead_notes', 'insert')).toHaveLength(0)
    db = world('booked')
    expect(await (await post({ matchId: 'match-a', t: signHandled('match-a') })).json()).toEqual({ ok: true, already: true })
    expect(writes(db.calls, 'lead_notes', 'insert')).toHaveLength(0)
  })
})
