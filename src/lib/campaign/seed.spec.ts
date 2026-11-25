import { describe, expect, it } from 'vitest'
import {
  CampaignSeedError,
  emptyCampaignSeed,
  isCampaignSeedComplete,
  missingSeedFields,
  parseCampaignSeed,
  type CampaignSeedCard
} from './seed'

const complete: CampaignSeedCard = {
  ...emptyCampaignSeed(),
  name: 'Ember Road',
  premise: 'Escort a relic.',
  tone: 'tense',
  length: 'short'
}

describe('missingSeedFields', () => {
  it('names every required field of an empty Seed', () => {
    expect(missingSeedFields(emptyCampaignSeed())).toEqual(['name', 'premise', 'tone', 'length'])
  })

  it('is empty when Name, Premise, Tone and Length are set, whatever the optional fields', () => {
    expect(missingSeedFields(complete)).toEqual([])
    expect(isCampaignSeedComplete(complete)).toBe(true)
  })

  it.each([
    ['name', { name: '' }],
    ['name', { name: '   ' }],
    ['premise', { premise: ' ' }],
    ['tone', { tone: '' }],
    ['length', { length: '' }]
  ])('names %s when it is blank', (field, over) => {
    expect(missingSeedFields({ ...complete, ...over })).toEqual([field])
    expect(isCampaignSeedComplete({ ...complete, ...over })).toBe(false)
  })
})

describe('parseCampaignSeed', () => {
  it('trims text and stores blank optional fields as unset', () => {
    expect(parseCampaignSeed({ ...complete, name: '  Ember Road ', worldName: ' ' })).toEqual({
      name: 'Ember Road',
      premise: 'Escort a relic.',
      tone: 'tense',
      length: 'short',
      worldName: null,
      genreFlavor: null,
      scale: null,
      magicLevel: null,
      techLevel: null
    })
  })

  it('keeps an incomplete Seed, leaving its blanks unset', () => {
    expect(parseCampaignSeed({ ...emptyCampaignSeed(), name: 'Ember Road' })).toMatchObject({
      name: 'Ember Road',
      premise: null,
      tone: null,
      length: null
    })
  })

  it('keeps every optional World field', () => {
    const seed = {
      ...complete,
      worldName: 'Varn',
      genreFlavor: 'gothic horror',
      scale: 'continent',
      magicLevel: 'low',
      techLevel: 'medieval'
    }
    expect(parseCampaignSeed(seed)).toMatchObject({
      worldName: 'Varn',
      genreFlavor: 'gothic horror',
      scale: 'continent',
      magicLevel: 'low',
      techLevel: 'medieval'
    })
  })

  it.each([
    ['a blank name', { name: ' ' }, 'Name is required'],
    ['an over-long name', { name: 'x'.repeat(81) }, 'Name must be at most 80 characters'],
    ['an over-long premise', { premise: 'x'.repeat(2001) }, 'Premise must be at most 2000'],
    ['an unknown tone', { tone: 'grim' }, 'Invalid tone: grim'],
    ['an unknown length', { length: 'epic' }, 'Invalid length: epic'],
    ['an unknown scale', { scale: 'galaxy' }, 'Invalid scale: galaxy'],
    ['an over-long World name', { worldName: 'x'.repeat(81) }, 'World name must be at most 80']
  ])('rejects %s', (_label, over, message) => {
    expect(() => parseCampaignSeed({ ...complete, ...over })).toThrow(CampaignSeedError)
    expect(() => parseCampaignSeed({ ...complete, ...over })).toThrow(message)
  })
})
