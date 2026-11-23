import { describe, expect, it } from 'vitest'
import { emptyCampaignSeed, isCampaignSeedComplete } from './seed'

const complete = {
  name: 'Ember Road',
  premise: 'Escort a relic.',
  tone: 'tense',
  length: 'short'
}

describe('isCampaignSeedComplete', () => {
  it('is false for an empty seed', () => {
    expect(isCampaignSeedComplete(emptyCampaignSeed())).toBe(false)
  })

  it('is true when Name, Premise, Tone and Length are all set', () => {
    expect(isCampaignSeedComplete(complete)).toBe(true)
  })

  it.each([
    ['name', { name: '' }],
    ['name (blank)', { name: '   ' }],
    ['premise', { premise: '' }],
    ['tone', { tone: '' }],
    ['length', { length: '' }]
  ])('is false when %s is missing', (_label, over) => {
    expect(isCampaignSeedComplete({ ...complete, ...over })).toBe(false)
  })
})
