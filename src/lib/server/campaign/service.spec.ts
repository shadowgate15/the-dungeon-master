import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, migrateDatabase, type Database } from '../db/connect'
import {
  CampaignNotFoundError,
  CampaignValidationError,
  createCampaignService,
  type CampaignSeed,
  type CampaignService
} from './service'
import { LENGTHS, NAME_MAX, PREMISE_SERVICE_MAX, TONES } from '#lib/campaign/enums.ts'

let db: Database
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
  campaigns = createCampaignService(db, () => clock)
})

describe('Campaign service', () => {
  describe('create', () => {
    it('creates a Campaign from its Seed alone and returns it', () => {
      const created = campaigns.create(seed())

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
      expect(campaigns.get(created.id)).toEqual(created)
    })

    it('trims name and premise', () => {
      const created = campaigns.create(seed({ name: '  Crown  ', premise: '  Hook.  ' }))
      expect(created).toMatchObject({ name: 'Crown', premise: 'Hook.' })
    })

    it('allows duplicate names', () => {
      campaigns.create(seed())
      expect(() => campaigns.create(seed())).not.toThrow()
    })

    it('accepts every tone and length', () => {
      for (const tone of TONES) expect(campaigns.create(seed({ tone })).tone).toBe(tone)
      for (const length of LENGTHS) {
        expect(campaigns.create(seed({ length })).length).toBe(length)
      }
    })

    it('rejects a tone or length outside the closed lists', () => {
      expect(() => campaigns.create(seed({ tone: 'goofy' as never }))).toThrow(
        CampaignValidationError
      )
      expect(() => campaigns.create(seed({ length: 'epic' as never }))).toThrow(
        CampaignValidationError
      )
      expect(() => campaigns.create(seed({ tone: undefined as never }))).toThrow(
        CampaignValidationError
      )
    })

    it('rejects a blank or over-length name', () => {
      expect(() => campaigns.create(seed({ name: '   ' }))).toThrow(CampaignValidationError)
      expect(() => campaigns.create(seed({ name: 'x'.repeat(NAME_MAX + 1) }))).toThrow(
        CampaignValidationError
      )
      expect(campaigns.create(seed({ name: 'x'.repeat(NAME_MAX) })).name).toHaveLength(NAME_MAX)
    })

    it('rejects a blank or over-length premise', () => {
      expect(() => campaigns.create(seed({ premise: '  ' }))).toThrow(CampaignValidationError)
      expect(() =>
        campaigns.create(seed({ premise: 'x'.repeat(PREMISE_SERVICE_MAX + 1) }))
      ).toThrow(CampaignValidationError)
      const ok = campaigns.create(seed({ premise: 'x'.repeat(PREMISE_SERVICE_MAX) }))
      expect(ok.premise).toHaveLength(PREMISE_SERVICE_MAX)
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
  })

  describe('archive and restore', () => {
    it('archives, hiding the Campaign from list and showing it in listArchived', () => {
      const c = campaigns.create(seed())
      clock = 2000
      const archived = campaigns.archive(c.id)
      expect(archived).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
      expect(campaigns.list()).toEqual([])
      expect(campaigns.listArchived().map((x) => x.id)).toEqual([c.id])
    })

    it('restores, bumping updated_at and returning it to the list', () => {
      const c = campaigns.create(seed())
      campaigns.archive(c.id)
      clock = 3000
      const restored = campaigns.restore(c.id)
      expect(restored).toMatchObject({ archivedAt: null, updatedAt: 3000 })
      expect(campaigns.list().map((x) => x.id)).toEqual([c.id])
      expect(campaigns.listArchived()).toEqual([])
    })

    it('archiving an archived Campaign is a no-op keeping archived_at and updated_at', () => {
      const c = campaigns.create(seed())
      clock = 2000
      campaigns.archive(c.id)
      clock = 5000
      expect(campaigns.archive(c.id)).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
    })

    it('restoring an active Campaign is a no-op keeping updated_at', () => {
      const c = campaigns.create(seed())
      clock = 5000
      expect(campaigns.restore(c.id)).toMatchObject({ archivedAt: null, updatedAt: 1000 })
    })

    it('throws for an unknown Campaign', () => {
      expect(() => campaigns.archive('nope')).toThrow(CampaignNotFoundError)
      expect(() => campaigns.restore('nope')).toThrow(CampaignNotFoundError)
    })
  })

  describe('delete', () => {
    it('removes only that Campaign', () => {
      const c = campaigns.create(seed())
      const other = campaigns.create(seed({ name: 'Other' }))

      campaigns.delete(c.id)

      expect(campaigns.get(c.id)).toBeUndefined()
      expect(campaigns.get(other.id)).toBeDefined()
    })

    it('deletes an archived Campaign', () => {
      const c = campaigns.create(seed())
      campaigns.archive(c.id)
      campaigns.delete(c.id)
      expect(campaigns.get(c.id)).toBeUndefined()
    })

    it('throws for an unknown Campaign', () => {
      expect(() => campaigns.delete('nope')).toThrow(CampaignNotFoundError)
    })
  })

  describe('list', () => {
    it('lists active Campaigns oldest first, ties by insertion order', () => {
      clock = 3000
      const late = campaigns.create(seed({ name: 'Late' }))
      clock = 1000
      const early1 = campaigns.create(seed({ name: 'Early1' }))
      const early2 = campaigns.create(seed({ name: 'Early2' }))

      expect(campaigns.list().map((c) => c.id)).toEqual([early1.id, early2.id, late.id])
    })

    it('lists archived Campaigns most recently archived first', () => {
      const first = campaigns.create(seed({ name: 'First' }))
      const second = campaigns.create(seed({ name: 'Second' }))
      const third = campaigns.create(seed({ name: 'Third' }))

      clock = 2000
      campaigns.archive(second.id)
      clock = 3000
      campaigns.archive(first.id)
      campaigns.archive(third.id)

      expect(campaigns.listArchived().map((c) => c.id)).toEqual([third.id, first.id, second.id])
    })
  })
})
