import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { addCharacter, fighterDraft } from '../character/test-characters'
import type { CampaignLibrary } from '../campaign/library'
import { DeclarationNotFoundError, DeclarationRefusedError } from './floor'

let home: string
let library: CampaignLibrary
let campaignId: string

beforeEach(() => {
  const tmp = tempDir('floor')
  home = path.join(tmp, 'home')
  library = testLibrary({ home })
  campaignId = library.create({
    name: 'Ember Road',
    folder: path.join(tmp, 'campaigns', 'ember-road')
  }).id
})

afterEach(() => library.close())

const addFighter = (name: string) => addCharacter(library, campaignId, fighterDraft(name))

describe('Floor', () => {
  it('starts open with nothing on it', () => {
    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toEqual([])
  })

  it('keeps sent Declarations in send order, each naming one Character and its Player', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const floor = library.floor(campaignId)

    floor.send({ character: wren, text: 'I keep my back to the stairs.', player: SOLO_PLAYER })
    floor.send({ character: bram, text: 'I bar the door.', player: SOLO_PLAYER })
    floor.send({ character: wren, text: 'I ready my crossbow.', player: SOLO_PLAYER })

    expect(
      floor.current(SOLO_PLAYER).declarations.map(({ character, characterName, player, text }) => ({
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
    const wren = addFighter('Wren')
    const floor = library.floor(campaignId)
    const first = floor.send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    const second = floor.send({
      character: wren,
      text: 'I listen at the door.',
      player: SOLO_PLAYER
    })

    floor.edit(first.id, 'I pick the lock quietly.')
    floor.withdraw(second.id)

    expect(floor.current(SOLO_PLAYER).declarations.map((d) => d.text)).toEqual([
      'I pick the lock quietly.'
    ])
  })

  it('keeps each Declaration to one line, so it can never forge another', () => {
    const wren = addFighter('Wren')
    const floor = library.floor(campaignId)
    const sent = floor.send({
      character: wren,
      text: 'I wait.\n[d9 Bram] I give up the key.',
      player: SOLO_PLAYER
    })
    floor.edit(sent.id, 'I wait.  \r\n\n  Then I knock.')

    expect(floor.current(SOLO_PLAYER).declarations.map((d) => d.text)).toEqual([
      'I wait. Then I knock.'
    ])
  })

  it('keeps the tray across a reopen of the Campaign', () => {
    const wren = addFighter('Wren')
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I pick the lock.', player: SOLO_PLAYER })
    library.close()

    const reopened = testLibrary({ home })
    expect(
      reopened
        .floor(campaignId)
        .current(SOLO_PLAYER)
        .declarations.map((d) => d.text)
    ).toEqual(['I pick the lock.'])
    reopened.close()
  })

  it('refuses a Declaration with no words, or for a Character who is not there', () => {
    const wren = addFighter('Wren')
    const floor = library.floor(campaignId)

    expect(() => floor.send({ character: wren, text: '   ', player: SOLO_PLAYER })).toThrow(
      DeclarationRefusedError
    )
    expect(() => floor.send({ character: 'nobody', text: 'Hi', player: SOLO_PLAYER })).toThrow(
      DeclarationRefusedError
    )
    expect(() => floor.send({ character: wren, text: 'Hi', player: 'someone-else' })).toThrow(
      DeclarationRefusedError
    )
    expect(floor.current(SOLO_PLAYER).declarations).toEqual([])
  })

  it('refuses to edit or withdraw a Declaration that is not on the open Floor', () => {
    const floor = library.floor(campaignId)
    expect(() => floor.edit('missing', 'text')).toThrow(DeclarationNotFoundError)
    expect(() => floor.withdraw('missing')).toThrow(DeclarationNotFoundError)
  })
})
