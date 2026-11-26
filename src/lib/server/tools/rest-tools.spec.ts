import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import type { CampaignLibrary } from '../campaign/library'
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
let pushed: LiveMessage[]

/** Loaded dice: each roll takes the next `[sides, face]` from the queue; running out fails. */
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
  const tmp = tempDir('rests')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  pushed = []
  channels.listen(folder, (e) => heard.push(e))
  const publish = (message: LiveMessage) => {
    pushed.push(message)
  }
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

/** Wren: a Human Fighter, 12 HP (d10 Hit Die, Con +2), one Hit Die, Second Wind. */
const addWren = () => addCharacter(library, campaignId, fighterDraft('Wren'))
/** Ilyra: a High Elf Wizard (d6 Hit Die), two 1st-level slots, Arcane Recovery. */
const addIlyra = () => addCharacter(library, campaignId, wizardDraft('Ilyra'))

const sheet = (name: string) => playSheets(library.party(campaignId)).find((s) => s.name === name)!
const minute = () => ok('scene').minute as number
const timeline = () => play.timeline(campaignId)

describe('a long rest', () => {
  it('restores HP, slots, feature uses and Hit Dice, ends temporary HP, and moves the clock 8 hours', () => {
    addWren()
    addIlyra()
    ok('damage', { target: 'char:wren', amount: 7, type: 'slashing' })
    ok('spend', { character: 'char:wren', resource: 'second-wind' })
    ok('spend', { character: 'char:ilyra', resource: 'slot:1' })
    ok('spend', { character: 'char:ilyra', resource: 'arcane-recovery' })
    const before = minute()

    const result = ok('rest', { kind: 'long', who: ['char:wren', 'char:ilyra'] })

    expect(result).toMatchObject({ kind: 'long', clock: 'day 1, 16:00' })
    expect(minute()).toBe(before + 8 * 60)
    expect(sheet('Wren').hp).toEqual({ current: 12, max: 12, temp: 0 })
    expect(sheet('Wren').features.find((f) => f.slug === 'second-wind')!.spent).toBe(0)
    expect(sheet('Ilyra').spellSlots).toEqual([{ level: 1, max: 2, spent: 0 }])
    expect(sheet('Ilyra').features.find((f) => f.slug === 'arcane-recovery')!.spent).toBe(0)
    expect(host.events(folder).at(-1)).toMatchObject({ kind: 'rest', minute: before })
    expect(pushed).toContainEqual(expect.objectContaining({ type: 'timeline' }))
  })
})

describe('a short rest', () => {
  it('moves the clock an hour, returns short-rest features, and asks in one Call how many Hit Dice to spend', () => {
    addWren()
    addIlyra()
    ok('damage', { target: 'char:wren', amount: 7, type: 'slashing' })
    ok('spend', { character: 'char:wren', resource: 'second-wind' })
    ok('spend', { character: 'char:ilyra', resource: 'slot:1' })
    ok('spend', { character: 'char:ilyra', resource: 'arcane-recovery' })
    const before = minute()

    const { pending_call: id, clock } = ok('rest', {
      kind: 'short',
      who: ['char:wren', 'char:ilyra']
    })

    expect(clock).toBe('day 1, 09:00')
    expect(minute()).toBe(before + 60)
    expect(sheet('Wren').features.find((f) => f.slug === 'second-wind')!.spent).toBe(0)
    expect(sheet('Ilyra').spellSlots).toEqual([{ level: 1, max: 2, spent: 1 }])
    expect(sheet('Ilyra').features.find((f) => f.slug === 'arcane-recovery')!.spent).toBe(1)
    expect(sheet('Wren').hp.current).toBe(5)

    ok('narrate', { text: 'You rest an hour in the ruined chapel.', call: id })
    const open = timeline().call!
    expect(open.kind).toBe('hit_dice')
    // Ilyra is unhurt: only Wren is asked.
    expect(open.parts).toEqual([
      expect.objectContaining({
        character: 'Wren',
        label: 'Hit Dice',
        hitDice: { die: 10, available: 1 }
      })
    ])

    load([10, 4])
    play.answer(campaignId, id, open.parts[0].id, '1')

    expect(sheet('Wren').hp.current).toBe(11)
    expect(sheet('Wren').hitDice).toEqual({ die: 10, total: 1, spent: 1 })
    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toEqual({ kind: 'call_result', call_id: id, players: 'player' })
    expect(heard[0].content).toBe('[Wren · player] Hit Dice: spent 1 d10: 4 + 2 = 6 HP → 11/12 HP')
  })

  it('refuses to spend more Hit Dice than are left', () => {
    addWren()
    ok('damage', { target: 'char:wren', amount: 7, type: 'slashing' })
    const { pending_call: id } = ok('rest', { kind: 'short', who: ['char:wren'] })
    ok('narrate', { text: 'You rest.', call: id })
    const part = timeline().call!.parts[0]
    expect(() => play.answer(campaignId, id, part.id, '2')).toThrow(/0 to 1/)
    play.answer(campaignId, id, part.id, '0')
    expect(heard[0].content).toBe('[Wren · player] Hit Dice: spent none')
    expect(sheet('Wren').hp.current).toBe(5)
  })

  it('asks no one when no resting Character is hurt with Hit Dice left', () => {
    addWren()
    const result = ok('rest', { kind: 'short', who: ['char:wren'] })
    expect(result.pending_call).toBeUndefined()
  })
})

describe('inventory', () => {
  const item = (name: string) => sheet('Wren').inventory.find((i) => i.name === name)

  it('gives and takes items, refusing to take what the Character does not carry', () => {
    addWren()
    ok('give', { character: 'char:wren', item: 'torch', quantity: 3 })
    expect(item('Torch')).toEqual({ name: 'Torch', quantity: 3, equipped: false })
    ok('give', { character: 'char:wren', item: 'Torch' })
    expect(item('Torch')!.quantity).toBe(4)

    ok('take', { character: 'char:wren', item: 'torch', quantity: 4 })
    expect(item('Torch')).toBeUndefined()
    expect(refused('take', { character: 'char:wren', item: 'torch' }).code).toBe('not_carried')
    expect(refused('give', { character: 'char:wren', item: 'a silver locket' }).code).toBe(
      'unknown_item'
    )
    expect(
      host
        .events(folder)
        .map((e) => e.kind)
        .slice(-3)
    ).toEqual(['item_given', 'item_given', 'item_taken'])
    expect(pushed.filter((m) => m.type === 'timeline')).toHaveLength(3)
  })

  it('equips armor and a shield, which set AC on the sheet and against attacks', () => {
    addWren()
    expect(sheet('Wren').ac).toEqual({ value: 12, note: 'unarmored' })
    ok('equip', { character: 'char:wren', item: 'chain-mail' })
    // Chain Mail 16, plus the Defense fighting style while armored.
    expect(sheet('Wren').ac).toEqual({ value: 17, note: 'Chain Mail' })
    expect(item('Chain Mail')!.equipped).toBe(true)
    const grik = ok('establish', {
      type: 'npc',
      name: 'Grik',
      fields: { stat_block: 'monster:goblin' }
    }).handle
    load([20, 10])
    expect(ok('attack', { actor: grik, target: 'char:wren', with: 'scimitar' }).rolled).toContain(
      'vs AC 17 → miss'
    )

    ok('give', { character: 'char:wren', item: 'shield' })
    ok('equip', { character: 'char:wren', item: 'shield' })
    expect(sheet('Wren').ac).toEqual({ value: 19, note: 'Chain Mail, Shield' })

    ok('give', { character: 'char:wren', item: 'leather-armor' })
    ok('equip', { character: 'char:wren', item: 'leather-armor' })
    // One suit of armor at a time: the Leather Armor replaces the Chain Mail.
    expect(item('Chain Mail')!.equipped).toBe(false)
    expect(sheet('Wren').ac).toEqual({ value: 16, note: 'Leather Armor, Shield' })

    ok('unequip', { character: 'char:wren', item: 'leather-armor' })
    expect(sheet('Wren').ac).toEqual({ value: 14, note: 'unarmored, Shield' })
    ok('take', { character: 'char:wren', item: 'shield', quantity: item('Shield')!.quantity })
    expect(sheet('Wren').ac).toEqual({ value: 12, note: 'unarmored' })

    expect(refused('equip', { character: 'char:wren', item: 'shield' }).code).toBe('not_carried')
    ok('give', { character: 'char:wren', item: 'torch' })
    expect(refused('equip', { character: 'char:wren', item: 'torch' }).code).toBe('not_equippable')
  })

  it('changes coin, refusing to spend coin the Character does not have', () => {
    addWren()
    const start = sheet('Wren').coin
    ok('coin', { character: 'char:wren', change: { gp: 5, sp: 3 } })
    expect(sheet('Wren').coin).toEqual({ ...start, gp: start.gp + 5, sp: start.sp + 3 })
    ok('coin', { character: 'char:wren', change: { sp: -3 } })
    expect(sheet('Wren').coin).toEqual({ ...start, gp: start.gp + 5 })
    const payload = refused('coin', { character: 'char:wren', change: { pp: -1 } })
    expect(payload.code).toBe('not_enough_coin')
    expect(sheet('Wren').coin).toEqual({ ...start, gp: start.gp + 5 })
  })
})

describe('milestone levels', () => {
  const party = () => library.party(campaignId)

  it('refuses a level-up until the DM awards one, then takes exactly one', () => {
    const id = addWren()
    expect(sheet('Wren').levelUp).toBeNull()
    expect(() => party().levelUp(id, {})).toThrow(/No level to take/)

    ok('award_level', { characters: ['char:wren'] })
    expect(host.events(folder).at(-1)).toMatchObject({ kind: 'level_awarded' })
    expect(sheet('Wren').levelUp).toEqual({
      level: 2,
      cantrips: { count: 0, options: [] },
      spells: { count: 0, options: [] }
    })
    ok('damage', { target: 'char:wren', amount: 3, type: 'slashing' })

    party().levelUp(id, {})

    expect(sheet('Wren').headline).toBe('Human Fighter 2')
    // d10 average 6 + Con 2 = 8 more HP, at most and now.
    expect(sheet('Wren').hp).toEqual({ current: 17, max: 20, temp: 0 })
    expect(sheet('Wren').hitDice).toEqual({ die: 10, total: 2, spent: 0 })
    expect(sheet('Wren').features.map((f) => f.slug)).toContain('action-surge-1-use')
    expect(sheet('Wren').levelUp).toBeNull()
    expect(host.events(folder).at(-1)).toMatchObject({
      tool: 'player',
      kind: 'change',
      summary: 'the Player levelled Wren up to level 2'
    })
    expect(() => party().levelUp(id, {})).toThrow(/No level to take/)
  })

  it('has a Wizard add two spells to the spellbook from the class list, up to the highest slot', () => {
    const id = addIlyra()
    ok('award_level', { characters: ['char:ilyra'] })
    const offer = sheet('Ilyra').levelUp!
    expect(offer.cantrips.count).toBe(0)
    expect(offer.spells.count).toBe(2)
    const slugs = offer.spells.options.map((o) => o.slug)
    expect(slugs).toContain('sleep')
    expect(slugs).not.toContain('cure-wounds')
    expect(slugs).not.toContain('misty-step')
    // Already in the spellbook.
    expect(slugs).not.toContain('alarm')

    expect(() => party().levelUp(id, { spells: ['sleep'] })).toThrow(/2 spells/)
    expect(() => party().levelUp(id, { spells: ['sleep', 'cure-wounds'] })).toThrow(/cure-wounds/)
    party().levelUp(id, { spells: ['sleep', 'shield'] })

    expect(sheet('Ilyra').spellSlots).toEqual([{ level: 1, max: 3, spent: 0 }])
    expect(
      library
        .party(campaignId)
        .character(id)
        .character.spells.map((s) => s.spell)
    ).toEqual(expect.arrayContaining(['sleep', 'shield']))
  })
})
