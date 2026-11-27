import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
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
  const tmp = tempDir('combat')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  channels.listen(folder, (e) => heard.push(e))
  host = createToolHost({ library, tools: gameTools, publish: () => {}, dice: () => loaded })
  play = createPlay({ library, channels, publish: () => {}, dice: () => loaded })
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

/** Wren: a Human Fighter, Dex 14 (initiative +2). */
const addWren = () => addCharacter(library, campaignId, fighterDraft('Wren'))
/** Ash: a High Elf Wizard, Dex 16 with the racial bonus (initiative +3). */
const addAsh = () => addCharacter(library, campaignId, wizardDraft('Ash'))

const timeline = () => play.timeline(campaignId, SOLO_PLAYER)
const combatView = () => play.scene(campaignId, SOLO_PLAYER).combat

/** Rolls every open initiative part in order, one d20 face each. */
function rollInitiative(id: string, ...d20s: number[]) {
  for (const [i, part] of timeline().call!.parts.entries()) {
    load([20, d20s[i]])
    play.roll(campaignId, id, part.id, SOLO_PLAYER)
  }
}

describe('start_combat', () => {
  it('rolls Creature initiative in code and asks the Party for initiative in one batched Call', () => {
    addWren()
    addAsh()

    load([20, 10], [20, 15])
    const started = ok('start_combat', {
      combatants: ['char:wren', 'char:ash', { monster: 'monster:goblin', count: 2 }]
    })

    expect(started.skill).toBe('the-dungeon-master:combat')
    expect(started.creatures).toEqual(['creature:goblin-1', 'creature:goblin-2'])
    expect(started.rolled).toContain('Goblin 1 initiative: d20 10 + 2 = 12')
    expect(started.rolled).toContain('Goblin 2 initiative: d20 15 + 2 = 17')
    expect(timeline().entries.filter((e) => e.type === 'roll')).toEqual([
      expect.objectContaining({ character: 'Goblin 1', what: 'Initiative', total: 12 }),
      expect.objectContaining({ character: 'Goblin 2', what: 'Initiative', total: 17 })
    ])

    const id = started.pending_call as string
    ok('narrate', { text: 'Steel rings out. Roll for initiative!', call: id })
    expect(timeline().call).toMatchObject({
      kind: 'initiative',
      parts: [
        { character: 'Wren', label: 'Initiative' },
        { character: 'Ash', label: 'Initiative' }
      ]
    })

    rollInitiative(id, 18, 4)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'call_result', call_id: id })
    expect(heard[0].content).toContain(
      '[Wren · Host · Player of Wren & Ash] Initiative: d20 18 + 2 = 20'
    )
    expect(heard[0].content).toContain(
      '[Ash · Host · Player of Wren & Ash] Initiative: d20 4 + 3 = 7'
    )
    expect(heard[0].content).toContain(
      'Order: Wren 20, Goblin 2 17, Goblin 1 12, Ash 7. Round 1: Wren (char:wren) acts.'
    )
  })
})

/** Starts a fight of Wren against goblins, rolling Wren's initiative too. Faces: goblins, then Wren. */
function fight(goblins: number[], wren: number, surprised?: string[]) {
  addWren()
  load(...goblins.map((f) => [20, f] as [number, number]))
  const { pending_call: id } = ok('start_combat', {
    combatants: ['char:wren', { monster: 'monster:goblin', count: goblins.length }],
    ...(surprised && { surprised })
  })
  ok('narrate', { text: 'Roll for initiative!', call: id })
  rollInitiative(id, wren)
  heard = []
}

describe('next_turn', () => {
  it('walks the order and counts rounds', () => {
    // Wren 20, Goblin 2 17, Goblin 1 12.
    fight([10, 15], 18)
    expect(combatView()).toMatchObject({ round: 1, waiting: [] })
    expect(combatView()!.order.find((c) => c.current)?.name).toBe('Wren')

    expect(ok('next_turn')).toMatchObject({ round: 1, turn: { handle: 'creature:goblin-2' } })
    expect(ok('next_turn')).toMatchObject({ round: 1, turn: { handle: 'creature:goblin-1' } })
    expect(ok('next_turn')).toMatchObject({ round: 2, turn: { handle: 'char:wren', name: 'Wren' } })
  })

  it('skips a surprised combatant on its first turn only', () => {
    fight([10, 15], 18, ['creature:goblin-2'])

    expect(ok('next_turn')).toMatchObject({ round: 1, turn: { handle: 'creature:goblin-1' } })
    expect(ok('next_turn')).toMatchObject({ round: 2, turn: { handle: 'char:wren' } })
    expect(ok('next_turn')).toMatchObject({ round: 2, turn: { handle: 'creature:goblin-2' } })
  })

  it('waits for the Party to roll initiative', () => {
    addWren()
    load([20, 10])
    ok('start_combat', { combatants: ['char:wren', 'monster:goblin'] })

    expect(refused('next_turn')).toMatchObject({ code: 'initiative_pending' })
    expect(combatView()).toMatchObject({ round: 0, waiting: ['Wren'] })
  })
})

describe('Creatures', () => {
  it('fight through the action tools and show to the Player only as an HP state', () => {
    fight([10], 18)

    // Goblin: AC 15, 7 HP; scimitar +4, 1d6+2.
    load([20, 14], [6, 4])
    const result = ok('attack', {
      actor: 'creature:goblin-1',
      target: 'char:wren',
      with: 'scimitar'
    })
    expect(result.rolled).toContain('Scimitar attack on Wren')
    expect(
      timeline()
        .entries.filter((e) => e.type === 'roll')
        .at(-1)
    ).toMatchObject({
      character: 'Goblin 1',
      what: 'Scimitar damage'
    })

    ok('damage', { target: 'creature:goblin-1', amount: 4, type: 'piercing' })
    const goblin = combatView()!.order.find((c) => c.name === 'Goblin 1')
    expect(goblin).toMatchObject({ kind: 'creature', state: 'bloodied' })
    expect(JSON.stringify(play.scene(campaignId, SOLO_PLAYER))).not.toMatch(/creature:|"hp"|maxHp/)
  })

  it('vanish at end_combat, and the rounds go onto the clock rounded up to a minute', () => {
    fight([10], 18)
    for (let i = 0; i < 21; i++) ok('next_turn') // Wren and Goblin 1 take turns: round 11.
    expect(ok('scene').clock).toBe('day 1, 08:00')

    expect(ok('end_combat')).toMatchObject({
      rounds: 11,
      minutes: 2,
      clock: 'day 1, 08:02',
      creatures_gone: ['creature:goblin-1']
    })

    expect(ok('scene').clock).toBe('day 1, 08:02')
    expect(combatView()).toBeNull()
    expect(
      refused('damage', { target: 'creature:goblin-1', amount: 1, type: 'fire' })
    ).toMatchObject({ code: 'unknown_handle' })
    expect(refused('end_combat')).toMatchObject({ code: 'no_combat' })
  })
})

describe('during a Combat', () => {
  it('refuses set_scene until the Combat ends', () => {
    fight([10], 18)
    const place = ok('establish', { type: 'place', name: 'The Docks' }).handle as string
    ok('move', { who: ['char:wren'], to: place })

    expect(refused('set_scene', { place })).toMatchObject({ code: 'combat_live' })
    ok('end_combat')
    ok('set_scene', { place })
  })

  it('refuses a second start_combat', () => {
    fight([10], 18)
    expect(refused('start_combat', { combatants: ['char:wren'] })).toMatchObject({
      code: 'combat_live'
    })
  })
})

describe('add_combatant', () => {
  it('slots a late NPC into the order by the initiative code rolls', () => {
    fight([10], 18) // Wren 20, Goblin 1 12.
    const grik = ok('establish', {
      type: 'npc',
      name: 'Grik',
      fields: { stat_block: 'monster:goblin' }
    }).handle as string

    load([20, 15])
    const added = ok('add_combatant', { combatants: [grik] })
    expect(added.rolled).toBe('Grik initiative: d20 15 + 2 = 17')
    expect(added.order).toBe(
      'Order: Wren 20, Grik 17, Goblin 1 12. Round 1: Wren (char:wren) acts.'
    )

    expect(ok('next_turn')).toMatchObject({ turn: { handle: grik } })
  })

  it('gives a late Character an initiative Call and joins them once rolled', () => {
    fight([10], 18)
    addAsh()

    const { pending_call: id } = ok('add_combatant', { combatants: ['char:ash'] })
    expect(combatView()!.waiting).toEqual(['Ash'])
    ok('narrate', { text: 'Ash bursts in.', call: id })
    rollInitiative(id, 12) // 15

    expect(heard[0].content).toContain(
      'Order: Wren 20, Ash 15, Goblin 1 12. Round 1: Wren (char:wren) acts.'
    )
    expect(ok('next_turn')).toMatchObject({ turn: { handle: 'char:ash' } })
  })
})

describe('the Floor in Combat', () => {
  it('leaves the initiative Call open when Declarations close a Floor', () => {
    const wren = addWren()
    load([20, 10])
    const { pending_call: id } = ok('start_combat', { combatants: ['char:wren', 'monster:goblin'] })
    ok('narrate', { text: 'Roll for initiative!', call: id })

    library
      .floor(campaignId)
      .send({ character: wren, text: 'I draw my sword.', player: SOLO_PLAYER })
    play.done(campaignId, SOLO_PLAYER)

    expect(timeline().call).toMatchObject({ id, kind: 'initiative' })
    rollInitiative(id, 18)
    expect(combatView()).toMatchObject({ round: 1, waiting: [] })
  })

  it('takes Declarations only for the Character whose turn it is', () => {
    const ash = addAsh()
    fight([10], 18) // Wren 20, Goblin 1 12; Ash isn't fighting.
    const wren = play.scene(campaignId, SOLO_PLAYER).present.find((c) => c.name === 'Wren')!.id
    const floor = library.floor(campaignId)

    floor.send({ character: wren, text: 'I swing at the goblin.', player: SOLO_PLAYER })
    expect(() =>
      floor.send({ character: ash, text: 'I cast a spell.', player: SOLO_PLAYER })
    ).toThrow("It is Wren's turn")

    ok('next_turn')
    expect(() =>
      floor.send({ character: wren, text: 'I swing again.', player: SOLO_PLAYER })
    ).toThrow("It is Goblin 1's turn")
  })
})

describe('the core block', () => {
  it('adds the order, turn, round and each Creature while a Combat is live', () => {
    fight([10, 15], 18)
    ok('add_condition', { target: 'creature:goblin-1', condition: 'prone' })

    expect(play.coreBlock(campaignId)).toContain(
      [
        'Combat: round 1, turn: Wren (char:wren).',
        '- 20 Wren (char:wren) ← turn',
        '- 17 Goblin 2 (creature:goblin-2): monster:goblin, unhurt, conditions none',
        '- 12 Goblin 1 (creature:goblin-1): monster:goblin, unhurt, conditions prone'
      ].join('\n')
    )

    ok('end_combat')
    expect(play.coreBlock(campaignId)).not.toContain('Combat:')
  })
})

describe('action economy', () => {
  it('reminds, never refuses, when a combatant attacks again on its turn; next_turn makes it fresh', () => {
    fight([10], 18)
    ok('next_turn') // Goblin 1's turn.

    load([20, 2])
    expect(
      ok('attack', { actor: 'creature:goblin-1', target: 'char:wren', with: 'scimitar' }).reminder
    ).toBeUndefined()
    load([20, 2])
    expect(
      ok('attack', { actor: 'creature:goblin-1', target: 'char:wren', with: 'scimitar' }).reminder
    ).toBe(
      'Goblin 1 has already used an action this turn (a reminder: go on if the fiction allows it)'
    )

    ok('next_turn')
    ok('next_turn') // Goblin 1 again, round 2.
    load([20, 2])
    expect(
      ok('attack', { actor: 'creature:goblin-1', target: 'char:wren', with: 'scimitar' }).reminder
    ).toBeUndefined()
  })
})

describe('an unclaimed Character in Combat', () => {
  /** Wren with no Claim: nobody plays her. */
  const addUnclaimedWren = () => {
    const id = addWren()
    library.party(campaignId).letGo(id, SOLO_PLAYER)
    return id
  }
  /** Starts Wren against a goblin; faces are Wren's d20, then the goblin's. */
  const start = (wren: number, goblin: number) => {
    load([20, wren], [20, goblin])
    return ok('start_combat', { combatants: ['char:wren', 'monster:goblin'] })
  }

  it('has its initiative rolled by code, with no initiative Call', () => {
    addUnclaimedWren()
    const started = start(18, 10)

    expect(started.pending_call ?? null).toBeNull()
    expect(started.rolled).toContain('Wren initiative: d20 18 + 2 = 20')
    expect(combatView()).toMatchObject({ round: 1, waiting: [] })
  })

  it('has its turn skipped with a note, from the first round on', () => {
    addUnclaimedWren()
    const started = start(18, 10)
    expect(started.rolled).toContain('Wren is unclaimed: no action')
    expect(combatView()!.order.find((c) => c.current)?.name).toBe('Goblin 1')

    const next = ok('next_turn')
    expect(next).toMatchObject({ round: 2, turn: { handle: 'creature:goblin-1' } })
    expect(next.notes).toContain('Wren is unclaimed: no action')
  })

  it('has its Death save rolled by code on its turn', () => {
    addUnclaimedWren()
    start(18, 10)
    ok('damage', { target: 'char:wren', amount: 12, type: 'slashing' })

    load([20, 12])
    const next = ok('next_turn')
    expect(next.pending_call ?? null).toBeNull()
    expect(next.notes.join(' ')).toContain('Wren is unclaimed: no action')
    expect(next.notes.join(' ')).toContain('Death save: d20 12 → success')
    const sheet = playSheets(library.party(campaignId)).find((s) => s.name === 'Wren')!
    expect(sheet.deathSaves).toEqual({ successes: 1, failures: 0, stable: false })
  })

  it('plays its turn when Claimed before it comes', () => {
    const id = addUnclaimedWren()
    start(10, 18)
    library.party(campaignId).claim(id, SOLO_PLAYER)

    const next = ok('next_turn')
    expect(next).toMatchObject({ round: 1, turn: { handle: 'char:wren' } })
    expect(next.notes).toEqual([])
  })
})
