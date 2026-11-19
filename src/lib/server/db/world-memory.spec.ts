import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { playableCampaign } from '../session/fixture'
import type { Database } from './connect'
import * as s from './schema'

let db: Database
let campaignId: string
let characterId: string
let sessionId: string
let worldId: string
let now: number

const prov = () => ({ createdSessionId: sessionId, changedSessionId: sessionId })

const addPlace = (name = 'Inn') =>
  db
    .insert(s.place)
    .values({ campaignId, worldId, name, description: 'A place.', ...prov() })
    .returning()
    .get()

const addNpc = (name = 'Brenna', nameKey = 'brenna') =>
  db
    .insert(s.npc)
    .values({ campaignId, name, nameKey, description: 'd', role: 'r', ...prov() })
    .returning()
    .get()

const addFact = () =>
  db
    .insert(s.fact)
    .values({ campaignId, title: 't', detail: 'd', ...prov() })
    .returning()
    .get()

beforeEach(() => {
  now = 1000
  ;({ db, campaignId, characterId } = playableCampaign())
  worldId = db.select().from(s.worldCampaign).get()!.worldId
  sessionId = db
    .insert(s.session)
    .values({ campaignId, characterId, startedAt: now })
    .returning()
    .get().id
})

describe('World memory tables', () => {
  it('stores a place with exits whose target stays empty until used', () => {
    const inn = addPlace()
    const exit = db
      .insert(s.placeExit)
      .values({ placeId: inn.id, name: 'Cellar door' })
      .returning()
      .get()
    expect(exit.targetPlaceId).toBeNull()
    expect(inn.createdSeq).toBeNull()
    expect(inn.retiredAt).toBeNull()
    expect(() =>
      db.insert(s.placeExit).values({ placeId: inn.id, name: 'Cellar door' }).run()
    ).toThrow()
  })

  it('keeps NPC names unique per Campaign by normalized key', () => {
    addNpc()
    expect(() => addNpc('BRENNA!', 'brenna')).toThrow()
  })

  it('defaults an NPC alive and keeps retirement separate from status', () => {
    const npc = addNpc()
    expect(npc.status).toBe('alive')
    db.update(s.npc).set({ status: 'dead' }).where(eq(s.npc.id, npc.id)).run()
    expect(db.select().from(s.npc).get()!.retiredAt).toBeNull()
    expect(() =>
      db
        .update(s.npc)
        .set({ status: 'asleep' as never })
        .run()
    ).toThrow()
  })

  it('requires a retirement reason with the timestamp', () => {
    const npc = addNpc()
    expect(() =>
      db.update(s.npc).set({ retiredAt: now }).where(eq(s.npc.id, npc.id)).run()
    ).toThrow()
    db.update(s.npc)
      .set({ retiredAt: now, retiredReason: 'Mistaken.' })
      .where(eq(s.npc.id, npc.id))
      .run()
  })

  it('keys a disposition by NPC and Character and links knowledge to facts', () => {
    const npc = addNpc()
    const fact = addFact()
    db.insert(s.disposition)
      .values({ npcId: npc.id, characterId, stance: 'allied', changedSessionId: sessionId })
      .run()
    expect(() =>
      db
        .insert(s.disposition)
        .values({ npcId: npc.id, characterId, changedSessionId: sessionId })
        .run()
    ).toThrow()
    expect(() =>
      db
        .insert(s.disposition)
        .values({
          npcId: npc.id,
          characterId,
          stance: 'smitten' as never,
          changedSessionId: sessionId
        })
        .run()
    ).toThrow()
    db.insert(s.npcFact).values({ npcId: npc.id, factId: fact.id }).run()
  })

  it('makes facts immutable but supersedable and retirable', () => {
    const old = addFact()
    const next = addFact()
    expect(() =>
      db.update(s.fact).set({ detail: 'changed' }).where(eq(s.fact.id, old.id)).run()
    ).toThrow(/immutable/)
    expect(() =>
      db.update(s.fact).set({ worldChanging: true }).where(eq(s.fact.id, old.id)).run()
    ).toThrow(/immutable/)
    db.update(s.fact).set({ supersededById: next.id }).where(eq(s.fact.id, old.id)).run()
    db.update(s.fact)
      .set({ retiredAt: now, retiredReason: 'Mistaken.' })
      .where(eq(s.fact.id, next.id))
      .run()
  })

  it('cascades every record with its Campaign', () => {
    const inn = addPlace()
    db.insert(s.placeExit).values({ placeId: inn.id, name: 'Door' }).run()
    const npc = addNpc()
    const fact = addFact()
    db.insert(s.npcFact).values({ npcId: npc.id, factId: fact.id }).run()
    db.insert(s.disposition)
      .values({ npcId: npc.id, characterId, changedSessionId: sessionId })
      .run()
    db.delete(s.campaign).where(eq(s.campaign.id, campaignId)).run()
    for (const t of [s.place, s.placeExit, s.npc, s.fact, s.npcFact, s.disposition])
      expect(db.select().from(t).all()).toEqual([])
  })

  it('records memory runs with dropped items as kind and reason only', () => {
    const run = db
      .insert(s.memoryRun)
      .values({
        sessionId,
        kind: 'extraction',
        fromSeq: 1,
        toSeq: 4,
        outcome: 'success',
        accepted: 2,
        dropped: 1,
        droppedItems: [{ kind: 'npc', reason: 'name is already taken' }],
        durationMs: 120,
        createdAt: now
      })
      .returning()
      .get()
    expect(run.droppedItems).toEqual([{ kind: 'npc', reason: 'name is already taken' }])
    expect(() =>
      db
        .insert(s.memoryRun)
        .values({
          sessionId,
          kind: 'recap' as never,
          fromSeq: 1,
          toSeq: 1,
          outcome: 'success',
          durationMs: 1,
          createdAt: now
        })
        .run()
    ).toThrow()
  })
})

describe('Beat state', () => {
  it('defaults existing and new Beats to pending with no stamps', () => {
    const act = db.select().from(s.arcAct).get()
    void act
    const arc = db
      .insert(s.arc)
      .values({
        campaignId,
        title: 't',
        premise: 'p',
        stakes: 's',
        resolution: 'r',
        createdAt: 1,
        updatedAt: 1
      })
      .onConflictDoNothing()
      .returning()
      .get()
    const arcId = arc?.id ?? db.select().from(s.arc).get()!.id
    const a = db
      .insert(s.arcAct)
      .values({ arcId, position: 0, name: 'n', purpose: 'p' })
      .returning()
      .get()
    const beat = db
      .insert(s.arcBeat)
      .values({ actId: a.id, position: 0, title: 't', description: 'd' })
      .returning()
      .get()
    expect(beat.state).toBe('pending')
    expect(beat.stateSessionId).toBeNull()
    expect(() =>
      db
        .update(s.arcBeat)
        .set({ state: 'done' as never })
        .where(eq(s.arcBeat.id, beat.id))
        .run()
    ).toThrow()
  })
})
