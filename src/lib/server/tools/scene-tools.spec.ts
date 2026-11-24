import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-scene-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools })
})

afterEach(() => library.close())

function payload(result: ToolResult) {
  return JSON.parse(result.content[0].text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return payload(result)
}

function refused(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError, result.content[0]?.text).toBe(true)
  return payload(result)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('advance_time', () => {
  it('moves the clock from the Campaign start and stamps later Events with it', () => {
    expect(ok('advance_time', { hours: 2, minutes: 20 })).toMatchObject({
      minute: 140,
      clock: 'day 1, 10:20'
    })
    expect(ok('advance_time', { days: 2 })).toMatchObject({ minute: 3020, clock: 'day 3, 10:20' })
    ok('advance_time', { minutes: 1 })

    expect(host.events(folder).map((e) => e.minute)).toEqual([0, 140, 3020])
  })

  it('jumps to a clock time and never moves backwards', () => {
    expect(ok('advance_time', { to: 'day 3, 14:20' })).toMatchObject({ minute: 3260 })
    const back = refused('advance_time', { to: 'day 2, 09:00' })
    expect(back).toMatchObject({ code: 'clock_backwards' })
    expect(refused('advance_time', { minutes: -5 })).toMatchObject({ code: 'invalid_input' })
    expect(host.events(folder)).toHaveLength(1)
  })
})

const addFighter = (name: string) => addCharacter(library, campaignId, fighterDraft(name))

/** Two Places joined by a door, plus a Place nothing leads to yet. */
function establishHarbour() {
  ok('establish', { type: 'place', name: 'The Docks', fields: { exits: [] } })
  ok('establish', {
    type: 'place',
    name: 'Drowned Lantern',
    fields: { exits: [{ name: 'cellar stair' }, { name: 'front door', to: 'place:the-docks' }] }
  })
  ok('establish', { type: 'place', name: 'Cellar', fields: {} })
}

describe('move and set_scene', () => {
  it('refuses a Scene at a Place where no Character is', () => {
    addFighter('Wren')
    establishHarbour()
    expect(refused('set_scene', { place: 'place:the-docks' })).toMatchObject({
      code: 'nobody_there'
    })
  })

  it('works out who is present from whereabouts', () => {
    addFighter('Wren')
    addFighter('Bram')
    establishHarbour()
    ok('establish', {
      type: 'npc',
      name: 'Marrow',
      fields: { role: 'fence', description: 'A wary fence', whereabouts: 'place:drowned-lantern' }
    })
    ok('move', { who: ['char:wren', 'char:bram'], to: 'place:drowned-lantern' })
    expect(ok('set_scene', { place: 'place:drowned-lantern' })).toMatchObject({
      scene: { handle: 'place:drowned-lantern', name: 'Drowned Lantern' },
      present: {
        characters: [{ handle: 'char:wren' }, { handle: 'char:bram' }],
        npcs: [{ handle: 'npc:marrow', name: 'Marrow', role: 'fence', description: 'A wary fence' }]
      }
    })

    ok('move', { who: ['char:bram', 'npc:marrow'], to: 'place:the-docks' })
    expect(ok('scene')).toMatchObject({
      scene: { handle: 'place:drowned-lantern' },
      clock: 'day 1, 08:00',
      present: { characters: [{ handle: 'char:wren', name: 'Wren' }], npcs: [] },
      elsewhere: [{ handle: 'char:bram', name: 'Bram', whereabouts: 'place:the-docks' }]
    })
  })

  it('refuses a move to something that is not a Place', () => {
    addFighter('Wren')
    expect(refused('move', { who: ['char:wren'], to: 'place:nowhere' })).toMatchObject({
      code: 'unknown_handle'
    })
    expect(refused('move', { who: ['char:nobody'], to: 'place:nowhere' })).toMatchObject({
      code: 'unknown_handle'
    })
  })
})

describe('exits', () => {
  it('fixes an open exit to where the first traversal went, for good', () => {
    addFighter('Wren')
    establishHarbour()
    ok('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    expect(refused('move', { who: ['char:wren'], via: 'cellar stair' })).toMatchObject({
      code: 'invalid_input'
    })

    const first = ok('move', { who: ['char:wren'], via: 'cellar stair', to: 'place:cellar' })
    expect(first.fixed).toEqual({
      place: 'place:drowned-lantern',
      exit: 'cellar stair',
      to: 'place:cellar',
      version: 2
    })
    expect(ok('open', { handle: 'place:drowned-lantern' })).toMatchObject({
      version: 2,
      fields: {
        exits: [
          { name: 'cellar stair', to: 'place:cellar' },
          { name: 'front door', to: 'place:the-docks' }
        ]
      }
    })

    ok('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    expect(
      refused('move', { who: ['char:wren'], via: 'cellar stair', to: 'place:the-docks' })
    ).toMatchObject({ code: 'invalid_input' })
    expect(ok('move', { who: ['char:wren'], via: 'Cellar Stair' })).toMatchObject({
      to: { handle: 'place:cellar' },
      fixed: null
    })
  })
})

describe('a cut with drafts open', () => {
  it("returns drafts for Characters who left the Scene to their Player's composer", () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    establishHarbour()
    ok('move', { who: ['char:wren', 'char:bram'], to: 'place:drowned-lantern' })
    ok('set_scene', { place: 'place:drowned-lantern' })
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I check the cellar door.' })
    floor.send({ character: bram, text: 'I slip out to the docks.' })

    ok('move', { who: ['char:bram'], via: 'front door' })
    expect(ok('set_scene', { place: 'place:the-docks' })).toMatchObject({ returned: 1 })

    const after = library.floor(campaignId).current()
    expect(after.declarations).toMatchObject([{ characterName: 'Bram' }])
    expect(after.returned).toEqual([
      {
        id: expect.any(String),
        character: wren,
        characterName: 'Wren',
        text: 'I check the cellar door.'
      }
    ])

    library.floor(campaignId).clearReturned(after.returned[0].id)
    expect(library.floor(campaignId).current().returned).toEqual([])
  })

  it('refuses a Declaration for a Character outside the Scene', () => {
    addFighter('Wren')
    const bram = addFighter('Bram')
    establishHarbour()
    ok('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    ok('move', { who: ['char:bram'], to: 'place:the-docks' })
    ok('set_scene', { place: 'place:drowned-lantern' })
    expect(() => library.floor(campaignId).send({ character: bram, text: 'I wave.' })).toThrow(
      /not in the Scene/
    )
  })
})
