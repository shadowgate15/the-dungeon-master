import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createDice } from '../dice'
import { createPlay, type Play } from '../play/play'
import { playSheets } from '../play/sheets'
import { gameTools } from '.'
import { createToolHost, type ToolHost } from './host'

/*
 * The rules that bite in a fight: Death saves at 0 HP, concentration, and reactions offered as
 * Calls. Every die is loaded, so each roll is one the test named.
 */

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]

let faces: [number, number][]
const loaded = createDice({
  random: () => {
    const next = faces.shift()
    if (!next) throw new Error('The loaded dice ran out')
    const [sides, face] = next
    return (face - 0.5) / sides
  }
})
const load = (...queue: [number, number][]) => faces.push(...queue)

beforeEach(() => {
  faces = []
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-fight-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  channels.listen(folder, (e) => heard.push(e))
  const publish = () => {}
  host = createToolHost({ library, tools: gameTools, publish, dice: () => loaded })
  play = createPlay({ library, channels, publish, dice: () => loaded })
})

afterEach(() => {
  library.close()
  expect(faces, 'every loaded die was rolled').toEqual([])
})

function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

function ok(name: string, args: unknown = {}) {
  const { isError, payload } = call(name, args)
  expect(isError, JSON.stringify(payload)).toBe(false)
  return payload
}

/** Wren: a Human Fighter, 12 HP, Con 14 with the Human bonus; proficient in Con saves (+4). */
const addWren = () => addCharacter(library, campaignId, fighterDraft('Wren'))

const sheet = (name: string) => playSheets(library.party(campaignId)).find((s) => s.name === name)!
const status = (name: string) => {
  const member = library
    .party(campaignId)
    .list()
    .find((m) => m.name === name)
  return member?.kind === 'character' ? member.status : null
}
const timeline = () => play.timeline(campaignId)

describe('a Character at 0 HP', () => {
  it('falls Unconscious, cannot act, and starts with no Death save tallies', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 15, type: 'slashing' })

    expect(sheet('Wren')).toMatchObject({
      hp: { current: 0 },
      conditions: ['unconscious'],
      canAct: false,
      deathSaves: { successes: 0, failures: 0, stable: false }
    })
    expect(status('Wren')).toBe('alive')
  })

  it('takes a Death save failure from damage at 0, and two from a critical hit', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    ok('damage', { target: 'char:wren', amount: 2, type: 'slashing' })
    expect(sheet('Wren').deathSaves).toMatchObject({ failures: 1 })

    ok('damage', { target: 'char:wren', amount: 2, type: 'slashing', crit: true })
    expect(status('Wren')).toBe('dead')
  })

  it('dies outright when the damage left over at 0 reaches its HP maximum', () => {
    addWren()
    const result = ok('damage', { target: 'char:wren', amount: 24, type: 'bludgeoning' })
    expect(status('Wren')).toBe('dead')
    expect(result.notes).toContain('Wren dies outright (instant death)')
  })

  it('dies from damage at 0 that reaches its HP maximum', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    expect(status('Wren')).toBe('dead')
  })

  it('is healed back up: conscious, tallies cleared', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    ok('damage', { target: 'char:wren', amount: 1, type: 'slashing' })
    ok('heal', { target: 'char:wren', amount: 3 })
    expect(sheet('Wren')).toMatchObject({
      hp: { current: 3 },
      conditions: [],
      canAct: true,
      deathSaves: null
    })
  })
})

/** Rolls every open initiative part in order, one d20 face each. */
function rollInitiative(id: string, ...d20s: number[]) {
  for (const [i, part] of timeline().call!.parts.entries()) {
    load([20, d20s[i]])
    play.roll(campaignId, id, part.id)
  }
}

/**
 * Wren and one goblin, Wren first (20 to the goblin's 17). Wren is dropped to 0 HP, the goblin's
 * turn passes, and round 2 comes back to Wren. Returns `next_turn`'s result on Wren's turn.
 */
function downedOnTheirTurn() {
  addWren()
  load([20, 15])
  const { pending_call: id } = ok('start_combat', {
    combatants: ['char:wren', { monster: 'monster:goblin' }]
  })
  ok('narrate', { text: 'Roll for initiative!', call: id })
  rollInitiative(id, 18)
  ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
  ok('next_turn')
  heard = []
  return ok('next_turn')
}

/** Attaches and rolls the Death save Call `next_turn` returned, with one d20 face. */
function deathSave(turn: { pending_call: string }, face: number) {
  ok('narrate', { text: 'Wren lies still.', call: turn.pending_call })
  const open = timeline().call!
  load([20, face])
  play.roll(campaignId, open.id, open.parts[0].id)
}

describe('a Death save', () => {
  it("is a Call on the downed Character's Combat turn, addressed to them alone", () => {
    const turn = downedOnTheirTurn()
    expect(turn.turn).toMatchObject({ handle: 'char:wren' })
    ok('narrate', { text: 'Wren lies still.', call: turn.pending_call })
    expect(timeline().call).toMatchObject({
      kind: 'death_save',
      parts: [{ character: 'Wren', label: 'Death save', answered: false }]
    })
  })

  it('succeeds on 10 or more and fails below, a d20 with no modifier', () => {
    deathSave(downedOnTheirTurn(), 10)
    expect(sheet('Wren').deathSaves).toEqual({ successes: 1, failures: 0, stable: false })
    expect(heard[0].content).toContain('[Wren · player] Death save: d20 10 → success')

    deathSave(ok('next_turn') && ok('next_turn'), 9)
    expect(sheet('Wren').deathSaves).toEqual({ successes: 1, failures: 1, stable: false })
  })

  it('counts a natural 1 as two failures', () => {
    deathSave(downedOnTheirTurn(), 1)
    expect(sheet('Wren').deathSaves).toMatchObject({ failures: 2 })
  })

  it('regains 1 HP on a natural 20, waking the Character', () => {
    deathSave(downedOnTheirTurn(), 20)
    expect(sheet('Wren')).toMatchObject({
      hp: { current: 1 },
      conditions: [],
      canAct: true,
      deathSaves: null
    })
  })

  it('stabilizes on three successes: no more Death saves', () => {
    deathSave(downedOnTheirTurn(), 12)
    deathSave(ok('next_turn') && ok('next_turn'), 15)
    deathSave(ok('next_turn') && ok('next_turn'), 11)
    expect(sheet('Wren').deathSaves).toEqual({ successes: 0, failures: 0, stable: true })
    expect(heard.at(-1)!.content).toContain('stable')

    ok('next_turn')
    expect(ok('next_turn').pending_call).toBeUndefined()
  })

  it('kills on three failures', () => {
    deathSave(downedOnTheirTurn(), 5)
    deathSave(ok('next_turn') && ok('next_turn'), 1)
    expect(status('Wren')).toBe('dead')
    expect(heard.at(-1)!.content).toContain('dies')
  })
})

describe('an NPC or Creature at 0 HP', () => {
  const addGrik = () =>
    ok('establish', { type: 'npc', name: 'Grik', fields: { stat_block: 'monster:goblin' } })
      .handle as string

  it('dies: an NPC is marked dead', () => {
    const grik = addGrik()
    expect(ok('damage', { target: grik, amount: 9, type: 'fire' }).notes).toEqual(['Grik dies'])
    expect(ok('open', { handle: grik }).fields).toMatchObject({ status: 'dead' })
  })

  it('is knocked out instead when the DM rules it', () => {
    const grik = addGrik()
    const hit = ok('damage', { target: grik, amount: 9, type: 'bludgeoning', knock_out: true })
    expect(hit.notes).toEqual(['Grik is knocked out'])
    expect(ok('open', { handle: grik }).fields.status).not.toBe('dead')
  })

  it('dies: a Creature in the Combat too', () => {
    addWren()
    load([20, 15])
    ok('start_combat', { combatants: ['char:wren', { monster: 'monster:goblin' }] })
    expect(
      ok('damage', { target: 'creature:goblin-1', amount: 7, type: 'piercing' }).notes
    ).toEqual(['Goblin 1 dies'])
  })
})
