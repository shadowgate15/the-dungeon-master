import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { ArcDraft } from '#lib/arc/arc.ts'
import { createCampaignService, type CampaignService } from '../campaign/service'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { arcBeat, session } from '../db/schema'
import { createWorldService, type WorldService } from '../world/service'
import {
  ArcLockedError,
  ArcValidationError,
  createArcService,
  type ArcEdit,
  type ArcService
} from './service'

let db: Database
let arcs: ArcService
let campaigns: CampaignService
let worlds: WorldService
let campaignId: string
let worldId: string

const draft = (title = 'The Ember Crown'): ArcDraft => ({
  title,
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: [0, 1, 2].map((a) => ({
    name: `Act ${a}`,
    purpose: 'Things escalate.',
    beats: [0, 1].map((b) => ({ title: `Beat ${a}.${b}`, description: `Something ${a}.${b}.` }))
  })),
  resolution: 'The relic is destroyed.'
})

/** A started Session without the Character plumbing the service tests do not need. */
function startSession() {
  db.run(sql`PRAGMA foreign_keys = OFF`)
  db.insert(session).values({ campaignId, characterId: 'nobody', startedAt: 1 }).run()
  db.run(sql`PRAGMA foreign_keys = ON`)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  worlds = createWorldService(db)
  campaigns = createCampaignService(db)
  arcs = createArcService(db)
  worldId = worlds.create({ name: 'Eldoria' }).id
  campaignId = campaigns.create({ name: 'C', premise: 'P', tone: 'dark', length: 'short' }, [
    worldId
  ]).id
})

describe('Arc service', () => {
  it('has no Arc until one is generated, and can generate until a Session starts', () => {
    expect(arcs.get(campaignId)).toBeNull()
    expect(arcs.availability(campaignId)).toEqual({ canGenerate: true, structureLocked: false })
  })

  it('stores a generated Arc as a draft with stable Beat ids, all pending', () => {
    const arc = arcs.replaceWithDraft(campaignId, draft())

    expect(arc.status).toBe('draft')
    expect(arc.acts).toHaveLength(3)
    const beats = arc.acts.flatMap((a) => a.beats)
    expect(beats).toHaveLength(6)
    expect(new Set(beats.map((b) => b.id)).size).toBe(6)
    expect(beats.every((b) => b.state === 'pending')).toBe(true)
    expect(arcs.get(campaignId)?.title).toBe('The Ember Crown')
  })

  it('replaces the whole Arc on regenerate, back to a draft', () => {
    const first = arcs.replaceWithDraft(campaignId, draft('One'))
    arcs.save(campaignId, toEdit(first), { accept: true })

    const second = arcs.replaceWithDraft(campaignId, draft('Two'))

    expect(second.title).toBe('Two')
    expect(second.status).toBe('draft')
    expect(second.id).not.toBe(first.id)
    expect(db.select().from(arcBeat).all()).toHaveLength(6)
  })

  it('edits text, adds, deletes and reorders within ranges, keeping Beat ids', () => {
    const arc = arcs.replaceWithDraft(campaignId, draft())
    const edit = toEdit(arc)
    edit.title = 'Renamed'
    edit.acts[0].beats.reverse()
    edit.acts[1].beats.push({ title: 'New', description: 'Fresh.' })
    edit.acts.reverse()

    const saved = arcs.save(campaignId, edit)

    expect(saved.title).toBe('Renamed')
    expect(saved.status).toBe('draft')
    expect(saved.acts.map((a) => a.name)).toEqual(['Act 2', 'Act 1', 'Act 0'])
    expect(saved.acts[2].beats.map((b) => b.title)).toEqual(['Beat 0.1', 'Beat 0.0'])
    expect(saved.acts[2].beats[0].id).toBe(arc.acts[0].beats[1].id)
    expect(saved.acts[1].beats).toHaveLength(3)
  })

  it('rejects an edit outside the Length ranges or with an empty Act', () => {
    const edit = toEdit(arcs.replaceWithDraft(campaignId, draft()))
    edit.acts.pop()
    expect(() => arcs.save(campaignId, edit)).toThrow(ArcValidationError)

    const empty = toEdit(arcs.get(campaignId)!)
    empty.acts[0].beats = []
    expect(() => arcs.save(campaignId, empty)).toThrow(/at least one Beat/)
  })

  it('accepts: the Arc becomes accepted, and stays accepted through text edits', () => {
    const arc = arcs.replaceWithDraft(campaignId, draft())
    const accepted = arcs.save(campaignId, toEdit(arc), { accept: true })
    expect(accepted.status).toBe('accepted')

    const edit = toEdit(accepted)
    edit.premise = 'Fixed typo.'
    expect(arcs.save(campaignId, edit).status).toBe('accepted')
  })

  describe('after the first Session starts', () => {
    it('cannot generate or regenerate', () => {
      arcs.replaceWithDraft(campaignId, draft())
      startSession()

      expect(arcs.availability(campaignId)).toEqual({ canGenerate: false, structureLocked: true })
      expect(() => arcs.replaceWithDraft(campaignId, draft())).toThrow(ArcLockedError)
    })

    it('allows text edits that keep Beat state, but not structure changes', () => {
      const arc = arcs.replaceWithDraft(campaignId, draft())
      const beat = arc.acts[0].beats[0]
      db.update(arcBeat)
        .set({ state: 'reached', sourceTurnSeq: 4 })
        .where(sql`id = ${beat.id}`)
        .run()
      startSession()

      const edit = toEdit(arcs.get(campaignId)!)
      edit.acts[0].beats[0].title = 'Better title'
      const saved = arcs.save(campaignId, edit)
      expect(saved.acts[0].beats[0]).toMatchObject({
        title: 'Better title',
        state: 'reached',
        sourceTurnSeq: 4
      })

      const added = toEdit(saved)
      added.acts[0].beats.push({ title: 'x', description: 'y' })
      expect(() => arcs.save(campaignId, added)).toThrow(ArcLockedError)
      const reordered = toEdit(saved)
      reordered.acts.reverse()
      expect(() => arcs.save(campaignId, reordered)).toThrow(ArcLockedError)
    })
  })

  it('refuses generating or editing on an archived Campaign or one on an archived World', () => {
    const arc = arcs.replaceWithDraft(campaignId, draft())
    campaigns.archive(campaignId)
    expect(arcs.availability(campaignId).canGenerate).toBe(false)
    expect(() => arcs.replaceWithDraft(campaignId, draft())).toThrow(ArcLockedError)
    expect(() => arcs.save(campaignId, toEdit(arc))).toThrow(ArcLockedError)

    campaigns.restore(campaignId)
    worlds.archive(worldId)
    expect(() => arcs.save(campaignId, toEdit(arc))).toThrow(ArcLockedError)
  })
})

/** The editable shape of a stored Arc: ids kept so Beats stay the same rows. */
function toEdit(arc: NonNullable<ReturnType<ArcService['get']>>): ArcEdit {
  return {
    title: arc.title,
    premise: arc.premise,
    stakes: arc.stakes,
    resolution: arc.resolution,
    acts: arc.acts.map((a) => ({
      id: a.id,
      name: a.name,
      purpose: a.purpose,
      beats: a.beats.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description
      }))
    }))
  }
}
