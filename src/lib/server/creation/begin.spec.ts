import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent, type Channels } from '../bridge/channels'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createPlay, DmAwayError, type Play } from '../play/play'
import { gameTools } from '../tools'
import { createToolHost, type ToolHost } from '../tools/host'
import { BeginRefusedError, SeedLockedError, StartOverRefusedError } from './begin'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let channels: Channels
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = tempDir('begin')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  channels = createChannels()
  heard = []
  pushed = []
  channels.listen(folder, (e) => heard.push(e))
  const publish = (m: LiveMessage) => pushed.push(m)
  host = createToolHost({ library, tools: gameTools, publish })
  play = createPlay({ library, channels, publish })
})

afterEach(() => library.close())

function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

const completeSeed = {
  name: 'Ember Road',
  premise: 'Escort a relic across the burning hills.',
  tone: 'heroic',
  length: 'short'
}

const ready = () => {
  library.saveSeed(campaignId, completeSeed)
  addCharacter(library, campaignId, fighterDraft('Wren'))
}

describe('Begin', () => {
  it('is refused while the Seed is incomplete', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    expect(() => play.begin(campaignId, SOLO_PLAYER)).toThrow(BeginRefusedError)
    expect(heard).toEqual([])
  })

  it('is refused until a Character is saved', () => {
    library.saveSeed(campaignId, completeSeed)
    library.party(campaignId).startDraft({ player: SOLO_PLAYER })
    expect(() => play.begin(campaignId, SOLO_PLAYER)).toThrow(BeginRefusedError)
    expect(heard).toEqual([])
  })

  it('wakes the DM with one begin event once the Seed is complete and a Character saved', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'begin', player: 'player' })
    expect(call('creation_state').payload).toMatchObject({ state: 'begun' })
  })

  it('needs a DM at the table', () => {
    ready()
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })
    expect(() => away.begin(campaignId, SOLO_PLAYER)).toThrow(DmAwayError)
    expect(call('creation_state').payload).toMatchObject({ state: 'ready' })
  })

  it('is refused once the story has begun', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    expect(() => play.begin(campaignId, SOLO_PLAYER)).toThrow(BeginRefusedError)
    expect(heard).toHaveLength(1)
  })

  it('logs nothing and leaves nothing awaiting Narration', () => {
    ready()
    const before = host.events(folder).length
    play.begin(campaignId, SOLO_PLAYER)
    expect(host.events(folder)).toHaveLength(before)
    expect(library.record(campaignId).timeline().awaitingSince).toBeNull()
  })
})

describe('the Seed lock', () => {
  it('refuses the Player’s Seed edits after Begin', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    expect(() =>
      library.saveSeed(campaignId, { ...completeSeed, premise: 'Something else.' })
    ).toThrow(SeedLockedError)
    expect(library.seed(campaignId).premise).toBe(completeSeed.premise)
  })

  it('refuses the DM’s set_seed after Begin', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    const { version } = call('seed').payload
    const result = call('set_seed', { version, premise: 'Something else.' })
    expect(result).toMatchObject({ isError: true, payload: { code: 'seed_locked' } })
    expect(library.seed(campaignId).premise).toBe(completeSeed.premise)
  })
})

/** What builder writes at Begin: an NPC, the pitch as the Party's Beliefs, and the Arc. */
function build() {
  call('establish', {
    type: 'npc',
    name: 'Vizier Oren',
    fields: {},
    facts: [{ claim: 'Vizier Oren secretly leads the cult.' }]
  })
  call('reveal', {
    claim: 'A relic must cross the burning hills before the solstice.',
    about: 'npc:vizier-oren',
    holders: ['char:wren'],
    source: 'the pitch'
  })
  const arc = call('create_arc', {
    title: 'The Ember Relic',
    premise: 'A cult wants the relic.',
    stakes: 'The hills burn.',
    acts: [
      {
        name: 'The Road',
        purpose: 'Leave town.',
        beats: [{ title: 'Ambush', description: 'The cult strikes.' }]
      }
    ],
    resolution: 'The relic is sealed.'
  })
  expect(arc.isError).toBe(false)
}

describe('Start over', () => {
  it('discards the World and the Arc and unlocks the Seed before the first Narration', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    build()

    play.startOver(campaignId)

    expect(call('creation_state').payload).toMatchObject({ state: 'ready' })
    expect(call('search', { query: 'Oren' }).payload).toMatchObject({ results: [] })
    expect(library.record(campaignId).journal().entries).toEqual([])
    expect(
      call('create_arc', {
        title: 'A New Arc',
        premise: 'p',
        stakes: 's',
        acts: [{ name: 'A', purpose: 'p', beats: [{ title: 'Ambush', description: 'd' }] }],
        resolution: 'r'
      }).isError
    ).toBe(false)
    library.saveSeed(campaignId, { ...completeSeed, premise: 'A different road.' })
    expect(library.seed(campaignId).premise).toBe('A different road.')
  })

  it('works with the DM away', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })
    away.startOver(campaignId)
    expect(call('creation_state').payload).toMatchObject({ state: 'ready' })
  })

  it('is refused after the first Narration of play', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    build()
    call('narrate', { text: 'The road out of Ashford is quiet.' })
    expect(() => play.startOver(campaignId)).toThrow(StartOverRefusedError)
    expect(call('creation_state').payload).toMatchObject({ state: 'begun' })
  })

  it('is refused before Begin', () => {
    ready()
    expect(() => play.startOver(campaignId)).toThrow(StartOverRefusedError)
  })
})

describe('what the Player sees after Begin', () => {
  it('is the pitch as their Characters’ Beliefs, and no Arc content anywhere', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    build()
    call('narrate', { text: 'The road out of Ashford is quiet.' })

    const journal = library.record(campaignId).journal()
    expect(journal.entries).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('A relic must cross the burning hills'),
        holders: [expect.objectContaining({ name: 'Wren' })]
      })
    ])
    const payloads = JSON.stringify([
      journal,
      library.record(campaignId).timeline(),
      play.scene(campaignId, SOLO_PLAYER),
      pushed
    ])
    expect(payloads).not.toMatch(/Ember Relic|Ambush|cult|arc/i)
  })

  it('has a timeline that starts with the first Narration after Begin', () => {
    ready()
    play.begin(campaignId, SOLO_PLAYER)
    build()
    expect(library.record(campaignId).timeline().entries).toEqual([])

    call('narrate', { text: 'The road out of Ashford is quiet.' })
    expect(library.record(campaignId).timeline().entries).toEqual([
      expect.objectContaining({ type: 'narration', text: 'The road out of Ashford is quiet.' })
    ])
  })
})

describe('party', () => {
  it('gives builder each Character’s handle, concept and story to build from', () => {
    addCharacter(library, campaignId, {
      ...fighterDraft('Wren'),
      backstory: 'Raised by the lighthouse keeper of Saltgate.'
    })
    expect(call('party').payload).toEqual({
      characters: [
        expect.objectContaining({
          handle: 'char:wren',
          name: 'Wren',
          level: 1,
          race: 'Human',
          class: 'Fighter',
          background: 'Acolyte',
          backstory: 'Raised by the lighthouse keeper of Saltgate.'
        })
      ]
    })
  })
})
