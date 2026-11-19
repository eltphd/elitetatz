/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { fakeDb, type Call } from '../helpers/fake-db'

// The page a reminder's "already handled it?" link opens, rendered against a
// database in each state it can be in. It is the artist's page, reached with
// no sign-in, so what it shows and when it offers the button both matter.

let db: ReturnType<typeof fakeDb> | null
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => (db ? db.db : null) }))

import HandledPage from '@/app/handled/[matchId]/page'
import { signHandled, signMatch } from '@/lib/tokens'

const ENV = { ...process.env }
beforeEach(() => { process.env = { ...ENV, MATCH_TOKEN_SECRET: 'test-secret' } })
afterAll(() => { process.env = { ...ENV } })

const at = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const world = (match: Record<string, unknown> | null, thread: unknown[] = [], notes: unknown[] = []) =>
  fakeDb((c: Call) => {
    if (c.table === 'matches') return { data: match }
    if (c.table === 'match_messages') return { data: thread }
    if (c.table === 'lead_notes') return { data: notes }
    return undefined
  })
const open = async (matchId: string, t: string | undefined) =>
  renderToStaticMarkup(await HandledPage({ params: Promise.resolve({ matchId }), searchParams: Promise.resolve({ t }) }))

const AMY = { id: 'match-a', status: 'pending', client_name: 'Amy Parker', ai_summary: 'Four intertwined flowers\nfor me and a friend' }

describe('/handled/[matchId]', () => {
  it('a lead waiting on her shows the first name, the idea on one line, and the one button', async () => {
    db = world(AMY, [{ sender: 'client', created_at: at(30) }])
    const html = await open('match-a', signHandled('match-a'))
    expect(html).toContain('Already answered Amy another way?')
    expect(html).toContain('Four intertwined flowers for me and a friend')
    expect(html).toContain('Yes, I already handled this')
    expect(html).toContain('Nothing is sent to Amy.')
    // First name only: the page is reached without a sign-in.
    expect(html).not.toContain('Parker')
    // Opening the page writes nothing. Only the button does.
    expect(db.calls.every((c) => c.op === 'select')).toBe(true)
  })

  it('a lead she already noted, or one past answering, offers no button', async () => {
    db = world(AMY, [{ sender: 'client', created_at: at(30) }], [{ created_at: at(2) }])
    let html = await open('match-a', signHandled('match-a'))
    expect(html).toContain('Nothing is waiting on you here')
    expect(html).not.toContain('Yes, I already handled this')

    db = world({ ...AMY, status: 'booked' })
    html = await open('match-a', signHandled('match-a'))
    expect(html).toContain('Nothing is waiting on you here')
    expect(html).not.toContain('Yes, I already handled this')
  })

  it('the client wrote again after her note: the button is back', async () => {
    db = world(AMY, [{ sender: 'client', created_at: at(30) }, { sender: 'client', created_at: at(1) }], [{ created_at: at(10) }])
    expect(await open('match-a', signHandled('match-a'))).toContain('Yes, I already handled this')
  })

  it('a wrong, missing or borrowed link shows nothing about the lead and reads nothing', async () => {
    db = world(AMY)
    for (const t of [undefined, 'abc.def', signHandled('match-b'), signMatch('match-a')]) {
      const html = await open('match-a', t)
      expect(html).toContain('This link has expired')
      expect(html).not.toContain('Amy')
    }
    expect(db.calls).toHaveLength(0)
  })

  it('no database, or no such lead: a plain "not available", never an error page', async () => {
    db = null
    expect(await open('match-a', signHandled('match-a'))).toContain('This page is not available right now')
    db = world(null)
    expect(await open('match-a', signHandled('match-a'))).toContain('This page is not available right now')
  })
})
