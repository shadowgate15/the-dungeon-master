import { describe, expect, it } from 'vitest'
import { examineText, goText, talkText } from './affordances.ts'

describe('pre-fill text', () => {
  it('words each affordance as a Declaration', () => {
    expect(talkText({ name: 'Marta' })).toBe('I talk to Marta.')
    expect(goText({ name: 'the road' })).toBe('I head to the road.')
    expect(examineText('a muddy ledger')).toBe('I examine a muddy ledger.')
  })
})
