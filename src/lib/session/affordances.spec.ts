import { describe, expect, it } from 'vitest'
import { examineText, goText, parseAffordances, talkText } from './affordances.ts'

describe('pre-fill text', () => {
  it('words each affordance as a player action', () => {
    expect(talkText({ name: 'Marta' })).toBe('I talk to Marta.')
    expect(goText({ name: 'the road' })).toBe('I head to the road.')
    expect(examineText('a muddy ledger')).toBe('I examine a muddy ledger.')
  })
})

describe('parseAffordances', () => {
  it('defaults to on and only an explicit off turns it off', () => {
    expect(parseAffordances(undefined)).toBe(true)
    expect(parseAffordances('on')).toBe(true)
    expect(parseAffordances('garbage')).toBe(true)
    expect(parseAffordances('off')).toBe(false)
  })
})
