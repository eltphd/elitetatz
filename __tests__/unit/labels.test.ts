import { cleanLabel } from '@/lib/labels'

describe('cleanLabel', () => {
  it('keeps source labels short and plain', () => {
    expect(cleanLabel('Instagram_Story', 'direct')).toBe('instagram_story')
    expect(cleanLabel('<script>alert(1)</script>', 'direct')).toBe('scriptalert1script')
    expect(cleanLabel('', 'direct')).toBe('direct')
    expect(cleanLabel(undefined, 'rawsunart')).toBe('rawsunart')
    expect(cleanLabel('x'.repeat(200), 'direct')).toHaveLength(60)
  })
})
