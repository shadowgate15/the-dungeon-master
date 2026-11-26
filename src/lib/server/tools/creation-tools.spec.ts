import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import { emptyDraft, type CharacterDraft } from '#lib/character/draft.ts'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { campaign } from '../db/schema'
import { gameTools } from '.'
import { createToolHost, type ToolHost } from './host'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = tempDir('creation')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  pushed = []
  host = createToolHost({ library, tools: gameTools, publish: (m) => pushed.push(m) })
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

describe('creation_state', () => {
  it('is seed_incomplete until every required Seed field is set', () => {
    expect(call('creation_state').payload).toMatchObject({
      state: 'seed_incomplete',
      missing: ['premise', 'tone', 'length']
    })
  })

  it('is party_empty once the Seed is complete but no Character is saved', () => {
    library.saveSeed(campaignId, completeSeed)
    library.party(campaignId).startDraft()
    expect(call('creation_state').payload).toMatchObject({
      state: 'party_empty',
      missing: [],
      characters: 0,
      drafts: [expect.objectContaining({ handle: expect.stringMatching(/^draft:/) })]
    })
  })

  it('is ready with a complete Seed and a saved Character', () => {
    library.saveSeed(campaignId, completeSeed)
    addCharacter(library, campaignId, fighterDraft('Wren'))
    expect(call('creation_state').payload).toMatchObject({ state: 'ready', characters: 1 })
  })

  it('is begun once the Campaign has begun', () => {
    library.saveSeed(campaignId, completeSeed)
    addCharacter(library, campaignId, fighterDraft('Wren'))
    // Begin itself is #335's server operation; until it lands the stage is the column it sets.
    library.databaseFor(folder)!.update(campaign).set({ begunAt: 1 }).run()
    expect(call('creation_state').payload).toMatchObject({ state: 'begun' })
  })

  it('logs nothing and adds no DM-activity line', () => {
    call('creation_state')
    expect(host.events(folder)).toEqual([])
    expect(library.record(campaignId).timeline().entries).toEqual([])
  })
})

describe('set_seed', () => {
  it('validates like the Seed card, with the same errors', () => {
    expect(call('set_seed', { version: 1, tone: 'whimsical' }).payload).toMatchObject({
      code: 'invalid_input',
      message: 'Invalid tone: whimsical'
    })
    expect(call('set_seed', { version: 1, name: '  ' }).payload).toMatchObject({
      code: 'invalid_input',
      message: 'Name is required'
    })
    expect(library.dmSeedFields(campaignId)).toEqual([])
  })

  it('marks the fields it set "✎ DM" until the Player edits them', () => {
    call('set_seed', { version: 1, premise: 'Escort a relic.', tone: 'heroic', name: 'Ember Road' })
    expect(library.seed(campaignId)).toMatchObject({ premise: 'Escort a relic.', tone: 'heroic' })
    expect(library.dmSeedFields(campaignId)).toEqual(['premise', 'tone'])

    library.saveSeed(campaignId, { ...library.seed(campaignId), tone: 'tense' })
    expect(library.dmSeedFields(campaignId)).toEqual(['premise'])
  })

  it('shows the write as a muted line in the conversation and pushes it to the open card', () => {
    call('set_seed', { version: 1, premise: 'Escort a relic.' })
    expect(library.conversation(campaignId).list()).toEqual([
      expect.objectContaining({ author: 'dm_write', text: 'DM set the Seed’s premise' })
    ])
    expect(pushed).toEqual(
      expect.arrayContaining([
        { type: 'seed', campaign: campaignId },
        { type: 'conversation', campaign: campaignId }
      ])
    )
  })

  it('keeps creation out of the Event log and the timeline', () => {
    call('set_seed', { version: 1, premise: 'Escort a relic.' })
    expect(host.events(folder)).toEqual([])
    expect(library.record(campaignId).timeline().entries).toEqual([])
    expect(pushed).not.toContainEqual({ type: 'timeline', campaign: campaignId })
  })
})

describe('Character draft tools', () => {
  /** A stored draft with the Player's own Concept answers; returns its handle. */
  function startDraft(patch: Partial<CharacterDraft> = {}) {
    const party = library.party(campaignId)
    const { id } = party.startDraft()
    party.writeDraft(id, { draft: { ...emptyDraft(), name: 'Wren', ...patch }, step: 'concept' })
    return { id, handle: `draft:${id}` }
  }

  const setFields = (handle: string, fields: Record<string, unknown>) => {
    const { version } = call('draft', { draft: handle }).payload
    return call('set_draft_fields', { draft: handle, version, fields })
  }

  it('reads a draft with its version and the totals its method gave', () => {
    const { handle } = startDraft({ abilityMethod: 'rolling', abilityRolls: ROLLS })
    expect(call('draft', { draft: handle }).payload).toMatchObject({
      handle,
      version: expect.any(Number),
      step: 'concept',
      fields: expect.objectContaining({ name: 'Wren', abilityMethod: 'rolling' }),
      rolledTotals: [15, 14, 13, 12, 10, 8]
    })
  })

  it('validates like the wizard, with the same messages', () => {
    const { handle } = startDraft()
    expect(setFields(handle, { backstory: 'x'.repeat(2001) }).payload).toMatchObject({
      code: 'invalid_input',
      message: 'Backstory is over 2000 characters.'
    })
    expect(setFields(handle, { race: 'kobold' }).payload).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('kobold')
    })
    expect(setFields(handle, { race: 'human', subrace: 'high-elf' }).payload).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('subrace')
    })
    expect(library.party(campaignId).draft(handle.slice(6)).draft.race).toBeNull()
  })

  it('refuses a stale version, naming the read to do', () => {
    const { handle } = startDraft()
    expect(call('set_draft_fields', { draft: handle, version: 99, fields: {} }).payload).toEqual({
      code: 'stale_version',
      message: expect.any(String),
      next: `draft ${handle}`
    })
  })

  it('never chooses the Ability Score Method', () => {
    const { handle } = startDraft()
    for (const fields of [{ abilityMethod: 'point-buy' }, { abilityRolls: ROLLS }]) {
      expect(setFields(handle, fields).payload).toMatchObject({ code: 'player_choice' })
    }
    expect(library.party(campaignId).draft(handle.slice(6)).draft.abilityMethod).toBeNull()
  })

  it('never invents ability values, only arranges what the method gave', () => {
    const scores = { str: 8, dex: 10, con: 12, int: 13, wis: 14, cha: 15 }
    const none = startDraft()
    expect(setFields(none.handle, { baseScores: scores }).payload).toMatchObject({
      code: 'player_choice'
    })

    const standard = startDraft({ abilityMethod: 'standard-array' })
    expect(
      setFields(standard.handle, { baseScores: { ...scores, str: 18 } }).payload
    ).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('15, 14, 13, 12, 10, 8')
    })
    expect(setFields(standard.handle, { baseScores: scores }).isError).toBe(false)

    const rolled = startDraft({ abilityMethod: 'rolling', abilityRolls: ROLLS })
    expect(setFields(rolled.handle, { baseScores: { ...scores, cha: 16 } }).isError).toBe(true)
    expect(setFields(rolled.handle, { baseScores: scores }).isError).toBe(false)

    const bought = startDraft({ abilityMethod: 'point-buy' })
    const overBudget = { str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 }
    expect(setFields(bought.handle, { baseScores: overBudget }).payload).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('budget')
    })
    const spent = { str: 15, dex: 14, con: 13, int: 10, wis: 10, cha: 8 }
    expect(setFields(bought.handle, { baseScores: spent }).isError).toBe(false)
    expect(library.party(campaignId).draft(bought.id).draft.baseScores).toEqual(spent)
  })

  it('marks the fields it set "✎ DM" until the Player edits them', () => {
    const { id, handle } = startDraft()
    setFields(handle, { race: 'human', backstory: 'Raised by the lighthouse keeper.' })
    const party = library.party(campaignId)
    const stored = party.draft(id)
    expect(stored).toMatchObject({
      draft: { race: 'human', backstory: 'Raised by the lighthouse keeper.' },
      dmFields: ['race', 'backstory']
    })

    // The open wizard writes the draft back unchanged: the marks and the version stay.
    party.writeDraft(id, { draft: stored.draft, step: 'concept' })
    expect(party.draft(id)).toMatchObject({
      version: stored.version,
      dmFields: ['race', 'backstory']
    })

    party.writeDraft(id, { draft: { ...stored.draft, backstory: 'Mine now.' }, step: 'concept' })
    expect(party.draft(id)).toMatchObject({ version: stored.version + 1, dmFields: ['race'] })
  })

  it('shows the write as a muted line and pushes it to the open wizard, logging nothing', () => {
    const { id, handle } = startDraft()
    setFields(handle, { backstory: 'Raised by the lighthouse keeper.' })
    expect(library.conversation(campaignId).list()).toEqual([
      expect.objectContaining({ author: 'dm_write', text: 'DM set Wren’s backstory' })
    ])
    expect(pushed).toContainEqual({ type: 'draft', campaign: campaignId, draft: id })
    expect(host.events(folder)).toEqual([])
  })
})

/** Six rolled rows whose totals are the standard array's values. */
const ROLLS = [
  [5, 5, 5, 1],
  [5, 5, 4, 1],
  [5, 4, 4, 1],
  [4, 4, 4, 1],
  [4, 3, 3, 1],
  [3, 3, 2, 1]
]
