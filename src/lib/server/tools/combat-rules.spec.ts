import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft, wizardDraft } from '../character/test-characters'
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-combat-rules-'))
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

function refused(name: string, args: unknown = {}) {
  const { isError, payload } = call(name, args)
  expect(isError, JSON.stringify(payload)).toBe(true)
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

/** Attaches and rolls the Death save Call `next_turn` returned, with one d20 face (none: no roll). */
function deathSave(turn: { pending_call: string }, face?: number) {
  ok('narrate', { text: 'Wren lies still.', call: turn.pending_call })
  const open = timeline().call!
  if (face !== undefined) load([20, face])
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

  it('changes nothing once the Character was healed after the Call opened', () => {
    const turn = downedOnTheirTurn()
    ok('heal', { target: 'char:wren', amount: 6 })
    deathSave(turn)
    expect(sheet('Wren')).toMatchObject({ hp: { current: 6 }, deathSaves: null })
    expect(timeline().call).toBeNull()
    expect(heard.at(-1)!.content).toContain('no longer dying')
  })

  it('changes nothing once the Character died after the Call opened', () => {
    const turn = downedOnTheirTurn()
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    expect(status('Wren')).toBe('dead')
    deathSave(turn)
    expect(status('Wren')).toBe('dead')
    expect(sheet('Wren').deathSaves).toBeNull()
    expect(heard.at(-1)!.content).toContain('no longer dying')
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

  it('wakes when healed above 0 after a knock-out', () => {
    const grik = addGrik()
    ok('damage', { target: grik, amount: 9, type: 'bludgeoning', knock_out: true })
    ok('heal', { target: grik, amount: 2 })
    expect(ok('add_condition', { target: grik, condition: 'prone' }).conditions).toEqual(['prone'])
  })

  it('cannot be healed once dead', () => {
    const grik = addGrik()
    ok('damage', { target: grik, amount: 9, type: 'fire' })
    expect(refused('heal', { target: grik, amount: 5 })).toMatchObject({ code: 'npc_dead' })
  })

  it('loses its turns once dead', () => {
    addWren()
    load([20, 15], [20, 10])
    const { pending_call: id } = ok('start_combat', {
      combatants: ['char:wren', { monster: 'monster:goblin', count: 2 }]
    })
    ok('narrate', { text: 'Roll for initiative!', call: id })
    rollInitiative(id, 18)
    // Wren 20, Goblin 1 17, Goblin 2 12.
    ok('damage', { target: 'creature:goblin-1', amount: 7, type: 'piercing' })
    expect(ok('next_turn')).toMatchObject({ turn: { handle: 'creature:goblin-2' } })
    expect(ok('next_turn')).toMatchObject({ round: 2, turn: { handle: 'char:wren' } })
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

/**
 * Ash: a High Elf Wizard, 7 HP, Con 13 (Con save +1), knowing detect magic and fog cloud, both
 * concentration spells, with two 1st-level slots.
 */
const addAsh = () => {
  const draft = wizardDraft('Ash')
  draft.classSpells = draft.classSpells.map((s) => (s === 'alarm' ? 'fog-cloud' : s))
  return addCharacter(library, campaignId, draft)
}

/** Myrrh: a mage NPC (40 HP, Con save +0) who casts fly and greater invisibility. */
const addMyrrh = () =>
  ok('establish', { type: 'npc', name: 'Myrrh', fields: { stat_block: 'monster:mage' } })
    .handle as string

describe('concentration', () => {
  it('links the caster to the spell, and a second concentration spell ends the first', () => {
    addAsh()
    expect(ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })).toMatchObject({
      concentration: 'detect-magic'
    })
    expect(sheet('Ash').concentration).toBe('detect-magic')

    const second = ok('cast', { caster: 'char:ash', spell: 'fog-cloud', level: 1 })
    expect(second).toMatchObject({
      concentration: 'fog-cloud',
      ended_concentration: 'detect-magic'
    })
    expect(sheet('Ash').concentration).toBe('fog-cloud')
  })

  it('does the same for an NPC caster', () => {
    const myrrh = addMyrrh()
    ok('cast', { caster: myrrh, spell: 'fly', level: 3 })
    expect(ok('cast', { caster: myrrh, spell: 'greater-invisibility', level: 4 })).toMatchObject({
      concentration: 'greater-invisibility',
      ended_concentration: 'fly'
    })
  })

  it("rolls an NPC's Constitution save at once: DC 10, or half the damage when that is higher", () => {
    const myrrh = addMyrrh()
    ok('cast', { caster: myrrh, spell: 'fly', level: 3 })

    load([20, 10])
    expect(ok('damage', { target: myrrh, amount: 6, type: 'fire' }).notes).toEqual([
      'Myrrh Constitution save to keep concentration: d20 10 + 0 = 10 vs DC 10 → success'
    ])

    load([20, 11])
    expect(ok('damage', { target: myrrh, amount: 24, type: 'fire' }).notes).toEqual([
      'Myrrh Constitution save to keep concentration: d20 11 + 0 = 11 vs DC 12 → failure; concentration on fly ends'
    ])
    expect(
      ok('cast', { caster: myrrh, spell: 'fly', level: 3 }).ended_concentration
    ).toBeUndefined()
  })

  it("gives a Character's Player the Constitution save as a Call", () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    const hit = ok('damage', { target: 'char:ash', amount: 3, type: 'piercing' })
    expect(hit.concentration_calls).toHaveLength(1)

    ok('narrate', { text: 'The bolt bites.', call: hit.concentration_calls[0] })
    const open = timeline().call!
    expect(open).toMatchObject({
      kind: 'concentration',
      parts: [{ character: 'Ash', label: 'Constitution save' }]
    })
    load([20, 8])
    play.roll(campaignId, open.id, open.parts[0].id)
    expect(heard[0].content).toContain(
      '[Ash · player] Constitution save: d20 8 + 1 = 9 vs DC 10 → failure; concentration on detect-magic ends'
    )
    expect(sheet('Ash').concentration).toBeNull()
  })

  it('keeps a second save pending past the turn, for the next turn to attach', () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    const [first] = ok('damage', {
      target: 'char:ash',
      amount: 1,
      type: 'piercing'
    }).concentration_calls
    const [second] = ok('damage', {
      target: 'char:ash',
      amount: 1,
      type: 'fire'
    }).concentration_calls
    ok('narrate', { text: 'Two bolts bite.', call: first })

    expect(play.stopCheck(campaignId, false)).toEqual({ block: false })
    expect(timeline().entries.some((e) => e.type === 'error')).toBe(false)

    const open = timeline().call!
    load([20, 15])
    play.roll(campaignId, open.id, open.parts[0].id)
    expect(heard.at(-1)!.content).toContain(`Pending Calls to attach: ${second}`)
    ok('narrate', { text: 'Ash holds on.', call: second })
    expect(timeline().call).toMatchObject({ kind: 'concentration' })
  })

  it('keeps concentration on a successful save', () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    const hit = ok('damage', { target: 'char:ash', amount: 3, type: 'piercing' })
    ok('narrate', { text: 'The bolt bites.', call: hit.concentration_calls[0] })
    const open = timeline().call!
    load([20, 9])
    play.roll(campaignId, open.id, open.parts[0].id)
    expect(sheet('Ash').concentration).toBe('detect-magic')
  })

  it('ends when the caster is incapacitated by a condition', () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    expect(ok('add_condition', { target: 'char:ash', condition: 'stunned' })).toMatchObject({
      ended_concentration: 'detect-magic'
    })
    expect(sheet('Ash').concentration).toBeNull()
  })

  it('survives a condition that does not incapacitate', () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    ok('add_condition', { target: 'char:ash', condition: 'prone' })
    expect(sheet('Ash').concentration).toBe('detect-magic')
  })

  it('ends when the caster falls Unconscious, with no save', () => {
    addAsh()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    const hit = ok('damage', { target: 'char:ash', amount: 7, type: 'piercing' })
    expect(hit.concentration_calls).toBeUndefined()
    expect(sheet('Ash').concentration).toBeNull()
  })

  it("asks for the save when an NPC's attack hits a concentrating Character", () => {
    addAsh()
    const grik = ok('establish', {
      type: 'npc',
      name: 'Grik',
      fields: { stat_block: 'monster:goblin' }
    }).handle as string
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })

    load([20, 15], [6, 2])
    const attack = ok('attack', { actor: grik, target: 'char:ash', with: 'scimitar' })
    expect(attack.concentration_calls).toHaveLength(1)
    expect(attack.rolled).toContain(
      'Ash must make a Constitution save (DC 10) to keep concentration on detect-magic'
    )
  })
})

describe('a reaction', () => {
  const addGrik = () =>
    ok('establish', { type: 'npc', name: 'Grik', fields: { stat_block: 'monster:goblin' } })
      .handle as string

  /** Offers Wren an opportunity attack on Grik and attaches it; returns the open Call. */
  function offered() {
    addWren()
    const grik = addGrik()
    const { pending_call: id } = ok('offer_reaction', {
      character: 'char:wren',
      reaction: 'opportunity attack',
      attack: { target: grik, with: 'crossbow' }
    })
    ok('narrate', { text: 'Grik bolts past Wren.', call: id })
    return { grik, open: timeline().call! }
  }

  it('is a Call the Player can take or pass, out of turn', () => {
    const { open } = offered()
    expect(open).toMatchObject({
      kind: 'reaction',
      text: 'Wren can make an opportunity attack on Grik',
      parts: [{ character: 'Wren', label: 'Opportunity attack', offer: ['Attack', 'Pass'] }]
    })
  })

  it('is not rolled until it is taken', () => {
    const { open } = offered()
    expect(() => play.roll(campaignId, open.id, open.parts[0].id)).toThrow(/take it or pass/)
  })

  it('once taken, rolls to hit and damage through the normal roll path', () => {
    const { grik, open } = offered()
    const part = open.parts[0].id
    play.answer(campaignId, open.id, part, 'Attack')
    expect(timeline().call!.parts[0]).toMatchObject({ offer: null, next: 'to hit' })
    expect(heard).toEqual([])

    load([20, 15])
    play.roll(campaignId, open.id, part)
    load([8, 5])
    play.roll(campaignId, open.id, part)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toBe(
      `[Wren · player] Opportunity attack, taken: Crossbow, light attack on Grik (${grik}): d20 15 + 4 = 19 vs AC 15 → hit; damage 1d8+2: 5 + 2 = 7 piercing → Grik 0/7 HP (down); Grik dies`
    )
    expect(timeline().call).toBeNull()
  })

  it('passed, rolls nothing and the DM hears so', () => {
    const { open } = offered()
    play.answer(campaignId, open.id, open.parts[0].id, 'Pass')
    expect(heard[0].content).toBe('[Wren · player] Opportunity attack: passes')
    expect(timeline().call).toBeNull()
  })

  it('without an attack, taking it is the whole answer', () => {
    addWren()
    const { pending_call: id } = ok('offer_reaction', {
      character: 'char:wren',
      reaction: 'Shield Ally',
      take: 'Step in'
    })
    ok('narrate', { text: 'The arrow flies at Ash.', call: id })
    const open = timeline().call!
    expect(open.parts[0].offer).toEqual(['Step in', 'Pass'])
    play.answer(campaignId, open.id, open.parts[0].id, 'Step in')
    expect(heard[0].content).toBe('[Wren · player] Shield ally: takes it (Step in)')
  })

  it("spends the Character's reaction in a Combat", () => {
    addWren()
    const grik = addGrik()
    load([20, 15])
    const { pending_call: init } = ok('start_combat', { combatants: ['char:wren', grik] })
    ok('narrate', { text: 'Roll for initiative!', call: init })
    rollInitiative(init, 18)

    const brace = () => {
      const { pending_call: id } = ok('offer_reaction', {
        character: 'char:wren',
        reaction: 'Brace'
      })
      ok('narrate', { text: 'Again!', call: id })
      const open = timeline().call!
      heard = []
      play.answer(campaignId, open.id, open.parts[0].id, 'Take')
      return heard[0].content
    }
    expect(brace()).toBe('[Wren · player] Brace: takes it (Take)')
    expect(brace()).toBe(
      '[Wren · player] Brace: takes it (Take)\nWren has already used a reaction this turn (a reminder: go on if the fiction allows it)'
    )
  })

  it('is refused for a Character who cannot act', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    expect(call('offer_reaction', { character: 'char:wren', reaction: 'Brace' }).isError).toBe(true)
  })
})

describe('the core block', () => {
  const block = () => play.coreBlock(campaignId)

  it("names a Character's concentration and a downed Character's Death saves", () => {
    addAsh()
    addWren()
    ok('cast', { caster: 'char:ash', spell: 'detect-magic', level: 1 })
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })
    ok('damage', { target: 'char:wren', amount: 1, type: 'slashing' })

    expect(block()).toContain(
      '- Ash (char:ash): HP 7/7, conditions none, alive, whereabouts unknown, concentrating on detect-magic'
    )
    expect(block()).toContain(
      '- Wren (char:wren): HP 0/12, conditions unconscious, alive, whereabouts unknown, Death saves 0 successes, 1 failure'
    )
  })

  it('marks a stable Character', () => {
    deathSave(downedOnTheirTurn(), 12)
    deathSave(ok('next_turn') && ok('next_turn'), 15)
    deathSave(ok('next_turn') && ok('next_turn'), 11)
    expect(block()).toContain('whereabouts unknown, stable')
  })

  it('names what each NPC and Creature in the Combat concentrates on', () => {
    addWren()
    const myrrh = addMyrrh()
    load([20, 15])
    const { pending_call: id } = ok('start_combat', { combatants: ['char:wren', myrrh] })
    ok('narrate', { text: 'Roll for initiative!', call: id })
    rollInitiative(id, 18)
    ok('cast', { caster: myrrh, spell: 'fly', level: 3 })

    expect(block()).toMatch(/- \d+ Myrrh \(npc:myrrh\): concentrating on fly/)
  })
})
