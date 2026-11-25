import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createCampaignDice } from '../dice'
import { gameTools } from '../tools'
import { createToolHost, type ToolHost } from '../tools/host'
import { CallClosedError, CallRefusedError } from './calls'
import { createPlay, type Play } from './play'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let home: string
let heard: ChannelEvent[]
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-calls-'))
  home = path.join(tmp, 'home')
  library = createCampaignLibrary({ home })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  pushed = []
  channels.listen(folder, (e) => heard.push(e))
  const publish = (m: LiveMessage) => pushed.push(m)
  const dice = createCampaignDice(1)
  host = createToolHost({ library, tools: gameTools, publish, dice: (id) => dice.for(id) })
  play = createPlay({ library, channels, publish, dice: (id) => dice.for(id) })
})

afterEach(() => library.close())

const addFighter = (name: string) => addCharacter(library, campaignId, fighterDraft(name))

/** The parsed payload of a tool call. */
function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

const lockCheck = {
  kind: 'check',
  character: 'Wren',
  skill: 'sleight-of-hand',
  tier: 'hard',
  reason: 'The lock is old and stiff'
}

/** The open Call as the Player's timeline shows it. */
const openCall = () => play.timeline(campaignId).call

describe('a Check Call', () => {
  it('shows the Player the skill and the reason, never the DC', () => {
    addFighter('Wren')

    expect(call('narrate', { text: 'The lock is rusted.', call: lockCheck }).isError).toBe(false)

    const shown = openCall()
    expect(shown).toEqual({
      id: expect.any(String),
      kind: 'check',
      text: null,
      choices: [],
      parts: [
        {
          id: expect.any(String),
          character: 'Wren',
          player: 'player',
          label: 'Sleight of Hand check',
          reason: 'The lock is old and stiff',
          mode: 'normal',
          hitDice: null,
          offer: null,
          answered: false,
          next: null
        }
      ]
    })
    expect(JSON.stringify(play.timeline(campaignId))).not.toMatch(/\b20\b|\bdc\b|tier|hard/i)
  })
})

describe('rolling a Call', () => {
  it('wakes the DM once, after every Character has rolled', () => {
    addFighter('Wren')
    addFighter('Bram')
    call('narrate', {
      text: 'The guards turn.',
      call: [
        { ...lockCheck },
        { kind: 'check', character: 'Bram', skill: 'perception', tier: 'easy', reason: 'Footsteps' }
      ]
    })
    const [wren, bram] = openCall()!.parts

    play.roll(campaignId, openCall()!.id, wren.id)
    expect(heard).toEqual([])
    expect(play.timeline(campaignId).awaitingSince).toBeNull()
    expect(openCall()!.parts.map((p) => p.answered)).toEqual([true, false])

    const id = openCall()!.id
    play.roll(campaignId, id, bram.id)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toEqual({ kind: 'call_result', call_id: id, players: 'player' })
    const lines = heard[0].content.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(
      /^\[Wren · player\] Sleight of Hand check: d20 \d+ [+-] \d+ = \d+ vs DC 20 \(hard\) → (success|failure)$/
    )
    expect(lines[1]).toMatch(/^\[Bram · player\] Perception check: .* vs DC 10 \(easy\)/)
    expect(play.timeline(campaignId).awaitingSince).toEqual(expect.any(Number))
    expect(openCall()).toBeNull()
  })

  it('shows each roll as one timeline line: who, what, dice, total and outcome, never the DC', () => {
    addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })
    const { id, parts } = openCall()!

    play.roll(campaignId, id, parts[0].id)

    const roll = play.timeline(campaignId).entries.find((e) => e.type === 'roll')
    expect(roll).toEqual({
      type: 'roll',
      id: expect.any(String),
      character: 'Wren',
      what: 'Sleight of Hand check',
      dice: [expect.any(Number)],
      modifier: expect.any(Number),
      total: expect.any(Number),
      outcome: expect.stringMatching(/^(success|failure)$/),
      mode: 'normal',
      reason: null,
      target: null
    })
    expect(JSON.stringify(play.timeline(campaignId))).not.toMatch(/\bdc\b|tier|hard/i)
  })

  it('on advantage rolls both d20s and shows them with the reason', () => {
    addFighter('Wren')
    call('narrate', {
      text: 'The guard is distracted.',
      call: { ...lockCheck, adv: 'advantage', reason: 'The guard is distracted' }
    })
    const { id, parts } = openCall()!
    expect(parts[0].mode).toBe('advantage')

    play.roll(campaignId, id, parts[0].id)

    const roll = play.timeline(campaignId).entries.find((e) => e.type === 'roll')
    expect(roll).toMatchObject({ mode: 'advantage', reason: 'The guard is distracted' })
    expect(roll && 'dice' in roll && roll.dice).toHaveLength(2)
    expect(heard[0].content).toMatch(/d20 \d+\/\d+ \(advantage\) kept \d+/)
  })

  it('refuses a second roll of the same part', () => {
    addFighter('Wren')
    addFighter('Bram')
    call('narrate', { text: 'Both of you.', call: { ...lockCheck, character: ['Wren', 'Bram'] } })
    const { id, parts } = openCall()!

    play.roll(campaignId, id, parts[0].id)

    expect(() => play.roll(campaignId, id, parts[0].id)).toThrow(CallClosedError)
    expect(heard).toEqual([])
  })

  it('pushes the timeline change to the browser on each roll', () => {
    addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })
    pushed = []
    const { id, parts } = openCall()!

    play.roll(campaignId, id, parts[0].id)

    expect(pushed).toEqual([{ type: 'timeline', campaign: campaignId }])
  })
})

describe('a question Call', () => {
  it('offers its choices, and the answer arrives as the call result', () => {
    addFighter('Wren')
    call('narrate', {
      text: 'Two doors stand before you.',
      call: { kind: 'question', text: 'Which door?', choices: ['Left', 'Right'] }
    })
    const open = openCall()!
    expect(open).toMatchObject({
      kind: 'question',
      text: 'Which door?',
      choices: ['Left', 'Right']
    })
    expect(open.parts).toEqual([expect.objectContaining({ player: 'player', character: null })])

    expect(() => play.answer(campaignId, open.id, open.parts[0].id, 'Up')).toThrow(CallRefusedError)
    play.answer(campaignId, open.id, open.parts[0].id, 'Left')

    expect(heard).toEqual([
      {
        content: '[player] Left',
        meta: { kind: 'call_result', call_id: open.id, players: 'player' }
      }
    ])
    expect(play.timeline(campaignId).entries.at(-1)).toEqual({
      type: 'answer',
      id: expect.any(String),
      player: 'player',
      question: 'Which door?',
      text: 'Left'
    })
    expect(play.timeline(campaignId).awaitingSince).toEqual(expect.any(Number))
  })

  it('without choices takes free text', () => {
    addFighter('Wren')
    call('narrate', { text: 'The sphinx waits.', call: { kind: 'question', text: 'Your answer?' } })
    const open = openCall()!

    play.answer(campaignId, open.id, open.parts[0].id, 'A shadow')

    expect(heard[0].content).toBe('[player] A shadow')
  })
})

describe('an open Call', () => {
  it('is withdrawn by a Floor closed with Declarations', () => {
    const wren = addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })
    const { id, parts } = openCall()!

    library.floor(campaignId).send({ character: wren, text: 'I kick the door instead.' })
    play.done(campaignId)

    expect(openCall()).toBeNull()
    expect(() => play.roll(campaignId, id, parts[0].id)).toThrow(CallClosedError)
    expect(heard.map((e) => e.meta)).toEqual([
      expect.objectContaining({ kind: 'floor', withdrawn_call: id })
    ])
  })

  it('stays open through an empty Floor closing', () => {
    addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })

    play.done(campaignId)

    expect(openCall()).not.toBeNull()
  })

  it('survives a reload: a fresh library reads it back', () => {
    addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })
    const before = openCall()
    library.close()

    library = createCampaignLibrary({ home })
    expect(library.record(campaignId).timeline().call).toEqual(before)
  })

  it('refuses a second Call while one is open', () => {
    addFighter('Wren')
    call('narrate', { text: 'The lock is rusted.', call: lockCheck })

    expect(call('narrate', { text: 'And again.', call: lockCheck })).toEqual({
      isError: true,
      payload: expect.objectContaining({ code: 'call_open' })
    })
  })

  it('refuses a Check naming no Character in the Party', () => {
    addFighter('Wren')

    expect(call('narrate', { text: 'Hm.', call: { ...lockCheck, character: 'Nobody' } })).toEqual({
      isError: true,
      payload: expect.objectContaining({ code: 'unknown_character' })
    })
    expect(openCall()).toBeNull()
  })

  it('accepts a char: handle for the Character', () => {
    addFighter('Wren')

    expect(
      call('narrate', { text: 'Hm.', call: { ...lockCheck, character: 'char:wren' } }).isError
    ).toBe(false)
    expect(openCall()?.parts[0].character).toBe('Wren')
  })

  it('names a saving throw by its ability', () => {
    addFighter('Wren')
    call('narrate', {
      text: 'The floor gives way.',
      call: { kind: 'check', character: 'Wren', save: 'dex', tier: 'medium', reason: 'A trapdoor' }
    })

    expect(openCall()?.parts[0].label).toBe('Dexterity save')
  })
})
