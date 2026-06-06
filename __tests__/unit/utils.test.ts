import { formatPrice, cn } from '@/lib/utils'

describe('formatPrice', () => {
  it('formats cents as USD currency', () => {
    expect(formatPrice(150000)).toBe('$1,500.00')
    expect(formatPrice(25000)).toBe('$250.00')
    expect(formatPrice(99)).toBe('$0.99')
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('handles large values', () => {
    expect(formatPrice(1500000)).toBe('$15,000.00')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates tailwind classes (last wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'nope', 'yes')).toBe('base yes')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null as unknown as string)).toBe('base')
  })
})
