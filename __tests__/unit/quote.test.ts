import { readInches, suggestQuote } from '@/lib/quote'

describe('readInches', () => {
  it('reads inch figures in the forms clients write', () => {
    expect(readInches('about 4 inches')).toBe(4)
    expect(readInches('3"')).toBe(3)
    expect(readInches('5in')).toBe(5)
    expect(readInches('3-4 inches')).toBe(4)
    expect(readInches('6')).toBe(6)
  })
  it('falls back to words and placement', () => {
    expect(readInches('palm sized')).toBe(4.5)
    expect(readInches('tiny', 'wrist')).toBe(2)
    expect(readInches('', 'full sleeve')).toBe(14)
    expect(readInches('')).toBeNull()
  })
})

describe('suggestQuote', () => {
  it('lands a 4 inch watercolor forearm piece inside the $400–700 band, nudged up for color', () => {
    const q = suggestQuote({ concept: 'Watercolor peony', styles: ['watercolor'], placement: 'outer forearm', size: 'about 4 inches', budget_max_cents: 50000 })
    expect(q.sizeUnknown).toBe(false)
    expect(q.lowCents).toBe(25000)
    expect(q.highCents).toBe(40000)
    expect(q.cents).toBeGreaterThanOrEqual(q.lowCents)
    expect(q.cents).toBeLessThanOrEqual(q.highCents)
    expect(q.cents % 2500).toBe(0)
    expect(q.belowBudget).toBe(false)
    expect(q.reasons.some((r) => /color/i.test(r))).toBe(true)
  })
  it('uses the next band for 6 inches', () => {
    const q = suggestQuote({ concept: 'Floral band', size: '6 inches', placement: 'forearm' })
    expect(q.lowCents).toBe(40000)
    expect(q.highCents).toBe(70000)
  })
  it('says size is unknown and starts at the minimum', () => {
    const q = suggestQuote({ concept: 'A moth' })
    expect(q.sizeUnknown).toBe(true)
    expect(q.cents).toBe(25000)
    expect(q.reasons[0]).toMatch(/Size isn't in the brief/)
  })
  it('switches to hourly over 10 inches', () => {
    const q = suggestQuote({ concept: 'Back piece', size: 'full back' })
    expect(q.hourly).toBe(true)
    expect(q.reasons.some((r) => /\/hr/.test(r))).toBe(true)
  })
  it('flags a budget under the band', () => {
    const q = suggestQuote({ concept: 'Realism portrait', size: '8 inches', budget_max_cents: 30000 })
    expect(q.belowBudget).toBe(true)
    expect(q.reasons.some((r) => /budget/i.test(r))).toBe(true)
  })
  it('nudges lines-only down', () => {
    const color = suggestQuote({ concept: 'Wave', size: '3 inches', styles: ['color'] })
    const lines = suggestQuote({ concept: 'Wave', size: '3 inches', styles: ['lines only'] })
    expect(lines.cents).toBeLessThan(color.cents)
  })
})
