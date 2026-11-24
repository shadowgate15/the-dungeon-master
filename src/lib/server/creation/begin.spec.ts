import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels, type ChannelEvent, type Channels } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createPlay, DmAwayError, type Play } from '../play/play'
import { gameTools } from '../tools'
import { createToolHost, type ToolHost } from '../tools/host'
import { BeginRefusedError, SeedLockedError } from './begin'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let channels: Channels
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-begin-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
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
    expect(() => play.begin(campaignId)).toThrow(BeginRefusedError)
    expect(heard).toEqual([])
  })

  it('is refused until a Character is saved', () => {
    library.saveSeed(campaignId, completeSeed)
    library.party(campaignId).startDraft()
    expect(() => play.begin(campaignId)).toThrow(BeginRefusedError)
    expect(heard).toEqual([])
  })

  it('wakes the DM with one begin event once the Seed is complete and a Character saved', () => {
    ready()
    play.begin(campaignId)
    expect(heard).toHaveLength(1)
    expect(heard[0].meta).toMatchObject({ kind: 'begin', player: 'player' })
    expect(call('creation_state').payload).toMatchObject({ state: 'begun' })
  })

  it('needs a DM at the table', () => {
    ready()
    const away = createPlay({ library, channels: createChannels(), publish: () => {} })
    expect(() => away.begin(campaignId)).toThrow(DmAwayError)
    expect(call('creation_state').payload).toMatchObject({ state: 'ready' })
  })

  it('is refused once the story has begun', () => {
    ready()
    play.begin(campaignId)
    expect(() => play.begin(campaignId)).toThrow(BeginRefusedError)
    expect(heard).toHaveLength(1)
  })

  it('logs nothing and leaves nothing awaiting Narration', () => {
    ready()
    const before = host.events(folder).length
    play.begin(campaignId)
    expect(host.events(folder)).toHaveLength(before)
    expect(library.record(campaignId).timeline().awaitingSince).toBeNull()
  })
})

describe('the Seed lock', () => {
  it('refuses the Player’s Seed edits after Begin', () => {
    ready()
    play.begin(campaignId)
    expect(() =>
      library.saveSeed(campaignId, { ...completeSeed, premise: 'Something else.' })
    ).toThrow(SeedLockedError)
    expect(library.seed(campaignId).premise).toBe(completeSeed.premise)
  })

  it('refuses the DM’s set_seed after Begin', () => {
    ready()
    play.begin(campaignId)
    const { version } = call('seed').payload
    const result = call('set_seed', { version, premise: 'Something else.' })
    expect(result).toMatchObject({ isError: true, payload: { code: 'seed_locked' } })
    expect(library.seed(campaignId).premise).toBe(completeSeed.premise)
  })
})
