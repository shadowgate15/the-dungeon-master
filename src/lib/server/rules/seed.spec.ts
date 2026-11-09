import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RulesDataset } from '../../rules/schema'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { loadRulesDataset } from './dataset'
import { createRulesRepository, type RulesRepository } from './repository'
import { seedRulesData } from './seed'

let db: Database
let repo: RulesRepository
let clock: number
const data = loadRulesDataset()

beforeEach(() => {
  clock = 1000
  db = openDatabase(':memory:')
  migrateDatabase(db)
  repo = createRulesRepository(db)
})

const seed = (dataset: RulesDataset = data) => seedRulesData(db, dataset, () => clock)

/** A deep copy the test can edit into a "next release". */
const nextRelease = (edit: (d: RulesDataset) => void): RulesDataset => {
  const copy = structuredClone(data)
  edit(copy)
  return copy
}

const snapshot = () => ({
  info: repo.datasetInfo(),
  races: repo.races(),
  subraces: repo.subraces(),
  classes: repo.classes(),
  spells: repo.spells(),
  equipment: repo.equipment(),
  features: repo.features(),
  backgrounds: repo.backgrounds()
})

describe('seedRulesData', () => {
  it('fills the tables so the repository serves the committed data', () => {
    seed()

    expect(repo.races()).toHaveLength(data.races.length)
    expect(repo.classes()).toHaveLength(12)
    expect(repo.spells()).toHaveLength(319)
  })

  it('is idempotent: seeding twice changes nothing, including ids', () => {
    seed()
    const first = snapshot()

    clock = 2000
    seed()

    expect({ ...snapshot(), info: undefined }).toEqual({ ...first, info: undefined })
  })

  describe('a version bump', () => {
    const referencingTable = () =>
      db.run(
        sql`CREATE TABLE character_stub (race_id integer NOT NULL REFERENCES race(id) ON DELETE RESTRICT)`
      )

    it('updates changed rows in place and adds new rows without renumbering any', () => {
      seed()
      const before = new Map(repo.races().map((r) => [r.slug, r.id]))

      seed(
        nextRelease((d) => {
          d.meta.datasetVersion = '9.9.9'
          d.meta.sourceTag = 'v9.9.9'
          d.races.find((r) => r.slug === 'elf')!.speed = 35
          d.races.push({ ...structuredClone(d.races[0]), slug: 'aasimar', name: 'Aasimar' })
        })
      )

      const after = repo.races()
      for (const [slug, id] of before) expect(after.find((r) => r.slug === slug)!.id).toBe(id)
      expect(repo.race('elf')!.speed).toBe(35)
      expect(repo.race('aasimar')!.id).toBeGreaterThan(Math.max(...before.values()))
      expect(repo.datasetInfo()).toMatchObject({ datasetVersion: '9.9.9', sourceTag: 'v9.9.9' })
    })

    it('never deletes a row a Character references, even when the new release drops it', () => {
      seed()
      referencingTable()
      const gnome = repo.race('gnome')!
      db.run(sql`INSERT INTO character_stub (race_id) VALUES (${gnome.id})`)

      expect(() =>
        seed(
          nextRelease((d) => {
            d.races = d.races.filter((r) => r.slug !== 'gnome')
            d.subraces = d.subraces.filter((s) => s.race !== 'gnome')
          })
        )
      ).not.toThrow()

      expect(repo.race('gnome')!.id).toBe(gnome.id)
      expect(db.all(sql`SELECT race_id FROM character_stub`)).toEqual([{ race_id: gnome.id }])
    })

    it('replaces nested rules such as choice groups without touching the owning row', () => {
      seed()
      const bard = repo.classBySlug('bard')!

      seed(
        nextRelease((d) => {
          const c = d.classes.find((x) => x.slug === 'bard')!
          c.choiceGroups = c.choiceGroups.slice(0, 1)
        })
      )

      const reseeded = repo.classBySlug('bard')!
      expect(reseeded.id).toBe(bard.id)
      expect(reseeded.choiceGroups).toHaveLength(1)
    })
  })
})
