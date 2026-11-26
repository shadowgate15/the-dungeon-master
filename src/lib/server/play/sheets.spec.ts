import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { playSheets } from './sheets'

let library: CampaignLibrary
let campaignId: string

beforeEach(() => {
  const tmp = tempDir('sheets')
  library = testLibrary({ home: path.join(tmp, 'home') })
  campaignId = library.create({ name: 'Ember Road', folder: path.join(tmp, 'ember-road') }).id
})

afterEach(() => library.close())

describe('play sheets', () => {
  it('are empty for a Party with no Characters', () => {
    expect(playSheets(library.party(campaignId))).toEqual([])
  })

  it('show a saved Fighter in play: HP, AC, abilities, attacks, slots, features and inventory', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))

    const [sheet] = playSheets(library.party(campaignId))

    expect(sheet).toMatchObject({
      id: wren,
      name: 'Wren',
      headline: 'Human Fighter 1',
      canAct: true,
      whereabouts: null,
      // Human +1 to every score on the standard array; CON 14 gives 10 + 2 HP.
      hp: { current: 12, max: 12, temp: 0 },
      ac: { value: 12, note: 'unarmored' },
      conditions: [],
      concentration: null
    })
    expect(sheet.abilities).toEqual([
      { key: 'str', score: 16, modifier: 3 },
      { key: 'dex', score: 15, modifier: 2 },
      { key: 'con', score: 14, modifier: 2 },
      { key: 'int', score: 13, modifier: 1 },
      { key: 'wis', score: 11, modifier: 0 },
      { key: 'cha', score: 9, modifier: -1 }
    ])
    expect(sheet.attacks.length).toBeGreaterThan(0)
    expect(sheet.spellSlots).toEqual([])
    expect(sheet.features.map((f) => f.name)).toContain('Second Wind')
    expect(sheet.inventory.length).toBeGreaterThan(0)
  })

  it('carry the details the Player edits in play: notes, personality, appearance and the backstory', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    library.party(campaignId).updateDetails(wren, {
      notes: 'Owes Tam a favour',
      personality: 'Wry',
      appearance: 'A scar over one eye'
    })

    const [sheet] = playSheets(library.party(campaignId))

    expect(sheet.details).toMatchObject({
      notes: 'Owes Tam a favour',
      personality: 'Wry',
      appearance: 'A scar over one eye'
    })
    expect(sheet.details).toHaveProperty('backstory')
  })
})
