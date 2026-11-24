import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { campaign, character, event } from '../db/schema'
import { addCharacter, fighterDraft } from './test-characters'
import { DmOnlyEditError } from './party'

let library: CampaignLibrary
let folder: string
let campaignId: string
let attached: boolean

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-offline-'))
  attached = false
  library = createCampaignLibrary({ home: path.join(tmp, 'home'), live: () => attached })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
})

afterEach(() => library.close())

const db = () => library.databaseFor(folder)!
const begin = () => db().update(campaign).set({ begunAt: 1 }).run()
const row = (id: string) =>
  db()
    .select()
    .from(character)
    .all()
    .find((c) => c.id === id)!
const changes = () =>
  db()
    .select()
    .from(event)
    .all()
    .filter((e) => e.kind === 'change')

/** A sitting that stopped without End Session: its Session stays open after the DM left. */
function leftSitting() {
  attached = true
  library.record(campaignId).openSession('old-bridge')
  attached = false
}

describe('allowed offline', () => {
  it('edits notes, personality and appearance without touching play state', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    begin()
    db().update(character).set({ currentHp: 3 }).run()

    library.party(campaignId).updateDetails(wren, {
      notes: 'Owes Tam a favour.',
      personality: 'Wry.',
      appearance: 'A scar across one brow.'
    })

    expect(row(wren)).toMatchObject({
      notes: 'Owes Tam a favour.',
      personality: 'Wry.',
      appearance: 'A scar across one brow.',
      currentHp: 3,
      version: 2
    })
    expect(changes().at(-1)).toMatchObject({
      summary: 'the Player edited Wren’s notes, personality and appearance',
      data: { handle: 'char:wren', version: 2 }
    })
  })

  it('adds a Character after Begin', () => {
    begin()
    const bram = addCharacter(library, campaignId, fighterDraft('Bram'))
    expect(row(bram).name).toBe('Bram')
  })

  it('logs offline edits in no Session, even with an earlier sitting left open', () => {
    leftSitting()
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    library.party(campaignId).updateDetails(wren, { notes: 'Lost her map.' })
    library.saveSeed(campaignId, { name: 'Ember Road', premise: 'A caravan road' })

    expect(changes().map((e) => e.sessionId)).toEqual([null, null, null])
  })

  it('archives the Campaign', () => {
    begin()
    expect(library.archive(campaignId).archivedAt).not.toBeNull()
  })

  it('rewrites a Character in the wizard before Begin, during creation', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    library
      .party(campaignId)
      .updateCharacter(wren, { ...fighterDraft('Wren'), backstory: 'Raised by monks.' })
    expect(row(wren).backstory).toBe('Raised by monks.')
  })
})

describe('DM-only, refused offline', () => {
  it('refuses a backstory edit after Begin', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    begin()
    expect(() =>
      library.party(campaignId).updateDetails(wren, { backstory: 'Secretly a princess.' })
    ).toThrow(DmOnlyEditError)
    expect(row(wren).backstory).toBeNull()
  })

  it('refuses the wizard rewrite after Begin, which would reset HP, slots and coin', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    begin()
    db().update(character).set({ currentHp: 3 }).run()
    expect(() =>
      library
        .party(campaignId)
        .updateCharacter(wren, { ...fighterDraft('Wren'), personality: 'Grim.' })
    ).toThrow(DmOnlyEditError)
    expect(row(wren)).toMatchObject({ currentHp: 3, personality: null })
  })

  it('takes a backstory edit after Begin while the DM is at the table', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    begin()
    attached = true
    library.party(campaignId).updateDetails(wren, { backstory: 'Raised by monks.' })
    expect(row(wren).backstory).toBe('Raised by monks.')
  })
})
