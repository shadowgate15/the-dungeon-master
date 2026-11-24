import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChannelEvent } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { gameTools } from '../tools'
import { createToolHost } from '../tools/host'
import { createDmChannels } from './notices'
import { createPlay, type Play } from './play'

let library: CampaignLibrary
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let attached: boolean

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-notices-'))
  attached = true
  library = createCampaignLibrary({ home: path.join(tmp, 'home'), live: () => attached })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const channels = createDmChannels(library)
  heard = []
  channels.listen(folder, (e) => heard.push(e))
  play = createPlay({ library, channels, publish: () => {} })
})

afterEach(() => library.close())

const COMPLETE_SEED = {
  name: 'Ember Road',
  premise: 'A caravan road',
  tone: 'heroic',
  length: 'short'
}

describe('change notices', () => {
  it('a UI edit during a session rides on the next channel event as handle, version and summary', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    play.openSession(campaignId)
    library.saveSeed(campaignId, COMPLETE_SEED as never)

    play.done(campaignId)

    expect(heard).toHaveLength(1)
    expect(heard[0].content).toContain('Changed outside the DM:')
    expect(heard[0].content).toMatch(/^- campaign v2: the Player edited the Campaign Seed$/m)
  })

  it('reaches the DM once: the event after it carries no notice', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    play.openSession(campaignId)
    library.saveSeed(campaignId, COMPLETE_SEED as never)
    play.done(campaignId)
    createToolHost({ library, tools: gameTools }).call(folder, 'narrate', { text: 'Dust.' })

    play.done(campaignId)

    expect(heard).toHaveLength(2)
    expect(heard[1].content).not.toContain('Changed outside the DM')
  })

  it('a Character edit re-sends the whole Party part of the core block', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.openSession(campaignId)
    library
      .party(campaignId)
      .updateCharacter(wren, { ...fighterDraft('Wren'), personality: 'Wry.' })

    play.done(campaignId)

    expect(heard[0].content).toMatch(/^- char:wren v2: the Player edited Wren$/m)
    expect(heard[0].content).toContain('Party:\n- Wren (char:wren): HP 12/12')
  })

  it('an offline edit, made before the Session opened, is not a channel notice', () => {
    attached = false
    addCharacter(library, campaignId, fighterDraft('Wren'))
    library.saveSeed(campaignId, COMPLETE_SEED as never)
    play.openSession(campaignId)

    play.done(campaignId)

    expect(heard[0].content).not.toContain('Changed outside the DM')
  })
})

describe('changed since last sitting', () => {
  it('the next opening tells the DM of each offline edit: handle, version and summary', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.openSession(campaignId)
    attached = false
    library.party(campaignId).updateDetails(wren, { notes: 'Owes Tam a favour.' })

    attached = true
    const opening = play.sessionStart(campaignId)

    expect(opening).toContain('# Core block')
    expect(opening).toContain('Changed since last sitting:')
    expect(opening).toMatch(/^- char:wren v2: the Player edited Wren’s notes$/m)
  })

  it('tells the DM once: a later opening and the next channel event leave it out', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    attached = false
    library.party(campaignId).updateDetails(wren, { notes: 'Owes Tam a favour.' })
    attached = true
    play.sessionStart(campaignId)
    play.openSession(campaignId)

    expect(play.sessionStart(campaignId)).not.toContain('Changed since last sitting')
    play.done(campaignId)
    expect(heard[0].content).not.toContain('Changed')
  })

  it('says nothing changed when nothing did', () => {
    expect(play.sessionStart(campaignId)).not.toContain('Changed since last sitting')
  })

  it('asks for a Floor still awaiting Narration to be answered after the recap', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    play.done(campaignId)

    expect(play.sessionStart(campaignId)).toMatch(/awaits Narration.*after the recap/)
  })
})
