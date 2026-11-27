import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { LiveMessage } from '#lib/live/messages.ts'
import { createChannels } from '../bridge/channels'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { ClaimRefusedError } from '../character/party'
import { createPlay, type Play } from './play'

let library: CampaignLibrary
let play: Play
let campaignId: string
let pushed: LiveMessage[]

const GUEST = 'guest-browser'

beforeEach(() => {
  const tmp = tempDir('claims')
  library = testLibrary({ home: path.join(tmp, 'home') })
  campaignId = library.create({
    name: 'Ember Road',
    folder: path.join(tmp, 'campaigns', 'ember-road')
  }).id
  pushed = []
  play = createPlay({ library, channels: createChannels(), publish: (m) => pushed.push(m) })
})

afterEach(() => library.close())

const standing = (viewer: string) =>
  play.claims(campaignId, viewer).map((row) => [row.name, row.claim])

describe('Claims', () => {
  it('keeps existing Characters Claimed by the Host and taken for everyone else', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))

    expect(standing(SOLO_PLAYER)).toEqual([['Wren', 'yours']])
    expect(standing(GUEST)).toEqual([['Wren', 'taken']])
  })

  it('lets a browser Let go, then another Claim, and says only yours, taken or free', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))

    play.letGo(campaignId, wren, SOLO_PLAYER)
    expect(standing(GUEST)).toEqual([['Wren', 'free']])

    play.claim(campaignId, wren, GUEST)
    expect(standing(GUEST)).toEqual([['Wren', 'yours']])
    expect(standing(SOLO_PLAYER)).toEqual([['Wren', 'taken']])
    expect(JSON.stringify(play.claims(campaignId, SOLO_PLAYER))).not.toContain(GUEST)
  })

  it('refuses to Claim a taken Character for every browser, the Host included', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.letGo(campaignId, wren, SOLO_PLAYER)
    play.claim(campaignId, wren, GUEST)

    expect(() => play.claim(campaignId, wren, SOLO_PLAYER)).toThrow(ClaimRefusedError)
    expect(() => play.claim(campaignId, wren, GUEST)).toThrow(ClaimRefusedError)
    expect(standing(GUEST)).toEqual([['Wren', 'yours']])
  })

  it('refuses to Let go of a Character the browser does not hold', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))

    expect(() => play.letGo(campaignId, wren, GUEST)).toThrow(ClaimRefusedError)
    expect(standing(SOLO_PLAYER)).toEqual([['Wren', 'yours']])
  })

  it('publishes a content-free claims message for every change', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))

    play.letGo(campaignId, wren, SOLO_PLAYER)
    play.claim(campaignId, wren, GUEST)

    expect(pushed.filter((m) => m.type === 'claims')).toEqual([
      { type: 'claims', campaign: campaignId },
      { type: 'claims', campaign: campaignId }
    ])
  })
})
