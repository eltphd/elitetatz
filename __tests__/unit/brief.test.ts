/**
 * @jest-environment node
 */
import { briefFollowUps, briefReferences, followUpLines, referenceLine, suggestedQuestion } from '@/lib/brief'

// The case this was built for: a return client sends large flowers on a thin
// arm and means "this style, tiny, as a sleeve". The photo, placement and
// size were all known; the reference's purpose and the scale were not.
const sleeve = {
  concept: 'botanical sleeve, small flowers',
  placement: 'upper arm',
  size: 'full sleeve, flowers about 1.5 inches each',
  has_reference: true,
  reference_keepers: [{ for: ['style', 'Density'], note: 'her peony from Instagram' }],
  scale_check: 'At 1.5 inches each the peonies read as soft shapes; the inner petal lines go.',
  scale_confirmed: false,
  open_questions: ['whether the flowers wrap to the inner arm or stay outer'],
  feasibility_flags: ['Extreme fine detail under 2": may blur with healing'],
}

describe('briefReferences', () => {
  it('reads keepers case-insensitively and keeps the note', () => {
    expect(briefReferences(sleeve)).toEqual([{ for: ['style', 'density'], note: 'her peony from Instagram' }])
  })
  it('keeps a keeper outside the six words as a note instead of dropping it', () => {
    expect(briefReferences({ reference_keepers: [{ for: ['mood'] }] })).toEqual([{ for: [], note: 'mood' }])
  })
  it('is empty for junk', () => {
    expect(briefReferences({ reference_keepers: 'yes' })).toEqual([])
    expect(briefReferences({ reference_keepers: [null, 3, {}] })).toEqual([])
    expect(briefReferences({})).toEqual([])
  })
})

describe('briefFollowUps', () => {
  it('orders open questions, then the unconfirmed scale, then feasibility', () => {
    expect(briefFollowUps(sleeve).map((f) => f.kind)).toEqual(['open', 'scale', 'feasibility'])
    expect(briefFollowUps(sleeve)[1].text).toContain('Scale not confirmed by the client')
  })
  it('drops the scale item once the client confirmed it', () => {
    expect(briefFollowUps({ ...sleeve, scale_confirmed: true }).map((f) => f.kind)).toEqual(['open', 'feasibility'])
  })
  it('asks for a scale check when there is a reference and none was run', () => {
    const [only] = briefFollowUps({ has_reference: true })
    expect(only.kind).toBe('scale')
    expect(only.text).toMatch(/before quoting/)
  })
  it('raises nothing without a reference', () => {
    expect(briefFollowUps({ has_reference: false, creative_freedom: true })).toEqual([])
  })
  it('accepts a single string where the model should have sent a list', () => {
    expect(briefFollowUps({ open_questions: 'color or black and grey' })).toEqual([{ kind: 'open', text: 'color or black and grey' }])
  })
})

describe('lines for the artist email', () => {
  it('labels each kind', () => {
    expect(followUpLines(sleeve)).toEqual([
      'Ask: whether the flowers wrap to the inner arm or stay outer',
      'Scale: Scale not confirmed by the client: "At 1.5 inches each the peonies read as soft shapes; the inner petal lines go."',
      'Note: Extreme fine detail under 2": may blur with healing',
    ])
  })
  it('summarises the references in one line', () => {
    expect(referenceLine(sleeve)).toBe('Ref 1: for style + density (her peony from Instagram)')
    expect(referenceLine({})).toBe('')
  })
})

describe('suggestedQuestion', () => {
  it('drafts a numbered More-info message from the open points, in her register', () => {
    const q = suggestedQuestion(sleeve)
    expect(q.startsWith('Hey! Quick thing before I quote this:')).toBe(true)
    expect(q).toContain('1. Can you tell me whether the flowers wrap to the inner arm or stay outer?')
    expect(q).toContain("2. Your reference will land a lot smaller once it's full sleeve, flowers about 1.5 inches each on the upper arm.")
    expect(q.endsWith("Once I have that I can get you a price and we'll set a time.")).toBe(true)
  })
  it('keeps a question the model already phrased as one', () => {
    expect(suggestedQuestion({ open_questions: ['Color or black and grey?'] })).toContain('\nColor or black and grey?\n')
  })
  it('is empty when nothing is open, so the button is not pre-filled', () => {
    expect(suggestedQuestion({ ...sleeve, open_questions: [], scale_confirmed: true })).toBe('')
    expect(suggestedQuestion({ feasibility_flags: ['x'] })).toBe('')
  })
})
