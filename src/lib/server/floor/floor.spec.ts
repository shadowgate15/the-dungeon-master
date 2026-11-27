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

    floor.edit(first.id, 'I pick the lock quietly.', SOLO_PLAYER)
    floor.withdraw(second.id, SOLO_PLAYER)

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
    floor.edit(sent.id, 'I wait.  \r\n\n  Then I knock.', SOLO_PLAYER)

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
    expect(() => floor.edit('missing', 'text', SOLO_PLAYER)).toThrow(DeclarationNotFoundError)
    expect(() => floor.withdraw('missing', SOLO_PLAYER)).toThrow(DeclarationNotFoundError)
  })

  describe('as several browsers see it', () => {
    const GUEST = 'guest-browser'

    /** Wren and Ash are the Host's, Bram the guest's, Tamsin unclaimed; all in the Scene. */
    function table() {
      const party = library.party(campaignId)
      const wren = addFighter('Wren')
      const ash = addFighter('Ash')
      const bram = addFighter('Bram')
      const tamsin = addFighter('Tamsin')
      party.letGo(bram, SOLO_PLAYER)
      party.claim(bram, GUEST)
      party.letGo(tamsin, SOLO_PLAYER)
      return { wren, ash, bram, tamsin }
    }

    it("returns every open Declaration marked as the viewer's own or not", () => {
      const { wren, bram } = table()
      const floor = library.floor(campaignId)
      floor.send({ character: wren, text: 'I bar the door.', player: SOLO_PLAYER })
      floor.send({ character: bram, text: 'I draw steel.', player: GUEST })

      expect(floor.current(SOLO_PLAYER).declarations.map((d) => [d.text, d.own])).toEqual([
        ['I bar the door.', true],
        ['I draw steel.', false]
      ])
      expect(floor.current(GUEST).declarations.map((d) => [d.text, d.own])).toEqual([
        ['I bar the door.', false],
        ['I draw steel.', true]
      ])
    })

    it('names each browser by its in-Scene Characters with its deciding or Done state', () => {
      table()
      const floor = library.floor(campaignId)
      floor.done(SOLO_PLAYER)

      expect(floor.current(SOLO_PLAYER).browsers).toEqual([
        {
          own: true,
          characters: [
            expect.objectContaining({ name: 'Wren' }),
            expect.objectContaining({ name: 'Ash' })
          ],
          done: true
        },
        { own: false, characters: [expect.objectContaining({ name: 'Bram' })], done: false }
      ])
      expect(floor.current(GUEST).browsers.map((b) => b.own)).toEqual([false, true])
    })

    it('lists the unclaimed Characters in the Scene, who sit out', () => {
      table()
      expect(
        library
          .floor(campaignId)
          .current(GUEST)
          .unclaimed.map((c) => c.name)
      ).toEqual(['Tamsin'])
    })

    it("refuses to edit or withdraw another browser's Declaration", () => {
      const { bram } = table()
      const floor = library.floor(campaignId)
      const theirs = floor.send({ character: bram, text: 'I draw steel.', player: GUEST })

      expect(() => floor.edit(theirs.id, 'I flee.', SOLO_PLAYER)).toThrow(DeclarationRefusedError)
      expect(() => floor.withdraw(theirs.id, SOLO_PLAYER)).toThrow(DeclarationRefusedError)
      expect(floor.current(GUEST).declarations.map((d) => d.text)).toEqual(['I draw steel.'])

      floor.edit(theirs.id, 'I stand firm.', GUEST)
      floor.withdraw(theirs.id, GUEST)
      expect(floor.current(GUEST).declarations).toEqual([])
    })
  })
})
