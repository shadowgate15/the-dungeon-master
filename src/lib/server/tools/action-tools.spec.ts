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

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]

/**
 * Loaded dice: each roll takes the next face from the queue as `[sides, face]`. Rolling past the
 * end of the queue fails the test, so every die a test rolls is one it named.
 */
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-actions-'))
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

/** Wren: a Human Fighter with a light crossbow (+4 to hit, 1d8+2 piercing), 12 HP, AC 12. */
const addWren = () => addCharacter(library, campaignId, fighterDraft('Wren'))

/** Grik: a goblin NPC (AC 15, 7 HP; scimitar +4, 1d6+2 slashing). Returns the handle. */
const addGrik = () =>
  ok('establish', { type: 'npc', name: 'Grik', fields: { stat_block: 'monster:goblin' } })
    .handle as string

const timeline = () => play.timeline(campaignId)
const openCall = () => timeline().call!

describe('a Character attack', () => {
  it('is a pending Call the closing narrate attaches; the Player rolls to hit, then damage, and the DM hears one result', () => {
    addWren()
    const grik = addGrik()

    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    expect(id).toEqual(expect.any(String))
    expect(timeline().call).toBeNull()

    ok('narrate', { text: 'Wren levels her crossbow.', call: id })
    const [part] = openCall().parts
    expect(part).toMatchObject({
      character: 'Wren',
      label: 'Crossbow, light attack',
      next: 'to hit'
    })

    load([20, 15])
    play.roll(campaignId, id, part.id)
    expect(heard).toEqual([])
    expect(openCall().parts[0]).toMatchObject({ answered: false, next: 'damage' })

    load([8, 5])
    play.roll(campaignId, id, part.id)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toEqual({ kind: 'call_result', call_id: id, players: 'player' })
    expect(heard[0].content).toBe(
      `[Wren · player] Crossbow, light attack on Grik (${grik}): d20 15 + 4 = 19 vs AC 15 → hit; damage 1d8+2: 5 + 2 = 7 piercing → Grik 0/7 HP (down); Grik dies`
    )
    expect(timeline().call).toBeNull()
    expect(timeline().awaitingSince).toEqual(expect.any(Number))
    expect(timeline().entries.filter((e) => e.type === 'roll')).toEqual([
      expect.objectContaining({
        character: 'Wren',
        what: 'Crossbow, light attack',
        dice: [15],
        modifier: 4,
        total: 19,
        outcome: 'hit',
        target: null
      }),
      expect.objectContaining({
        character: 'Wren',
        what: 'Crossbow, light damage',
        dice: [5],
        modifier: 2,
        total: 7,
        outcome: null,
        target: { name: 'Grik', state: 'down' }
      })
    ])
  })

  it('doubles the damage dice on a natural 20', () => {
    addWren()
    const grik = addGrik()
    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    ok('narrate', { text: 'Wren fires.', call: id })
    const part = openCall().parts[0]

    load([20, 20])
    play.roll(campaignId, id, part.id)
    load([8, 1], [8, 1])
    play.roll(campaignId, id, part.id)

    const rolls = timeline().entries.filter((e) => e.type === 'roll')
    expect(rolls.map((r) => r.type === 'roll' && r.outcome)).toEqual(['critical hit', null])
    expect(rolls[1]).toMatchObject({ dice: [1, 1], modifier: 2, total: 4 })
    expect(heard[0].content).toContain('→ critical hit; damage 1d8+2 (doubled): 1 + 1 + 2 = 4')
  })

  it('ends at the to-hit roll on a miss', () => {
    addWren()
    const grik = addGrik()
    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    ok('narrate', { text: 'Wren fires.', call: id })

    load([20, 3])
    play.roll(campaignId, id, openCall().parts[0].id)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toContain('d20 3 + 4 = 7 vs AC 15 → miss')
    expect(heard[0].content).not.toContain('damage')
  })

  it('refuses a weapon the Character does not have', () => {
    addWren()
    const grik = addGrik()

    const { isError, payload } = call('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'glaive'
    })

    expect(isError).toBe(true)
    expect(payload).toMatchObject({
      code: 'unknown_attack',
      next: expect.stringContaining('Crossbow, light')
    })
  })
})

describe('an NPC attack', () => {
  it('rolls and applies at once, and shows in the dice log without the AC or HP numbers', () => {
    addWren()
    const grik = addGrik()

    load([20, 14], [6, 4])
    const result = ok('attack', { actor: grik, target: 'char:wren', with: 'scimitar' })

    expect(result.rolled).toBe(
      'Scimitar attack on Wren (char:wren): d20 14 + 4 = 18 vs AC 12 → hit; damage 1d6+2: 4 + 2 = 6 slashing → Wren 6/12 HP (bloodied)'
    )
    expect(result.targets).toEqual([{ handle: 'char:wren', hp: 6 }])
    expect(playSheets(library.party(campaignId))[0].hp).toMatchObject({ current: 6, max: 12 })
    expect(timeline().entries.filter((e) => e.type === 'roll')).toEqual([
      expect.objectContaining({
        character: 'Grik',
        what: 'Scimitar attack',
        dice: [14],
        total: 18,
        outcome: 'hit'
      }),
      expect.objectContaining({
        character: 'Grik',
        what: 'Scimitar damage',
        dice: [4],
        total: 6,
        target: null
      })
    ])
    expect(heard).toEqual([])
  })

  it("shows an NPC target's HP as a state, never as numbers", () => {
    const grik = addGrik()
    const snag = ok('establish', {
      type: 'npc',
      name: 'Snag',
      fields: { stat_block: 'monster:goblin' }
    }).handle as string

    load([20, 18], [6, 4])
    ok('attack', { actor: snag, target: grik, with: 'scimitar' })

    const rolls = timeline().entries.filter((e) => e.type === 'roll')
    expect(rolls[1]).toMatchObject({ target: { name: 'Grik', state: 'near death' } })
    expect(JSON.stringify(timeline())).not.toMatch(/\bAC\b|\/7\b|\bhp\b/i)
  })
})

describe('the Stop hook', () => {
  it('blocks a turn that ends with an unattached pending Call, until cancel_call clears it', () => {
    addWren()
    const grik = addGrik()
    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })

    const stop = play.stopCheck(campaignId, false)
    expect(stop).toMatchObject({ block: true, reason: expect.stringContaining(id) })

    ok('cancel_call', { id })
    expect(play.stopCheck(campaignId, false)).toEqual({ block: false })
  })

  it('lets the turn end on the second attempt, and the timeline shows the error', () => {
    addWren()
    const grik = addGrik()
    ok('attack', { actor: 'char:wren', target: grik, with: 'crossbow' })

    expect(play.stopCheck(campaignId, true)).toEqual({ block: false })
    expect(timeline().entries.at(-1)).toMatchObject({ type: 'error' })
    expect(play.stopCheck(campaignId, false), 'the stale Call is dropped').toEqual({ block: false })
  })

  it('does not block once narrate attaches the Call', () => {
    addWren()
    const grik = addGrik()
    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    ok('narrate', { text: 'Wren fires.', call: id })

    expect(play.stopCheck(campaignId, false)).toEqual({ block: false })
  })

  it('refuses to cancel a Call that is not pending', () => {
    const { isError, payload } = call('cancel_call', { id: 'nope' })
    expect(isError).toBe(true)
    expect(payload).toMatchObject({ code: 'unknown_call' })
  })
})

/** Ilyra: a High Elf Wizard (spell attack +5, save DC 13, two 1st-level slots). */
const addIlyra = () => addCharacter(library, campaignId, wizardDraft('Ilyra'))
const slots = () =>
  playSheets(library.party(campaignId)).find((s) => s.name === 'Ilyra')!.spellSlots

describe('cast', () => {
  it('refuses a spell the caster does not know', () => {
    addIlyra()
    const { isError, payload } = call('cast', {
      caster: 'char:ilyra',
      spell: 'fireball',
      level: 3,
      targets: []
    })
    expect(isError).toBe(true)
    expect(payload).toMatchObject({ code: 'spell_not_known' })
  })

  it('spends a slot of the cast level, and refuses once none is free', () => {
    addIlyra()
    const cast = () =>
      call('cast', { caster: 'char:ilyra', spell: 'detect-magic', level: 1, targets: [] })

    expect(cast().isError).toBe(false)
    expect(slots()).toEqual([{ level: 1, max: 2, spent: 1 }])
    expect(cast().isError).toBe(false)

    const { isError, payload } = cast()
    expect(isError).toBe(true)
    expect(payload).toMatchObject({ code: 'no_slot' })
    expect(slots()).toEqual([{ level: 1, max: 2, spent: 2 }])
  })

  it("refuses a level below the spell's own", () => {
    addIlyra()
    const { payload } = call('cast', {
      caster: 'char:ilyra',
      spell: 'burning-hands',
      level: 0,
      targets: []
    })
    expect(payload).toMatchObject({ code: 'bad_spell_level' })
  })

  it('makes a spell attack a pending Call the Player rolls, spending no slot for a cantrip', () => {
    addIlyra()
    const grik = addGrik()
    const { pending_call: id } = ok('cast', {
      caster: 'char:ilyra',
      spell: 'Fire Bolt',
      level: 0,
      targets: [grik]
    })
    ok('narrate', { text: 'Ilyra flings fire.', call: id })
    const part = openCall().parts[0]
    expect(part).toMatchObject({ character: 'Ilyra', label: 'Fire Bolt attack', next: 'to hit' })

    load([20, 12])
    play.roll(campaignId, id, part.id)
    load([10, 6])
    play.roll(campaignId, id, part.id)

    expect(heard[0].content).toBe(
      `[Ilyra · player] Fire Bolt attack on Grik (${grik}): d20 12 + 5 = 17 vs AC 15 → hit; damage 1d10: 6 = 6 fire → Grik 1/7 HP (near death)`
    )
    expect(slots()).toEqual([{ level: 1, max: 2, spent: 0 }])
  })

  it("rolls an NPC target's save at once against the caster's DC, damage rolled once", () => {
    addIlyra()
    const grik = addGrik()
    const snag = ok('establish', {
      type: 'npc',
      name: 'Snag',
      fields: { stat_block: 'monster:goblin' }
    }).handle as string

    load([6, 2], [6, 2], [6, 2], [20, 15], [20, 4])
    const result = ok('cast', {
      caster: 'char:ilyra',
      spell: 'burning-hands',
      level: 1,
      targets: [grik, snag]
    })

    expect(result.rolled).toBe(
      [
        'Burning Hands damage: 2 + 2 + 2 = 6 fire',
        `Dexterity save (${grik}): d20 15 + 2 = 17 vs DC 13 → success; takes 3 fire → Grik 4/7 HP (unhurt)`,
        `Dexterity save (${snag}): d20 4 + 2 = 6 vs DC 13 → failure; takes 6 fire → Snag 1/7 HP (near death)`
      ].join('\n')
    )
    expect(slots()).toEqual([{ level: 1, max: 2, spent: 1 }])
    expect(
      timeline()
        .entries.filter((e) => e.type === 'roll')
        .map((e) => e.type === 'roll' && [e.character, e.what, e.outcome])
    ).toEqual([
      ['Ilyra', 'Burning Hands damage', null],
      ['Grik', 'Dexterity save', 'success'],
      ['Snag', 'Dexterity save', 'failure']
    ])
  })
})

describe('force_save', () => {
  it('gives Character targets a pending Call of saves; a failure takes the pre-rolled damage and the condition', () => {
    addWren()

    load([6, 3], [6, 3])
    const forced = ok('force_save', {
      targets: ['char:wren'],
      ability: 'dex',
      dc: 13,
      on_fail: { damage: '2d6', type: 'fire', condition: 'prone' },
      on_success: 'half',
      source: 'Fire trap'
    })
    expect(forced.rolled).toBe('Fire trap damage: 3 + 3 = 6 fire')
    ok('narrate', { text: 'Flames roar from the vents.', call: forced.pending_call })
    const part = openCall().parts[0]
    expect(part).toMatchObject({ character: 'Wren', label: 'Dexterity save', next: 'save' })
    expect(JSON.stringify(openCall())).not.toMatch(/\b13\b|\bdc\b/i)

    load([20, 5])
    play.roll(campaignId, forced.pending_call, part.id)

    expect(heard[0].content).toBe(
      '[Wren · player] Dexterity save (char:wren): d20 5 + 2 = 7 vs DC 13 → failure; takes 6 fire, is prone → Wren 6/12 HP (bloodied)'
    )
    const wren = playSheets(library.party(campaignId))[0]
    expect(wren.hp).toMatchObject({ current: 6 })
    expect(wren.conditions).toContain('prone')
  })

  it("rolls NPC targets' saves at once against a tier's DC", () => {
    const grik = addGrik()

    load([20, 14])
    const forced = ok('force_save', {
      targets: [grik],
      ability: 'Constitution',
      dc_tier: 'medium',
      on_fail: { condition: 'poisoned' }
    })

    expect(forced.rolled).toBe(
      `Constitution save (${grik}): d20 14 + 0 = 14 vs DC 15 → failure; is poisoned`
    )
    expect(forced.pending_call).toBeUndefined()
  })

  it('refuses both a tier and a DC', () => {
    const grik = addGrik()
    const { isError } = call('force_save', {
      targets: [grik],
      ability: 'dex',
      dc: 12,
      dc_tier: 'easy',
      on_fail: {}
    })
    expect(isError).toBe(true)
  })
})

const sheet = (name: string) => playSheets(library.party(campaignId)).find((s) => s.name === name)!

describe('the primitives', () => {
  it('roll: rolls an expression for the DM alone, a d20 with advantage', () => {
    load([6, 3], [6, 4])
    expect(ok('roll', { expr: '2d6+1' })).toMatchObject({ dice: [3, 4], modifier: 1, total: 8 })

    load([20, 4], [20, 15])
    expect(ok('roll', { expr: 'd20+2', adv: 'advantage' })).toMatchObject({
      dice: [4, 15],
      kept: 15,
      total: 17
    })

    expect(timeline().entries.filter((e) => e.type === 'roll')).toEqual([])
  })

  it('damage and heal: change HP within 0 and the maximum, an NPC to the DM with its state', () => {
    addWren()
    const grik = addGrik()

    expect(ok('damage', { target: grik, amount: 3, type: 'fire' })).toMatchObject({
      dealt: 3,
      hp: 4,
      max: 7,
      state: 'unhurt'
    })
    ok('damage', { target: 'char:wren', amount: 20, type: 'slashing' })
    expect(sheet('Wren').hp).toMatchObject({ current: 0 })
    ok('heal', { target: 'char:wren', amount: 30 })
    expect(sheet('Wren').hp).toMatchObject({ current: 12 })
  })

  it('add_condition and remove_condition: only SRD conditions, only ones it has', () => {
    addWren()
    ok('add_condition', { target: 'char:wren', condition: 'Prone' })
    expect(sheet('Wren').conditions).toEqual(['prone'])
    expect(
      call('add_condition', { target: 'char:wren', condition: 'sleepy' }).payload
    ).toMatchObject({ code: 'unknown_condition' })

    ok('remove_condition', { target: 'char:wren', condition: 'prone' })
    expect(sheet('Wren').conditions).toEqual([])
    expect(
      call('remove_condition', { target: 'char:wren', condition: 'prone' }).payload
    ).toMatchObject({ code: 'condition_absent' })
  })

  it("spend: a spell slot or a feature's use", () => {
    addIlyra()
    addWren()
    ok('spend', { character: 'char:ilyra', resource: 'slot:1' })
    ok('spend', { character: 'char:ilyra', resource: 'slot:1' })
    expect(call('spend', { character: 'char:ilyra', resource: 'slot:1' }).payload).toMatchObject({
      code: 'no_slot'
    })

    ok('spend', { character: 'char:wren', resource: 'second-wind' })
    expect(sheet('Wren').features).toContainEqual(
      expect.objectContaining({ slug: 'second-wind', spent: 1 })
    )
    expect(call('spend', { character: 'char:wren', resource: 'rage' }).payload).toMatchObject({
      code: 'unknown_resource'
    })
  })
})

describe('what the Player sees', () => {
  it("never carries an enemy's AC, DC or HP numbers", () => {
    addWren()
    const grik = addGrik()

    load([20, 18], [6, 1])
    ok('attack', { actor: grik, target: 'char:wren', with: 'scimitar' })
    load([20, 2])
    ok('force_save', {
      targets: [grik],
      ability: 'wis',
      dc: 17,
      on_fail: { condition: 'frightened' }
    })
    const { pending_call: id } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    ok('narrate', { text: 'Wren fires.', call: id })
    // Grik: AC 15, 7 HP, a DC 17 save. Sheets list only the Party; the timeline carries the rest.
    const seen = () => JSON.stringify(timeline())
    const hidden = /\bAC\b|\bDC\b|\b15\b|\b17\b|\/ ?7\b|"hp"|"max"/
    expect(seen()).not.toMatch(hidden)
    expect(JSON.stringify(playSheets(library.party(campaignId)))).not.toContain('Grik')

    load([20, 16])
    play.roll(campaignId, id, openCall().parts[0].id)
    load([8, 2])
    play.roll(campaignId, id, openCall().parts[0].id)

    expect(seen()).not.toMatch(hidden)
    expect(seen()).toContain('"state":"bloodied"')
  })
})
