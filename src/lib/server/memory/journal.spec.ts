import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../db/connect'
import { place } from '../db/schema'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createSessionService, type SessionService } from '../session/service'
import { createJournal, type Journal } from './journal'
import { createMemoryRepository, type MemoryRepository } from './repository'

const HERO = {
  name: 'Brenna',
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
} as Parameters<ReturnType<typeof createCharacterService>['create']>[0]

let db: ReturnType<typeof openDatabase>
let sessions: SessionService
let memory: MemoryRepository
let journal: Journal
let campaignId: string
let characterId: string
let s1: string

/** Ends the open Session and starts the next one. */
function nextSession() {
  const open = sessions.list(campaignId).find((s) => s.endedAt === null)
  if (open) sessions.end(open.id)
  return sessions.start(campaignId).id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const w = createWorldService(db).create({ name: 'Eldoria' })
  campaignId = createCampaignService(db).create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  characterId = createCharacterService(db).create(HERO).id
  sessions = createSessionService(db)
  sessions.linkCharacter(campaignId, characterId)
  s1 = sessions.start(campaignId).id
  memory = createMemoryRepository(db)
  journal = createJournal(db)
})

const GROM = { name: 'Grom', description: 'A scarred gate warden.', role: 'warden' }

describe('Journal view', () => {
  it('is empty before anything is recorded', () => {
    expect(journal.view(campaignId, characterId)).toEqual({ entries: [], unseen: 0 })
  })

  it('shows an NPC with status, stance toward the Character and what they know', () => {
    const at = { sessionId: s1, seq: 2 }
    const grom = memory.createNpc(campaignId, { ...GROM, status: 'alive' }, at)
    memory.setDisposition(grom.id, characterId, { stance: 'friendly', note: 'Owes a debt.' }, at)
    const fact = memory.createFact(
      campaignId,
      { title: 'The gate is cursed', detail: null, worldChanging: false },
      at
    )
    memory.link(grom.id, fact.id)

    const { entries } = journal.view(campaignId, characterId)

    expect(entries).toEqual([
      expect.objectContaining({
        kind: 'npc',
        name: 'Grom',
        summary: 'A scarred gate warden.',
        role: 'warden',
        status: 'alive',
        stance: 'friendly',
        knows: ['The gate is cursed'],
        session: 1
      }),
      expect.objectContaining({ kind: 'fact', name: 'The gate is cursed', session: 1 })
    ])
  })

  it('includes places, factions and events', () => {
    const at = { sessionId: s1, seq: 1 }
    db.insert(place)
      .values({
        campaignId,
        name: 'Ash Gate',
        description: 'A burnt gatehouse.',
        createdSessionId: s1,
        createdSeq: 1,
        changedSessionId: s1,
        changedSeq: 1,
        createdAt: 1,
        updatedAt: 1
      })
      .run()
    void at

    const { entries } = journal.view(campaignId, characterId)

    expect(entries).toEqual([
      expect.objectContaining({ kind: 'place', name: 'Ash Gate', summary: 'A burnt gatehouse.' })
    ])
  })

  it('omits retired and superseded facts', () => {
    const at = { sessionId: s1, seq: 2 }
    const old = memory.createFact(
      campaignId,
      { title: 'The bridge stands', detail: null, worldChanging: false },
      at
    )
    const wrong = memory.createFact(
      campaignId,
      { title: 'A rumour', detail: null, worldChanging: false },
      at
    )
    const next = memory.createFact(
      campaignId,
      { title: 'The bridge is burned', detail: null, worldChanging: true },
      at
    )
    memory.supersedeFact(old.id, next.id, 'burned', at)
    memory.retireFact(wrong.id, 'false', at)

    const names = journal.view(campaignId, characterId).entries.map((e) => e.name)

    expect(names).toEqual(['The bridge is burned'])
  })

  it('does not show another Campaign’s memory', () => {
    const w = createWorldService(db).create({ name: 'Other' })
    const other = createCampaignService(db).create(
      { name: 'Other', premise: 'x', tone: 'dark', length: 'short' },
      [w.id]
    ).id
    memory.createNpc(other, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })

    expect(journal.view(campaignId, characterId).entries).toEqual([])
  })

  it('numbers the Session an entry first appeared in', () => {
    memory.createNpc(campaignId, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })
    const s2 = nextSession()
    memory.createNpc(
      campaignId,
      { name: 'Mira', description: 'A ferrywoman.', role: 'ferry', status: 'alive' },
      { sessionId: s2, seq: 1 }
    )

    const sessionsOf = journal.view(campaignId, characterId).entries.map((e) => [e.name, e.session])

    expect(sessionsOf).toEqual([
      ['Grom', 1],
      ['Mira', 2]
    ])
  })
})

describe('Journal chips and the last-looked marker', () => {
  it('marks everything New and counts it until the player looks', () => {
    memory.createNpc(campaignId, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })

    const view = journal.view(campaignId, characterId)

    expect(view.unseen).toBe(1)
    expect(view.entries[0].chip).toEqual({ type: 'new' })
  })

  it('clears chips and the count once marked seen, and keeps the marker', () => {
    memory.createNpc(campaignId, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })

    journal.markSeen(campaignId, characterId)
    const view = journal.view(campaignId, characterId)

    expect(view.unseen).toBe(0)
    expect(view.entries[0].chip).toBeNull()
    expect(createJournal(db).view(campaignId, characterId).unseen).toBe(0)
  })

  it('marks only what changed after the marker, across Sessions', () => {
    const grom = memory.createNpc(
      campaignId,
      { ...GROM, status: 'alive' },
      { sessionId: s1, seq: 1 }
    )
    journal.markSeen(campaignId, characterId)
    const s2 = nextSession()
    memory.createNpc(
      campaignId,
      { name: 'Mira', description: 'A ferrywoman.', role: 'ferry', status: 'alive' },
      { sessionId: s2, seq: 1 }
    )
    memory.updateNpc(grom.id, { status: 'dead' }, { sessionId: s2, seq: 2 })

    const view = journal.view(campaignId, characterId)

    expect(view.unseen).toBe(2)
    expect(view.entries.find((e) => e.name === 'Mira')?.chip).toEqual({ type: 'new' })
    expect(view.entries.find((e) => e.name === 'Grom')?.chip).toEqual({
      type: 'updated',
      what: 'status'
    })
  })

  it('says what changed for a stance change, and plain Updated when it cannot tell', () => {
    const at1 = { sessionId: s1, seq: 1 }
    const grom = memory.createNpc(campaignId, { ...GROM, status: 'alive' }, at1)
    memory.setDisposition(grom.id, characterId, { stance: 'wary' }, at1)
    db.insert(place)
      .values({
        campaignId,
        name: 'Ash Gate',
        createdSessionId: s1,
        createdSeq: 1,
        changedSessionId: s1,
        changedSeq: 1,
        createdAt: 1,
        updatedAt: 1
      })
      .run()
    journal.markSeen(campaignId, characterId)
    const at2 = { sessionId: s1, seq: 4 }
    memory.setDisposition(grom.id, characterId, { stance: 'allied' }, at2)
    db.update(place).set({ changedSeq: 4 }).run()

    const { entries } = journal.view(campaignId, characterId)

    expect(entries.find((e) => e.name === 'Grom')?.chip).toEqual({
      type: 'updated',
      what: 'stance'
    })
    expect(entries.find((e) => e.name === 'Ash Gate')?.chip).toEqual({
      type: 'updated',
      what: null
    })
  })

  it('keeps the marker per Character', () => {
    memory.createNpc(campaignId, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })
    const other = createCharacterService(db).create({ ...HERO, name: 'Dax' }).id

    journal.markSeen(campaignId, characterId)

    expect(journal.view(campaignId, characterId).unseen).toBe(0)
    expect(journal.view(campaignId, other).unseen).toBe(1)
  })

  it('does not mark as seen what was recorded after the player last loaded the view', () => {
    memory.createNpc(campaignId, { ...GROM, status: 'alive' }, { sessionId: s1, seq: 1 })
    const shown = journal.view(campaignId, characterId)

    memory.createNpc(
      campaignId,
      { name: 'Mira', description: 'x', role: 'y', status: 'alive' },
      { sessionId: s1, seq: 5 }
    )
    journal.markSeen(campaignId, characterId, shown.through)

    expect(journal.view(campaignId, characterId).unseen).toBe(1)
  })
})
