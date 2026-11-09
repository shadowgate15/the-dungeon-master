import { describe, expect, it } from 'vitest'
import { emptyCampaignSeed, isCampaignSeedComplete } from './seed'

const complete = {
  name: 'Ember Road',
  premise: 'Escort a relic.',
  tone: 'tense',
  length: 'short',
  worldIds: ['w1']
}

describe('isCampaignSeedComplete', () => {
  it('is false for an empty seed', () => {
    expect(isCampaignSeedComplete(emptyCampaignSeed())).toBe(false)
  })

  it('is true when Worlds, Name, Premise, Tone and Length are all set', () => {
    expect(isCampaignSeedComplete(complete)).toBe(true)
  })

  it.each([
    ['name', { name: '' }],
    ['name (blank)', { name: '   ' }],
    ['premise', { premise: '' }],
    ['tone', { tone: '' }],
    ['length', { length: '' }],
    ['Worlds', { worldIds: [] }]
  ])('is false when %s is missing', (_label, over) => {
    expect(isCampaignSeedComplete({ ...complete, ...over })).toBe(false)
  })

  it('starts with the given Worlds pre-selected', () => {
    expect(emptyCampaignSeed(['w9']).worldIds).toEqual(['w9'])
  })
})
