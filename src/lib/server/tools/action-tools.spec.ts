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
      `[Wren · player] Crossbow, light attack on Grik (${grik}): d20 15 + 4 = 19 vs AC 15 → hit; damage 1d8+2: 5 + 2 = 7 piercing → Grik 0/7 HP (down)`
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
