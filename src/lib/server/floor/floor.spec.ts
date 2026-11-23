import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { DeclarationNotFoundError, DeclarationRefusedError } from './floor'

let home: string
let library: CampaignLibrary
let campaignId: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-floor-'))
  home = path.join(tmp, 'home')
  library = createCampaignLibrary({ home })
  campaignId = library.create({
    name: 'Ember Road',
    folder: path.join(tmp, 'campaigns', 'ember-road')
  }).id
})

afterEach(() => library.close())

/** A Human Fighter with every wizard step answered. */
const fighter = (name: string): CharacterDraft => ({
  ...emptyDraft(),
  name,
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
  }
})

function addCharacter(name: string) {
  const party = library.party(campaignId)
  const { id } = party.startDraft()
  return party.saveDraft(id, { draft: fighter(name), step: 'review' }).id
}

describe('Floor', () => {
  it('starts open with nothing on it', () => {
    expect(library.floor(campaignId).current().declarations).toEqual([])
  })

  it('keeps sent Declarations in send order, each naming one Character and its Player', () => {
    const wren = addCharacter('Wren')
    const bram = addCharacter('Bram')
    const floor = library.floor(campaignId)

    floor.send({ character: wren, text: 'I keep my back to the stairs.' })
    floor.send({ character: bram, text: 'I bar the door.' })
    floor.send({ character: wren, text: 'I ready my crossbow.' })

    expect(
      floor.current().declarations.map(({ character, characterName, player, text }) => ({
        character,
        characterName,
        player,
        text
      }))
    ).toEqual([
      {
        character: wren,
        characterName: 'Wren',
        player: SOLO_PLAYER,
        text: 'I keep my back to the stairs.'
      },
      { character: bram, characterName: 'Bram', player: SOLO_PLAYER, text: 'I bar the door.' },
      { character: wren, characterName: 'Wren', player: SOLO_PLAYER, text: 'I ready my crossbow.' }
    ])
  })

  it('edits and withdraws a pending Declaration', () => {
    const wren = addCharacter('Wren')
    const floor = library.floor(campaignId)
    const first = floor.send({ character: wren, text: 'I pick the lock.' })
    const second = floor.send({ character: wren, text: 'I listen at the door.' })

    floor.edit(first.id, 'I pick the lock quietly.')
    floor.withdraw(second.id)

    expect(floor.current().declarations.map((d) => d.text)).toEqual(['I pick the lock quietly.'])
  })

  it('keeps the tray across a reopen of the Campaign', () => {
    const wren = addCharacter('Wren')
    library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
    library.close()

    const reopened = createCampaignLibrary({ home })
    expect(
      reopened
        .floor(campaignId)
        .current()
        .declarations.map((d) => d.text)
    ).toEqual(['I pick the lock.'])
    reopened.close()
  })

  it('refuses a Declaration with no words, or for a Character who is not there', () => {
    const wren = addCharacter('Wren')
    const floor = library.floor(campaignId)

    expect(() => floor.send({ character: wren, text: '   ' })).toThrow(DeclarationRefusedError)
    expect(() => floor.send({ character: 'nobody', text: 'Hi' })).toThrow(DeclarationRefusedError)
    expect(() => floor.send({ character: wren, text: 'Hi', player: 'someone-else' })).toThrow(
      DeclarationRefusedError
    )
    expect(floor.current().declarations).toEqual([])
  })

  it('refuses to edit or withdraw a Declaration that is not on the open Floor', () => {
    const floor = library.floor(campaignId)
    expect(() => floor.edit('missing', 'text')).toThrow(DeclarationNotFoundError)
    expect(() => floor.withdraw('missing')).toThrow(DeclarationNotFoundError)
  })
})
