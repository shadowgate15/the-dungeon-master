import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, migrateDatabase, type Database } from '../db/connect'
import { createWorldService, WorldInUseError, type WorldService } from '../world/service'
import {
  CampaignNotFoundError,
  CampaignValidationError,
  createCampaignService,
  type CampaignSeed,
  type CampaignService
} from './service'
import { LENGTHS, PREMISE_SERVICE_MAX, TONES } from '#lib/campaign/enums.ts'
import { NAME_MAX } from '#lib/world/seed.ts'

let db: Database
let worlds: WorldService
let campaigns: CampaignService
let clock: number

const seed = (over: Partial<CampaignSeed> = {}): CampaignSeed => ({
  name: 'The Sunken Crown',
  premise: 'Recover the crown before the tide does.',
  tone: 'dark',
  length: 'short',
  ...over
})

beforeEach(() => {
  clock = 1000
  db = openDatabase(':memory:')
  migrateDatabase(db)
  worlds = createWorldService(db, () => clock)
  campaigns = createCampaignService(db, () => clock)
})

const worldNames = (id: string) =>
  campaigns
    .get(id)!
    .worlds.map((w) => w.name)
    .sort()

describe('Campaign service', () => {
  describe('create', () => {
    it('creates a Campaign linked to its Worlds and returns it with them', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })

      const created = campaigns.create(seed(), [a.id, b.id])

      expect(created).toMatchObject({
        name: 'The Sunken Crown',
        premise: 'Recover the crown before the tide does.',
        tone: 'dark',
        length: 'short',
        archivedAt: null,
        createdAt: 1000,
        updatedAt: 1000
      })
      expect(created.id).toBeTruthy()
      expect(worldNames(created.id)).toEqual(['A', 'B'])
      expect(worlds.affectedCampaignCount(a.id)).toBe(1)
    })

    it('trims name and premise', () => {
      const w = worlds.create({ name: 'A' })
      const created = campaigns.create(seed({ name: '  Crown  ', premise: '  Hook.  ' }), [w.id])
      expect(created).toMatchObject({ name: 'Crown', premise: 'Hook.' })
    })

    it('allows duplicate names', () => {
      const w = worlds.create({ name: 'A' })
      campaigns.create(seed(), [w.id])
      expect(() => campaigns.create(seed(), [w.id])).not.toThrow()
    })

    it('accepts every tone and length', () => {
      const w = worlds.create({ name: 'A' })
      for (const tone of TONES) expect(campaigns.create(seed({ tone }), [w.id]).tone).toBe(tone)
      for (const length of LENGTHS) {
        expect(campaigns.create(seed({ length }), [w.id]).length).toBe(length)
      }
    })

    it('rejects a tone or length outside the closed lists', () => {
      const w = worlds.create({ name: 'A' })
      expect(() => campaigns.create(seed({ tone: 'goofy' as never }), [w.id])).toThrow(
        CampaignValidationError
      )
      expect(() => campaigns.create(seed({ length: 'epic' as never }), [w.id])).toThrow(
        CampaignValidationError
      )
      expect(() => campaigns.create(seed({ tone: undefined as never }), [w.id])).toThrow(
        CampaignValidationError
      )
    })

    it('rejects a blank or over-length name', () => {
      const w = worlds.create({ name: 'A' })
      expect(() => campaigns.create(seed({ name: '   ' }), [w.id])).toThrow(CampaignValidationError)
      expect(() => campaigns.create(seed({ name: 'x'.repeat(NAME_MAX + 1) }), [w.id])).toThrow(
        CampaignValidationError
      )
      expect(campaigns.create(seed({ name: 'x'.repeat(NAME_MAX) }), [w.id]).name).toHaveLength(
        NAME_MAX
      )
    })

    it('rejects a blank or over-length premise', () => {
      const w = worlds.create({ name: 'A' })
      expect(() => campaigns.create(seed({ premise: '  ' }), [w.id])).toThrow(
        CampaignValidationError
      )
      expect(() =>
        campaigns.create(seed({ premise: 'x'.repeat(PREMISE_SERVICE_MAX + 1) }), [w.id])
      ).toThrow(CampaignValidationError)
      const ok = campaigns.create(seed({ premise: 'x'.repeat(PREMISE_SERVICE_MAX) }), [w.id])
      expect(ok.premise).toHaveLength(PREMISE_SERVICE_MAX)
    })

    it('requires at least one World', () => {
      expect(() => campaigns.create(seed(), [])).toThrow(CampaignValidationError)
    })

    it('rejects an unknown World and leaves nothing behind', () => {
      const w = worlds.create({ name: 'A' })
      expect(() => campaigns.create(seed(), [w.id, 'missing'])).toThrow(CampaignValidationError)
      expect(campaigns.list()).toEqual([])
      expect(worlds.affectedCampaignCount(w.id)).toBe(0)
    })

    it('rejects an archived World and leaves nothing behind', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      worlds.archive(b.id)
      expect(() => campaigns.create(seed(), [a.id, b.id])).toThrow(CampaignValidationError)
      expect(campaigns.list()).toEqual([])
      expect(worlds.affectedCampaignCount(a.id)).toBe(0)
    })

    it('ignores a World id given twice', () => {
      const w = worlds.create({ name: 'A' })
      const created = campaigns.create(seed(), [w.id, w.id])
      expect(worldNames(created.id)).toEqual(['A'])
    })

    it('rejects an enum value outside the closed list at the database', () => {
      expect(() =>
        db.$client
          .prepare("insert into campaign values ('c', 'n', 'p', 'goofy', 'short', 0, 0, null)")
          .run()
      ).toThrow(/CHECK/i)
      expect(() =>
        db.$client
          .prepare("insert into campaign values ('c', 'n', 'p', 'epic', 'forever', 0, 0, null)")
          .run()
      ).toThrow(/CHECK/i)
    })
  })

  describe('get', () => {
    it('returns undefined for an unknown id', () => {
      expect(campaigns.get('nope')).toBeUndefined()
    })

    it('includes linked Worlds even when archived', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      worlds.archive(w.id)
      expect(worldNames(c.id)).toEqual(['A'])
    })
  })

  describe('update', () => {
    it('replaces the Seed fields and the World set and bumps updated_at', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const c = campaigns.create(seed(), [a.id])

      clock = 2000
      const updated = campaigns.update(
        c.id,
        seed({ name: 'New', premise: 'Newer.', tone: 'epic', length: 'long' }),
        [b.id]
      )

      expect(updated).toMatchObject({
        name: 'New',
        premise: 'Newer.',
        tone: 'epic',
        length: 'long',
        createdAt: 1000,
        updatedAt: 2000
      })
      expect(worldNames(c.id)).toEqual(['B'])
      expect(worlds.affectedCampaignCount(a.id)).toBe(0)
    })

    it('bumps updated_at even when nothing changes', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      clock = 3000
      expect(campaigns.update(c.id, seed(), [w.id]).updatedAt).toBe(3000)
    })

    it('keeps an already-linked active World and adds another', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const c = campaigns.create(seed(), [a.id])
      campaigns.update(c.id, seed(), [a.id, b.id])
      expect(worldNames(c.id)).toEqual(['A', 'B'])
    })

    it('validates like create and leaves the Campaign untouched on failure', () => {
      const a = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [a.id])
      clock = 2000
      expect(() => campaigns.update(c.id, seed({ name: '' }), [a.id])).toThrow(
        CampaignValidationError
      )
      expect(() => campaigns.update(c.id, seed({ tone: 'goofy' as never }), [a.id])).toThrow(
        CampaignValidationError
      )
      expect(campaigns.get(c.id)).toMatchObject({ name: 'The Sunken Crown', updatedAt: 1000 })
    })

    it('rejects empty worldIds', () => {
      const a = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [a.id])
      expect(() => campaigns.update(c.id, seed({ name: 'X' }), [])).toThrow(CampaignValidationError)
      expect(campaigns.get(c.id)).toMatchObject({ name: 'The Sunken Crown' })
      expect(worldNames(c.id)).toEqual(['A'])
    })

    it('rejects a missing or archived World atomically', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const c = campaigns.create(seed(), [a.id])
      worlds.archive(b.id)

      for (const bad of ['missing', b.id]) {
        expect(() => campaigns.update(c.id, seed({ name: 'X' }), [a.id, bad])).toThrow(
          CampaignValidationError
        )
      }
      expect(campaigns.get(c.id)).toMatchObject({ name: 'The Sunken Crown', updatedAt: 1000 })
      expect(worldNames(c.id)).toEqual(['A'])
    })

    it('rejects an unknown Campaign', () => {
      const a = worlds.create({ name: 'A' })
      expect(() => campaigns.update('nope', seed(), [a.id])).toThrow(CampaignNotFoundError)
    })

    it('rejects an archived Campaign', () => {
      const a = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [a.id])
      campaigns.archive(c.id)
      expect(() => campaigns.update(c.id, seed({ name: 'X' }), [a.id])).toThrow(
        CampaignValidationError
      )
      expect(campaigns.get(c.id)!.name).toBe('The Sunken Crown')
    })

    it('rejects a read-only Campaign, naming the blocking Worlds', () => {
      const a = worlds.create({ name: 'Alpha' })
      const b = worlds.create({ name: 'Beta' })
      const c = campaigns.create(seed(), [a.id, b.id])
      worlds.archive(b.id)

      expect(() => campaigns.update(c.id, seed({ name: 'X' }), [a.id])).toThrow(/Beta/)
      expect(campaigns.get(c.id)!.name).toBe('The Sunken Crown')
      expect(worldNames(c.id)).toEqual(['Alpha', 'Beta'])
    })

    it('is editable again once the blocking World is restored', () => {
      const a = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [a.id])
      worlds.archive(a.id)
      worlds.restore(a.id)
      expect(campaigns.update(c.id, seed({ name: 'X' }), [a.id]).name).toBe('X')
    })
  })

  describe('read-only', () => {
    it('names the archived Worlds blocking a Campaign, reusing the World queries', () => {
      const a = worlds.create({ name: 'Alpha' })
      const b = worlds.create({ name: 'Beta' })
      const c = campaigns.create(seed(), [a.id, b.id])
      expect(campaigns.blockingWorlds(c.id)).toEqual([])
      expect(campaigns.isReadOnly(c.id)).toBe(false)

      worlds.archive(b.id)
      expect(campaigns.blockingWorlds(c.id).map((w) => w.name)).toEqual(['Beta'])
      expect(campaigns.isReadOnly(c.id)).toBe(true)
    })
  })

  describe('archive and restore', () => {
    it('archives, hiding the Campaign from list and showing it in listArchived', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      clock = 2000
      const archived = campaigns.archive(c.id)
      expect(archived).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
      expect(campaigns.list()).toEqual([])
      expect(campaigns.listArchived().map((x) => x.id)).toEqual([c.id])
    })

    it('restores, bumping updated_at and returning it to the list', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      campaigns.archive(c.id)
      clock = 3000
      const restored = campaigns.restore(c.id)
      expect(restored).toMatchObject({ archivedAt: null, updatedAt: 3000 })
      expect(campaigns.list().map((x) => x.id)).toEqual([c.id])
      expect(campaigns.listArchived()).toEqual([])
    })

    it('archiving an archived Campaign is a no-op keeping archived_at and updated_at', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      clock = 2000
      campaigns.archive(c.id)
      clock = 5000
      expect(campaigns.archive(c.id)).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
    })

    it('restoring an active Campaign is a no-op keeping updated_at', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      clock = 5000
      expect(campaigns.restore(c.id)).toMatchObject({ archivedAt: null, updatedAt: 1000 })
    })

    it('archives and restores a read-only Campaign', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      worlds.archive(w.id)
      expect(campaigns.isReadOnly(c.id)).toBe(true)

      expect(campaigns.archive(c.id).archivedAt).not.toBeNull()
      expect(campaigns.restore(c.id).archivedAt).toBeNull()
      expect(campaigns.isReadOnly(c.id)).toBe(true)
    })

    it('throws for an unknown Campaign', () => {
      expect(() => campaigns.archive('nope')).toThrow(CampaignNotFoundError)
      expect(() => campaigns.restore('nope')).toThrow(CampaignNotFoundError)
    })
  })

  describe('delete', () => {
    it('removes the Campaign and its links and leaves the Worlds', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const c = campaigns.create(seed(), [a.id, b.id])
      const other = campaigns.create(seed({ name: 'Other' }), [a.id])

      campaigns.delete(c.id)

      expect(campaigns.get(c.id)).toBeUndefined()
      expect(worlds.get(a.id)).toBeDefined()
      expect(worlds.get(b.id)).toBeDefined()
      expect(worlds.affectedCampaignCount(a.id)).toBe(1)
      expect(worlds.affectedCampaignCount(b.id)).toBe(0)
      expect(campaigns.get(other.id)).toBeDefined()
      expect(worlds.delete(b.id)).toBeUndefined()
    })

    it('deletes an archived or read-only Campaign', () => {
      const w = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [w.id])
      worlds.archive(w.id)
      campaigns.archive(c.id)
      campaigns.delete(c.id)
      expect(campaigns.get(c.id)).toBeUndefined()
    })

    it('throws for an unknown Campaign', () => {
      expect(() => campaigns.delete('nope')).toThrow(CampaignNotFoundError)
    })

    it('keeps blocking deletion of a World a Campaign still uses', () => {
      const w = worlds.create({ name: 'A' })
      campaigns.create(seed(), [w.id])
      expect(() => worlds.delete(w.id)).toThrow(WorldInUseError)
    })
  })

  describe('list', () => {
    it('lists active Campaigns oldest first, ties by insertion order', () => {
      const w = worlds.create({ name: 'A' })
      clock = 3000
      const late = campaigns.create(seed({ name: 'Late' }), [w.id])
      clock = 1000
      const early1 = campaigns.create(seed({ name: 'Early1' }), [w.id])
      const early2 = campaigns.create(seed({ name: 'Early2' }), [w.id])

      expect(campaigns.list().map((c) => c.id)).toEqual([early1.id, early2.id, late.id])
    })

    it('filters by World', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const onlyA = campaigns.create(seed({ name: 'OnlyA' }), [a.id])
      const both = campaigns.create(seed({ name: 'Both' }), [a.id, b.id])
      const onlyB = campaigns.create(seed({ name: 'OnlyB' }), [b.id])

      expect(campaigns.list({ worldId: a.id }).map((c) => c.id)).toEqual([onlyA.id, both.id])
      expect(campaigns.list({ worldId: b.id }).map((c) => c.id)).toEqual([both.id, onlyB.id])
      expect(campaigns.list({ worldId: 'missing' })).toEqual([])
    })

    it('excludes archived Campaigns from a filtered list', () => {
      const a = worlds.create({ name: 'A' })
      const c = campaigns.create(seed(), [a.id])
      campaigns.archive(c.id)
      expect(campaigns.list({ worldId: a.id })).toEqual([])
    })

    it('lists archived Campaigns most recently archived first', () => {
      const w = worlds.create({ name: 'A' })
      const first = campaigns.create(seed({ name: 'First' }), [w.id])
      const second = campaigns.create(seed({ name: 'Second' }), [w.id])
      const third = campaigns.create(seed({ name: 'Third' }), [w.id])

      clock = 2000
      campaigns.archive(second.id)
      clock = 3000
      campaigns.archive(first.id)
      campaigns.archive(third.id)

      expect(campaigns.listArchived().map((c) => c.id)).toEqual([third.id, first.id, second.id])
    })
  })
})
