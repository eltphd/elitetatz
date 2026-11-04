import { safeNext } from '@/lib/safe-next'

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/dashboard/payouts?connected=artist')).toBe('/dashboard/payouts?connected=artist')
  })

  it('refuses anything that leaves the site', () => {
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', '@evil.com', 'evil.com', '/\tevil']) {
      expect(safeNext(bad)).toBe('/dashboard')
    }
  })

  it('falls back to the inbox when empty, never the public page', () => {
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext('')).toBe('/dashboard')
    expect(safeNext('', '/auth/update-password')).toBe('/auth/update-password')
  })
})
