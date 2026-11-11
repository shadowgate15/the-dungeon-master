import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService, type CampaignService } from '../campaign/service'
import { createCharacterService, type CharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import {
  createSessionService,
  SessionAlreadyOpenError,
  SessionNotFoundError,
  SessionValidationError,
  type SessionService
} from './service'

let db: Database
let campaigns: CampaignService
let characters: CharacterService
let sessions: SessionService
let clock: number
let campaignId: string
let characterId: string

const newCharacter = (name: string) =>
  characters.create({
    name,
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    abilityMethod: 'standard-array',
    scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    picks: {
      'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
      'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
      'race/human/language-0': ['dwarvish'],
      'background/acolyte/language-0': ['elvish', 'halfling']
    },
    equipment: [
      { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
      { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
      { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
      { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
      { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
      { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' },
      { choiceKey: 'background/acolyte/equipment-0', item: 'amulet' }
    ]
  })

beforeEach(() => {
  clock = 1000
  db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const now = () => ++clock
  campaigns = createCampaignService(db, now)
  characters = createCharacterService(db, now)
  sessions = createSessionService(db, now)
  const w = createWorldService(db, now).create({ name: 'Eldoria' })
  campaignId = campaigns.create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  characterId = newCharacter('Brenna').id
})

describe('linking a Character to a Campaign', () => {
  it('links one Character, and linking another replaces it', () => {
    expect(sessions.linkedCharacterId(campaignId)).toBeUndefined()
    sessions.linkCharacter(campaignId, characterId)
    expect(sessions.linkedCharacterId(campaignId)).toBe(characterId)

    const other = newCharacter('Torvin')
    sessions.linkCharacter(campaignId, other.id)
    expect(sessions.linkedCharacterId(campaignId)).toBe(other.id)
  })

  it('refuses an archived Character and an unknown Campaign', () => {
    characters.archive(characterId)
    expect(() => sessions.linkCharacter(campaignId, characterId)).toThrow(SessionValidationError)
    expect(() => sessions.linkCharacter('nope', newCharacter('X').id)).toThrow(
      SessionValidationError
    )
  })

  it('refuses to change the Character while a Session is open', () => {
    sessions.linkCharacter(campaignId, characterId)
    sessions.start(campaignId)
    expect(() => sessions.linkCharacter(campaignId, newCharacter('Torvin').id)).toThrow(
      SessionValidationError
    )
  })

  it('is dropped when the Character is deleted', () => {
    sessions.linkCharacter(campaignId, characterId)
    characters.delete(characterId)
    expect(sessions.linkedCharacterId(campaignId)).toBeUndefined()
  })
})

describe('starting a Session', () => {
  it('needs a linked Character', () => {
    expect(() => sessions.start(campaignId)).toThrow(SessionValidationError)
  })

  it('opens a Session for the linked Character', () => {
    sessions.linkCharacter(campaignId, characterId)
    const s = sessions.start(campaignId)
    expect(s).toMatchObject({ campaignId, characterId, endedAt: null })
    expect(sessions.get(s.id)).toEqual(s)
    expect(sessions.openFor(campaignId)?.id).toBe(s.id)
  })

  it('refuses a second Session while one is open', () => {
    sessions.linkCharacter(campaignId, characterId)
    sessions.start(campaignId)
    expect(() => sessions.start(campaignId)).toThrow(SessionAlreadyOpenError)
  })

  it('refuses at the schema level too, not just in code', () => {
    sessions.linkCharacter(campaignId, characterId)
    sessions.start(campaignId)
    expect(() =>
      db.$client
        .prepare(
          'INSERT INTO session (id, campaign_id, character_id, started_at) VALUES (?, ?, ?, ?)'
        )
        .run('x', campaignId, characterId, 1)
    ).toThrow(/UNIQUE/)
  })

  it('allows a new Session once the last one has ended', () => {
    sessions.linkCharacter(campaignId, characterId)
    const first = sessions.start(campaignId)
    sessions.end(first.id)
    const second = sessions.start(campaignId)
    expect(second.id).not.toBe(first.id)
    expect(sessions.list(campaignId).map((s) => s.id)).toEqual([second.id, first.id])
  })

  it('refuses on an archived Campaign', () => {
    sessions.linkCharacter(campaignId, characterId)
    campaigns.archive(campaignId)
    expect(() => sessions.start(campaignId)).toThrow(SessionValidationError)
  })
})

describe('ending a Session', () => {
  it('records the end time and leaves the Session read-only', () => {
    sessions.linkCharacter(campaignId, characterId)
    const s = sessions.start(campaignId)
    const ended = sessions.end(s.id)
    expect(ended.endedAt).toBeGreaterThan(s.startedAt)
    expect(sessions.openFor(campaignId)).toBeUndefined()
  })

  it('is a no-op for an Session that already ended', () => {
    sessions.linkCharacter(campaignId, characterId)
    const s = sessions.start(campaignId)
    const ended = sessions.end(s.id)
    expect(sessions.end(s.id)).toEqual(ended)
  })

  it('reports an unknown Session', () => {
    expect(() => sessions.end('nope')).toThrow(SessionNotFoundError)
  })
})

describe('the transcript', () => {
  it('starts empty and lists Turns in sequence order', () => {
    sessions.linkCharacter(campaignId, characterId)
    const s = sessions.start(campaignId)
    expect(sessions.turns(s.id)).toEqual([])
    db.$client
      .prepare(
        "INSERT INTO turn (id, session_id, seq, author, kind, text, created_at) VALUES ('b', ?, 2, 'player', 'action', 'hi', 1), ('a', ?, 1, 'dm', 'narration', 'welcome', 1)"
      )
      .run(s.id, s.id)
    expect(sessions.turns(s.id).map((t) => t.seq)).toEqual([1, 2])
  })
})

describe('appending Turns', () => {
  const open = () => {
    sessions.linkCharacter(campaignId, characterId)
    return sessions.start(campaignId)
  }

  it('appends Turns in a monotonic sequence', () => {
    const s = open()
    sessions.appendTurn(s.id, { author: 'dm', kind: 'narration', text: 'A door.' })
    sessions.appendTurn(s.id, { author: 'player', kind: 'action', text: 'I open it.' })
    expect(sessions.turns(s.id).map((t) => [t.seq, t.author, t.text])).toEqual([
      [1, 'dm', 'A door.'],
      [2, 'player', 'I open it.']
    ])
  })

  it('rejects a Turn on an ended or unknown Session', () => {
    const s = open()
    sessions.end(s.id)
    expect(() =>
      sessions.appendTurn(s.id, { author: 'player', kind: 'action', text: 'Hello?' })
    ).toThrow(SessionValidationError)
    expect(() =>
      sessions.appendTurn('nope', { author: 'player', kind: 'action', text: 'Hello?' })
    ).toThrow(SessionNotFoundError)
    expect(sessions.turns(s.id)).toEqual([])
  })
})

describe('the rolling summary', () => {
  beforeEach(() => sessions.linkCharacter(campaignId, characterId))

  it('starts empty and is saved with the Turn it covers through', () => {
    const s = sessions.start(campaignId)
    expect(sessions.get(s.id)).toMatchObject({ summary: null, summarizedThroughSeq: 0 })
    sessions.saveSummary(s.id, 'The party reached the gate.', 4)
    expect(sessions.get(s.id)).toMatchObject({
      summary: 'The party reached the gate.',
      summarizedThroughSeq: 4
    })
  })

  it('carries the last Session final summary into a new Session', () => {
    const first = sessions.start(campaignId)
    sessions.saveSummary(first.id, 'Old news.', 2)
    sessions.end(first.id)
    const second = sessions.start(campaignId)
    sessions.saveSummary(second.id, 'Newer news.', 3)
    sessions.end(second.id)

    const third = sessions.start(campaignId)
    expect(third.summary).toBe('Newer news.')
    expect(third.summarizedThroughSeq).toBe(0)
  })

  it('carries an earlier summary past a Session that never wrote one', () => {
    const first = sessions.start(campaignId)
    sessions.saveSummary(first.id, 'Old news.', 2)
    sessions.end(first.id)
    sessions.end(sessions.start(campaignId).id)

    expect(sessions.start(campaignId).summary).toBe('Old news.')
  })
})
