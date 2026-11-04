import { fakeDb, writes, type Call } from '../helpers/fake-db'
import { walkthroughState, detectPlatform, homeScreenHint, walkthroughDismissedAt, setWalkthroughDismissed } from '@/lib/onboarding'

describe('walkthroughState', () => {
  it('shows in full until she has dismissed it, leads or not', () => {
    expect(walkthroughState({ leadCount: 0, dismissedAt: null })).toBe('full')
    expect(walkthroughState({ leadCount: 12, dismissedAt: null })).toBe('full')
    expect(walkthroughState({ leadCount: 12, dismissedAt: undefined })).toBe('full')
  })
  it('folds to one line when dismissed with no leads yet', () => {
    expect(walkthroughState({ leadCount: 0, dismissedAt: '2026-11-03T20:00:00Z' })).toBe('collapsed')
  })
  it('is gone once dismissed and a lead exists', () => {
    expect(walkthroughState({ leadCount: 1, dismissedAt: '2026-11-03T20:00:00Z' })).toBe('hidden')
  })
})

describe('detectPlatform', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  it('tells an iPhone, an iPad posing as a Mac, and Android apart', () => {
    expect(detectPlatform(IPHONE)).toBe('ios')
    expect(detectPlatform(IPAD_AS_MAC, 5)).toBe('ios')
    expect(detectPlatform(ANDROID)).toBe('android')
  })
  it('calls a real Mac and an empty agent "other"', () => {
    expect(detectPlatform(MAC, 0)).toBe('other')
    expect(detectPlatform(null)).toBe('other')
  })
})

describe('homeScreenHint', () => {
  it('names the right gesture per phone', () => {
    expect(homeScreenHint('ios', false).steps.join(' ')).toMatch(/Share.*Add to Home Screen/)
    expect(homeScreenHint('android', false).steps.join(' ')).toMatch(/three-dot menu.*Add to Home screen/)
    const other = homeScreenHint('other', false).steps.join(' ')
    expect(other).toMatch(/iPhone/)
    expect(other).toMatch(/Android/)
  })
  it('is done when it already opens from the home screen', () => {
    expect(homeScreenHint('ios', true).done).toBe(true)
    expect(homeScreenHint('android', false).done).toBe(false)
  })
})

describe('walkthrough dismissal storage', () => {
  it('reads the timestamp from her row only', async () => {
    const { db, calls } = fakeDb((c: Call) => (c.table === 'artists' ? { data: { walkthrough_dismissed_at: '2026-11-03T20:00:00Z' } } : undefined))
    expect(await walkthroughDismissedAt(db, 'artist-1')).toBe('2026-11-03T20:00:00Z')
    expect(calls[0]).toMatchObject({ table: 'artists', op: 'select', filters: [['id', 'artist-1']] })
  })
  it('reads "never" when the column is missing (migration not applied) instead of failing', async () => {
    const { db } = fakeDb((c: Call) => (c.table === 'artists' ? { error: { message: 'column artists.walkthrough_dismissed_at does not exist' } } : undefined))
    expect(await walkthroughDismissedAt(db, 'artist-1')).toBeNull()
  })
  it('records the tap on her row, and clears it on the way back', async () => {
    const { db, calls } = fakeDb()
    const now = new Date('2026-11-03T21:15:00Z')
    expect(await setWalkthroughDismissed(db, 'artist-1', true, now)).toEqual({ ok: true, dismissedAt: '2026-11-03T21:15:00.000Z' })
    expect(await setWalkthroughDismissed(db, 'artist-1', false, now)).toEqual({ ok: true, dismissedAt: null })
    const ups = writes(calls, 'artists', 'update')
    expect(ups).toHaveLength(2)
    expect(ups[0].payload).toEqual({ walkthrough_dismissed_at: '2026-11-03T21:15:00.000Z' })
    expect(ups[0].filters).toEqual([['id', 'artist-1']])
    expect(ups[1].payload).toEqual({ walkthrough_dismissed_at: null })
    // Nothing but her artist row is touched: no lead, no message, no note.
    expect(calls.every((c) => c.table === 'artists')).toBe(true)
  })
  it('reports a write error instead of throwing', async () => {
    const { db } = fakeDb(() => ({ error: { message: 'nope' } }))
    expect(await setWalkthroughDismissed(db, 'artist-1', true)).toEqual({ ok: false, error: 'nope' })
  })
})
