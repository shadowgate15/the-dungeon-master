import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { ClaimRefusedError } from '../character/party'
import { createPlay, DmAwayError, type Play } from './play'

const GUEST = 'guest-browser'

let library: CampaignLibrary
let play: Play
let folder: string
let campaignId: string
let heard: ChannelEvent[]
let stopListening: (() => void) | null
let attached: boolean

beforeEach(() => {
  const tmp = tempDir('depart')
  attached = true
  library = testLibrary({ home: path.join(tmp, 'home'), live: () => attached })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const hub = createChannels()
  heard = []
  stopListening = hub.listen(folder, (e) => heard.push(e))
  play = createPlay({ library, channels: hub, publish: () => {} })
})

afterEach(() => library.close())

const away = () => {
  attached = false
  stopListening?.()
}

const standing = (viewer: string) =>
  play.claims(campaignId, viewer).map((row) => [row.name, row.claim])

const statusOf = (id: string) =>
  library
    .party(campaignId)
    .list()
    .find((m) => m.id === id)

describe('Depart', () => {
  it('sets the status, drops the Claim, withdraws Declarations and tells the DM', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I bar the door.', player: SOLO_PLAYER })

    play.depart(campaignId, wren, SOLO_PLAYER)

    expect(statusOf(wren)).toMatchObject({ status: 'departed' })
    expect(standing(GUEST)).toEqual([['Wren', 'free']])
    expect(library.floor(campaignId).current(SOLO_PLAYER).declarations).toEqual([])
    const told = heard.find((e) => e.meta.kind === 'claims')
    expect(told?.content).toContain('Wren')
    expect(told?.content).toMatch(/depart/i)
  })

  it('is refused without a live Session', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    away()

    expect(() => play.depart(campaignId, wren, SOLO_PLAYER)).toThrow(DmAwayError)
    expect(statusOf(wren)).toMatchObject({ status: 'alive' })
    expect(standing(SOLO_PLAYER)).toEqual([['Wren', 'yours']])
  })

  it('is refused without the Claim', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))

    expect(() => play.depart(campaignId, wren, GUEST)).toThrow(ClaimRefusedError)
    expect(statusOf(wren)).toMatchObject({ status: 'alive' })
  })
})

describe('Rejoin', () => {
  const departed = () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.depart(campaignId, wren, SOLO_PLAYER)
    heard.length = 0
    return wren
  }

  it('Claims the Character with a live Session and tells the DM', () => {
    const wren = departed()

    play.rejoin(campaignId, wren, GUEST)

    expect(statusOf(wren)).toMatchObject({ status: 'alive' })
    expect(standing(GUEST)).toEqual([['Wren', 'yours']])
    expect(heard.some((e) => e.meta.kind === 'claims')).toBe(true)
  })

  it('works with no Session, and the next opening brings the Character back', () => {
    const wren = departed()
    away()

    play.rejoin(campaignId, wren, GUEST)

    expect(standing(GUEST)).toEqual([['Wren', 'yours']])
    attached = true
    expect(play.sessionStart(campaignId)).toMatch(/Changed since last Session:[^]*Wren/)
  })

  it('refuses a Character that has not departed', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    expect(() => play.rejoin(campaignId, wren, SOLO_PLAYER)).toThrow(ClaimRefusedError)
  })

  it('does not let a plain Claim bring back a departed Character', () => {
    const wren = departed()
    expect(() => play.claim(campaignId, wren, GUEST)).toThrow(ClaimRefusedError)
  })
})
