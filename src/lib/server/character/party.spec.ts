import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { CharacterValidationError } from './service'
import { DraftNotFoundError } from './party'

let home: string
let root: string
let library: CampaignLibrary
let campaignId: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-party-'))
  home = path.join(tmp, 'home')
  root = path.join(tmp, 'campaigns')
  library = createCampaignLibrary({ home })
  campaignId = library.create({ name: 'Ember Road', folder: path.join(root, 'ember-road') }).id
})

afterEach(() => library.close())

/** A Human Fighter with the Acolyte background, every step answered. */
const fighter = (over: Partial<CharacterDraft> = {}): CharacterDraft => ({
  ...emptyDraft(),
  name: 'Brannoch',
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: {
    ...Object.fromEntries(
      [0, 1, 2, 3].map((i) => [`class/fighter/equipment-${i}`, { option: 0, wild: [] }])
    ),
    'background/acolyte/equipment-0': { option: 0, wild: ['amulet'] }
  },
  ...over
})

describe('Party', () => {
  it('is empty for a new Campaign', () => {
    expect(library.party(campaignId).list()).toEqual([])
  })

  it('keeps a draft with the Campaign, with its step, across a reopen', () => {
    const party = library.party(campaignId)
    const { id } = party.startDraft()
    party.writeDraft(id, { draft: { ...emptyDraft(), name: 'Wren' }, step: 'abilities' })
    library.close()

    const reopened = createCampaignLibrary({ home }).party(campaignId)
    expect(reopened.draft(id)).toMatchObject({
      id,
      step: 'abilities',
      controllingPlayer: 'player',
      draft: { name: 'Wren' }
    })
    expect(reopened.list()).toEqual([
      { kind: 'draft', id, name: 'Wren', step: 'abilities', stepLabel: 'Ability scores' }
    ])
  })

  it('refuses to save an incomplete draft and keeps it', () => {
    const party = library.party(campaignId)
    const { id } = party.startDraft()
    const incomplete = { ...fighter(), baseScores: { ...fighter().baseScores, cha: null } }

    expect(() => party.saveDraft(id, { draft: incomplete, step: 'review' })).toThrow(
      CharacterValidationError
    )
    expect(party.list()).toEqual([expect.objectContaining({ kind: 'draft', id })])
  })

  it('saves a complete draft into the Party and removes the draft', () => {
    const party = library.party(campaignId)
    const { id } = party.startDraft()

    const saved = party.saveDraft(id, { draft: fighter(), step: 'review' })

    expect(saved).toMatchObject({ name: 'Brannoch', campaignId, status: 'alive', currentHp: 12 })
    expect(party.list()).toEqual([
      expect.objectContaining({
        kind: 'character',
        id: saved.id,
        name: 'Brannoch',
        status: 'alive',
        description: 'Human Fighter, Acolyte'
      })
    ])
    expect(() => party.draft(id)).toThrow(DraftNotFoundError)
  })

  it('discards a draft', () => {
    const party = library.party(campaignId)
    const { id } = party.startDraft()
    party.discardDraft(id)
    expect(party.list()).toEqual([])
    expect(() => party.discardDraft(id)).toThrow(DraftNotFoundError)
  })

  it('edits a saved Character from its wizard draft', () => {
    const party = library.party(campaignId)
    const saved = party.saveDraft(party.startDraft().id, { draft: fighter(), step: 'review' })

    party.updateCharacter(saved.id, fighter({ name: 'Bran' }))

    expect(party.character(saved.id)).toMatchObject({ draft: { name: 'Bran' } })
  })

  it('saves a rolling Character with its dice', () => {
    const party = library.party(campaignId)
    const abilityRolls = [
      [6, 5, 3, 1],
      [6, 6, 6, 1],
      [4, 4, 4, 4],
      [3, 3, 2, 1],
      [5, 4, 4, 2],
      [2, 2, 2, 2]
    ]
    const draft = fighter({
      abilityMethod: 'rolling',
      abilityRolls,
      baseScores: { str: 18, dex: 14, con: 13, int: 12, wis: 8, cha: 6 }
    })

    const saved = party.saveDraft(party.startDraft().id, { draft, step: 'review' })

    expect(party.character(saved.id).character).toMatchObject({
      abilityMethod: 'roll',
      abilityRolls
    })
  })

  it('saves a Character with a custom background', () => {
    const party = library.party(campaignId)
    const picks = { ...fighter().picks }
    delete picks['background/acolyte/language-0']
    const draft = fighter({
      background: 'custom',
      customBackgroundName: 'Wanderer',
      customBackgroundFeature: 'You know the roads.',
      picks: {
        ...picks,
        'background/custom/skills-0': ['skill-arcana', 'skill-history'],
        'background/custom/toolsOrLanguages-0': ['thieves-tools', 'elvish']
      },
      equipment: Object.fromEntries(
        [0, 1, 2, 3].map((i) => [`class/fighter/equipment-${i}`, { option: 0, wild: [] }])
      )
    })

    const saved = party.saveDraft(party.startDraft().id, { draft, step: 'review' })

    expect(party.character(saved.id).character).toMatchObject({
      customBackgroundName: 'Wanderer',
      customBackgroundFeature: 'You know the roads.'
    })
  })
})
