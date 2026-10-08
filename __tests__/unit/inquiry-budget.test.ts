import { parseBudget } from '@/lib/inquiry'

describe('parseBudget', () => {
  it('reads a range from the rawsunart.com budget options', () => {
    expect(parseBudget('$400–$700')).toEqual({ budget_min_cents: 40000, budget_max_cents: 70000 })
    expect(parseBudget('$700–$1,200')).toEqual({ budget_min_cents: 70000, budget_max_cents: 120000 })
  })
  it('reads an open-ended top option', () => {
    expect(parseBudget('$1,200+')).toEqual({ budget_min_cents: 120000, budget_max_cents: 120000 })
  })
  it('leaves "Not sure" and blanks empty', () => {
    expect(parseBudget('Not sure')).toEqual({})
    expect(parseBudget('')).toEqual({})
  })
})
