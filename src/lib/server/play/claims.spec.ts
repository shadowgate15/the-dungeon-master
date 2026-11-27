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

  describe('Release', () => {
    const takenByGuest = () => {
      const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
      play.letGo(campaignId, wren, SOLO_PLAYER)
      play.claim(campaignId, wren, GUEST)
      pushed.length = 0
      return wren
    }

    it('lets the Host free a Character another browser holds, so that browser no longer holds it', () => {
      const wren = takenByGuest()

      play.release(campaignId, wren, SOLO_PLAYER)

      expect(standing(GUEST)).toEqual([['Wren', 'free']])
      expect(pushed).toEqual([{ type: 'claims', campaign: campaignId }])
    })

    it('refuses a Release from a browser that is not the Host', () => {
      const wren = takenByGuest()

      expect(() => play.release(campaignId, wren, 'other-browser')).toThrow(ClaimRefusedError)
      expect(() => play.release(campaignId, wren, GUEST)).toThrow(ClaimRefusedError)
      expect(standing(GUEST)).toEqual([['Wren', 'yours']])
      expect(pushed).toEqual([])
    })

    it('marks taken rows releasable for the Host only', () => {
      takenByGuest()

      expect(play.claims(campaignId, SOLO_PLAYER)[0]).toMatchObject({
        claim: 'taken',
        releasable: true
      })
      expect(play.claims(campaignId, GUEST)[0].releasable).toBeUndefined()
      expect(play.claims(campaignId, 'other-browser')[0].releasable).toBeUndefined()
    })
  })
})

describe('Claims on Drafts and edits', () => {
  const party = () => library.party(campaignId)

  it('Claims a Draft for the browser that starts it and shows it as taken to others', () => {
    const { id } = party().startDraft({ player: GUEST })

    expect(play.claims(campaignId, GUEST)).toMatchObject([{ kind: 'draft', id, claim: 'yours' }])
    expect(play.claims(campaignId, SOLO_PLAYER)).toMatchObject([
      { kind: 'draft', id, claim: 'taken' }
    ])
  })

  it('keeps the creator’s Claim on the finished Character', () => {
    const { id } = party().startDraft({ player: GUEST })
    const saved = party().saveDraft(id, { draft: fighterDraft('Wren'), step: 'review' }, GUEST)

    expect(play.claims(campaignId, GUEST)).toMatchObject([{ id: saved.id, claim: 'yours' }])
    expect(play.claims(campaignId, SOLO_PLAYER)).toMatchObject([{ id: saved.id, claim: 'taken' }])
  })

  it('refuses Draft writes, saves and discards from a browser without the Claim, the Host included', () => {
    const { id } = party().startDraft({ player: GUEST })
    const write = { draft: fighterDraft('Wren'), step: 'review' as const }

    expect(() => party().writeDraft(id, write, SOLO_PLAYER)).toThrow(ClaimRefusedError)
    expect(() => party().saveDraft(id, write, SOLO_PLAYER)).toThrow(ClaimRefusedError)
    expect(() => party().discardDraft(id, SOLO_PLAYER)).toThrow(ClaimRefusedError)
    expect(party().list()).toHaveLength(1)
  })

  it('refuses edits, details and level-ups from a browser without the Claim, the Host included', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.letGo(campaignId, wren, SOLO_PLAYER)
    play.claim(campaignId, wren, GUEST)

    expect(() => party().updateCharacter(wren, fighterDraft('Wren'), SOLO_PLAYER)).toThrow(
      ClaimRefusedError
    )
    expect(() => party().updateDetails(wren, { notes: 'Mine.' }, SOLO_PLAYER)).toThrow(
      ClaimRefusedError
    )
    expect(() => party().levelUp(wren, {}, SOLO_PLAYER)).toThrow(ClaimRefusedError)
    expect(() => party().updateDetails(wren, { notes: 'Mine.' }, 'free-browser')).toThrow(
      ClaimRefusedError
    )
  })

  it('lets the holder edit, and a Host edit once they Claim a freed Character between Sessions', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    play.letGo(campaignId, wren, SOLO_PLAYER)
    expect(() => party().updateDetails(wren, { notes: 'x' }, SOLO_PLAYER)).toThrow(
      ClaimRefusedError
    )

    play.claim(campaignId, wren, SOLO_PLAYER)
    expect(party().updateDetails(wren, { notes: 'Hers.' }, SOLO_PLAYER).notes).toBe('Hers.')
  })
})
