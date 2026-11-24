import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { gameTools } from '../tools'
import { createToolHost, type ToolHost } from '../tools/host'
import { createPlay, DmAwayError, DmBusyError, type Play } from './play'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-play-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createChannels()
  heard = []
  pushed = []
  channels.listen(folder, (e) => heard.push(e))
  const publish = (m: LiveMessage) => pushed.push(m)
  host = createToolHost({ library, tools: gameTools, publish })
  play = createPlay({ library, channels, publish })
})

afterEach(() => library.close())

const addFighter = (name: string) => addCharacter(library, campaignId, fighterDraft(name))

/** The parsed payload of a tool call. */
function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

describe('Done', () => {
  it('closes the Floor and wakes the DM with one floor event listing every Declaration', () => {
    const wren = addFighter('Wren')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.' })
    floor.send({ character: wren, text: 'I keep an eye on the street.' })

    play.done(campaignId)

    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'floor', players: 'player' })
    expect(heard[0].meta.floor_id).toEqual(expect.any(String))
    expect(heard[0].content).toBe(
      '[d1 Wren · player] I pick the lock.\n[d2 Wren · player] I keep an eye on the street.'
    )
    expect(library.floor(campaignId).current().declarations).toEqual([])
  })

  it('sends a two-Character Floor as one event, in send order', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.' })
    floor.send({ character: bram, text: 'I bar the door.' })

    play.done(campaignId)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toBe(
      '[d1 Wren · player] I pick the lock.\n[d2 Bram · player] I bar the door.'
    )
  })

  it('on an empty Floor still wakes the DM, handing over the initiative', () => {
    addFighter('Wren')

    play.done(campaignId)

    expect(heard).toEqual([
      { content: '', meta: expect.objectContaining({ kind: 'floor', players: 'player' }) }
    ])
    expect(play.timeline(campaignId).awaitingSince).toEqual(expect.any(Number))
  })

  it('sets awaiting Narration, and is refused while the DM is still answering', () => {
    const wren = addFighter('Wren')
    library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })

    play.done(campaignId)

    expect(play.timeline(campaignId).awaitingSince).toEqual(expect.any(Number))
    expect(() => play.done(campaignId)).toThrow(DmBusyError)
    expect(heard).toHaveLength(1)
  })

  it('tells the browser the Floor and the timeline changed', () => {
    addFighter('Wren')

    play.done(campaignId)

    expect(pushed).toEqual([
      { type: 'floor', campaign: campaignId },
      { type: 'timeline', campaign: campaignId }
    ])
  })
})

describe('narrate', () => {
  it('clears awaiting Narration and puts the Narration in the timeline', () => {
    const wren = addFighter('Wren')
    library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
    play.done(campaignId)

    expect(call('narrate', { text: 'The lock clicks open.' })).toEqual({
      isError: false,
      payload: expect.anything()
    })

    const timeline = play.timeline(campaignId)
    expect(timeline.awaitingSince).toBeNull()
    expect(timeline.entries).toEqual([
      {
        type: 'declaration',
        id: expect.any(String),
        character: 'Wren',
        player: 'player',
        text: 'I pick the lock.'
      },
      { type: 'narration', id: expect.any(String), text: 'The lock clicks open.', voice: null }
    ])
  })

  it('answers a two-Character Floor with one Narration', () => {
    const wren = addFighter('Wren')
    const bram = addFighter('Bram')
    const floor = library.floor(campaignId)
    floor.send({ character: wren, text: 'I pick the lock.' })
    floor.send({ character: bram, text: 'I bar the door.' })
    play.done(campaignId)

    call('narrate', { text: 'The lock gives; the door holds.' })

    expect(play.timeline(campaignId).entries.map((e) => e.type)).toEqual([
      'declaration',
      'declaration',
      'narration'
    ])
  })

  it('allows later Narrations in the same turn', () => {
    addFighter('Wren')
    play.done(campaignId)

    call('narrate', { text: 'Rain hammers the shutters.' })
    expect(call('narrate', { text: 'Somewhere a dog barks.' }).isError).toBe(false)

    expect(play.timeline(campaignId).entries).toHaveLength(2)
  })

  it('shows the NPC a Narration is voiced by, by name', () => {
    const npc = call('establish', { type: 'npc', name: 'Mira Voss' }).payload.handle

    call('narrate', { text: '"You are late," she says.', voice: npc })

    expect(play.timeline(campaignId).entries).toEqual([
      expect.objectContaining({ type: 'narration', voice: 'Mira Voss' })
    ])
  })

  it('refuses a voice that names no NPC', () => {
    expect(call('narrate', { text: 'Hello.', voice: 'npc:nobody' })).toEqual({
      isError: true,
      payload: expect.objectContaining({ code: 'unknown_handle' })
    })
  })

  it('pushes the timeline change to the browser', () => {
    call('narrate', { text: 'The lock clicks open.' })

    expect(pushed).toContainEqual({ type: 'timeline', campaign: campaignId })
  })
})

describe('Sessions', () => {
  it('stamps Declarations and Narrations with the Session the DM opened on attach', () => {
    const wren = addFighter('Wren')
    play.openSession(campaignId)
    library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
    play.done(campaignId)
    call('narrate', { text: 'The lock clicks open.' })

    const logged = host.events(folder).filter((e) => ['declaration', 'narration'].includes(e.kind))
    expect(logged.map((e) => e.kind)).toEqual(['declaration', 'narration'])
    const [session] = new Set(logged.map((e) => e.session))
    expect(session).toEqual(expect.any(String))
    expect(logged.every((e) => e.session === session && e.minute === 0)).toBe(true)
  })

  it('reuses the open Session when the DM reattaches', () => {
    const first = play.openSession(campaignId)
    expect(play.openSession(campaignId)).toEqual(first)
  })

  it('leaves offline changes outside any Session', () => {
    call('narrate', { text: 'Offline.' })
    expect(host.events(folder).at(-1)?.session).toBeNull()
  })
})

describe('DM activity', () => {
  it('shows a Player-safe line for each tool call, never the raw result', () => {
    call('seed')
    call('establish', { type: 'npc', name: 'Mira Voss', page: 'Secretly the smuggler queen.' })

    const timeline = play.timeline(campaignId)
    expect(timeline.entries).toEqual([
      expect.objectContaining({ type: 'activity', text: 'DM checks the Campaign Seed' })
    ])
    const wire = JSON.stringify({ timeline, pushed })
    expect(wire).not.toContain('npc:')
    expect(wire).not.toContain('smuggler')
    expect(pushed.every((m) => Object.keys(m).sort().join() === 'campaign,type')).toBe(true)
  })

  it('a failed call shows no line', () => {
    call('narrate', { text: 'Hello.', voice: 'npc:nobody' })
    expect(play.timeline(campaignId).entries).toEqual([])
  })
})

describe('End Session', () => {
  it('wakes the DM with one end_session event and leaves awaiting Narration alone', () => {
    play.endSession(campaignId)

    expect(heard).toEqual([{ content: expect.any(String), meta: { kind: 'end_session' } }])
    expect(play.timeline(campaignId).awaitingSince).toBeNull()
  })
})

describe('spotlight requests', () => {
  it('asks the DM to cut to a Character elsewhere, without awaiting Narration', () => {
    addFighter('Wren')
    const bram = addFighter('Bram')
    call('establish', { type: 'place', name: 'The Docks' })
    call('establish', { type: 'place', name: 'Drowned Lantern' })
    call('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    call('move', { who: ['char:bram'], to: 'place:the-docks' })
    call('set_scene', { place: 'place:drowned-lantern' })

    play.spotlight(campaignId, bram)

    expect(heard).toEqual([
      {
        content: 'Cut to Bram (char:bram), at place:the-docks',
        meta: { kind: 'spotlight', character: 'char:bram', player: 'player' }
      }
    ])
    expect(play.timeline(campaignId).awaitingSince).toBeNull()
  })

  it('is refused for a Character already in the Scene', () => {
    const wren = addFighter('Wren')
    expect(() => play.spotlight(campaignId, wren)).toThrow(/already in the Scene/)
    expect(heard).toEqual([])
  })
})

describe('the creation conversation', () => {
  it('hands a pane message to the DM as one conversation event, outside the Floor', () => {
    play.converse(campaignId, 'Can you help with the premise?')

    expect(heard).toEqual([
      {
        content: 'Can you help with the premise?',
        meta: { kind: 'conversation', player: 'player' }
      }
    ])
    expect(library.conversation(campaignId).list()).toEqual([
      expect.objectContaining({
        author: 'player',
        player: 'player',
        text: 'Can you help with the premise?'
      })
    ])
    expect(pushed).toContainEqual({ type: 'conversation', campaign: campaignId })
    expect(library.record(campaignId).timeline().awaitingSince).toBeNull()
  })

  it('shows the DM’s reply in the pane', () => {
    play.converse(campaignId, 'Can you help with the premise?')
    expect(call('reply', { text: 'Gladly. What draws you to the hills?' }).isError).toBe(false)
    expect(
      library
        .conversation(campaignId)
        .list()
        .map((m) => [m.author, m.text])
    ).toEqual([
      ['player', 'Can you help with the premise?'],
      ['dm', 'Gladly. What draws you to the hills?']
    ])
  })

  it('lands nothing in the Event log or the timeline', () => {
    play.converse(campaignId, 'Hello?')
    call('reply', { text: 'Hello.' })
    expect(host.events(folder)).toEqual([])
    expect(library.record(campaignId).timeline().entries).toEqual([])
  })

  it('refuses a message while no DM is at the table', () => {
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })
    expect(() => away.converse(campaignId, 'Hello?')).toThrow(DmAwayError)
    expect(library.conversation(campaignId).list()).toEqual([])
  })
})
