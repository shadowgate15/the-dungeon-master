import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, migrateDatabase, type Database } from '../db/connect'
import {
  createWorldService,
  WorldInUseError,
  WorldNotFoundError,
  WorldValidationError,
  type WorldService
} from './service'
import { GENRE_FLAVORS, PREMISE_SOFT_CAP } from '#lib/world/enums.ts'

let db: Database
let worlds: WorldService

beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  worlds = createWorldService(db)
})

describe('World service', () => {
  it('creates a World from only a name, leaving every other seed field unspecified', () => {
    const world = worlds.create({ name: 'Eldoria' })

    expect(world).toMatchObject({
      name: 'Eldoria',
      premise: null,
      genreFlavor: null,
      scale: null,
      magicLevel: null,
      techLevel: null,
      archivedAt: null
    })
    expect(world.id).toBeTruthy()
    expect(world.createdAt).toBe(world.updatedAt)
  })

  it('persists all six seed fields', () => {
    const created = worlds.create({
      name: 'Eldoria',
      premise: 'A drowned kingdom.',
      genreFlavor: 'dark fantasy',
      scale: 'continent',
      magicLevel: 'low',
      techLevel: 'renaissance'
    })

    expect(worlds.get(created.id)).toMatchObject({
      premise: 'A drowned kingdom.',
      genreFlavor: 'dark fantasy',
      scale: 'continent',
      magicLevel: 'low',
      techLevel: 'renaissance'
    })
  })

  it('stores unspecified enums and a blank premise as NULL', () => {
    const created = worlds.create({
      name: 'Eldoria',
      premise: '   ',
      genreFlavor: null,
      scale: undefined,
      magicLevel: null
    })

    expect(created).toMatchObject({
      premise: null,
      genreFlavor: null,
      scale: null,
      magicLevel: null,
      techLevel: null
    })
  })

  it('rejects an enum value outside the closed list', () => {
    for (const bad of [
      { genreFlavor: 'cozy mystery' },
      { scale: 'galaxy' },
      { magicLevel: 'extreme' },
      { techLevel: 'steampunk' }
    ]) {
      expect(() => worlds.create({ name: 'Bad', ...bad } as never)).toThrow(WorldValidationError)
    }
    expect(worlds.list()).toEqual([])
  })

  it('does not relate genre flavor to tech level', () => {
    expect(() =>
      worlds.create({ name: 'Odd', genreFlavor: 'high fantasy', techLevel: 'futuristic' })
    ).not.toThrow()
    expect(() =>
      worlds.create({ name: 'Odd2', genreFlavor: 'science fiction', techLevel: 'stone age' })
    ).not.toThrow()
  })

  it('stores a premise past the soft cap', () => {
    const premise = 'x'.repeat(PREMISE_SOFT_CAP * 3)
    expect(worlds.create({ name: 'Long', premise }).premise).toBe(premise)
  })

  it('requires a name', () => {
    expect(() => worlds.create({ name: '' })).toThrow(/name/i)
    expect(() => worlds.create({ name: '   ' })).toThrow(/name/i)
  })

  it('trims the name', () => {
    expect(worlds.create({ name: '  Eldoria ' }).name).toBe('Eldoria')
  })

  it('gets a World by id and returns undefined for an unknown id', () => {
    const created = worlds.create({ name: 'Eldoria' })

    expect(worlds.get(created.id)).toEqual(created)
    expect(worlds.get('nope')).toBeUndefined()
  })

  it('lists Worlds ordered by creation time', () => {
    let now = 1000
    const ordered = createWorldService(db, () => now++)
    ordered.create({ name: 'First' })
    ordered.create({ name: 'Second' })
    ordered.create({ name: 'Third' })

    expect(ordered.list().map((w) => w.name)).toEqual(['First', 'Second', 'Third'])
  })

  it('lists only active Worlds', () => {
    const active = worlds.create({ name: 'Active' })
    const archived = worlds.create({ name: 'Archived' })
    db.$client.prepare('update world set archived_at = 5 where id = ?').run(archived.id)

    expect(worlds.list().map((w) => w.id)).toEqual([active.id])
  })

  it('rejects an enum value outside the closed list at the database', () => {
    const insert = (genre: string) =>
      db.$client
        .prepare(
          'insert into world (id, name, genre_flavor, created_at, updated_at) values (?, ?, ?, 1, 1)'
        )
        .run(crypto.randomUUID(), 'Bad', genre)

    expect(() => insert('cozy mystery')).toThrow(/CHECK/i)
    expect(() => insert(GENRE_FLAVORS[0])).not.toThrow()
  })

  it('enforces foreign keys on every connection', () => {
    expect(() =>
      db.$client
        .prepare('insert into world_campaign (world_id, campaign_id) values (?, ?)')
        .run('missing-world', 'missing-campaign')
    ).toThrow(/FOREIGN KEY/i)
    expect(openDatabase(':memory:').$client.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('refuses to delete a World that a Campaign references', () => {
    const world = worlds.create({ name: 'Eldoria' })
    db.$client.prepare("insert into campaign (id) values ('c1')").run()
    db.$client.prepare("insert into world_campaign values (?, 'c1')").run(world.id)

    expect(() => db.$client.prepare('delete from world where id = ?').run(world.id)).toThrow(
      /FOREIGN KEY/i
    )
  })

  describe('edit', () => {
    it('persists every seed field and bumps updated_at', () => {
      let now = 1000
      const svc = createWorldService(db, () => now)
      const created = svc.create({ name: 'Eldoria' })
      now = 2000

      const edited = svc.update(created.id, {
        name: ' Aldoria ',
        premise: 'A drowned kingdom.',
        genreFlavor: 'dark fantasy',
        scale: 'continent',
        magicLevel: 'low',
        techLevel: 'renaissance'
      })

      expect(edited).toMatchObject({
        name: 'Aldoria',
        premise: 'A drowned kingdom.',
        genreFlavor: 'dark fantasy',
        scale: 'continent',
        magicLevel: 'low',
        techLevel: 'renaissance',
        createdAt: 1000,
        updatedAt: 2000
      })
      expect(svc.get(created.id)).toEqual(edited)
    })

    it('bumps updated_at on every edit, even an unchanged one', () => {
      let now = 1000
      const svc = createWorldService(db, () => now)
      const created = svc.create({ name: 'Eldoria' })
      now = 1001
      expect(svc.update(created.id, { name: 'Eldoria' }).updatedAt).toBe(1001)
      now = 1002
      expect(svc.update(created.id, { name: 'Eldoria' }).updatedAt).toBe(1002)
    })

    it('clears a field back to unspecified', () => {
      const created = worlds.create({ name: 'E', premise: 'p', scale: 'planar' })
      const edited = worlds.update(created.id, { name: 'E', premise: ' ', scale: null })
      expect(edited).toMatchObject({ premise: null, scale: null })
    })

    it('validates like create and leaves the World untouched on failure', () => {
      const created = worlds.create({ name: 'Eldoria', scale: 'planar' })
      expect(() => worlds.update(created.id, { name: ' ' })).toThrow(WorldValidationError)
      expect(() => worlds.update(created.id, { name: 'X', scale: 'galaxy' } as never)).toThrow(
        WorldValidationError
      )
      expect(worlds.get(created.id)).toEqual(created)
    })

    it('refuses to edit an unknown or archived World', () => {
      expect(() => worlds.update('nope', { name: 'X' })).toThrow(WorldNotFoundError)
      const created = worlds.create({ name: 'Eldoria' })
      db.$client.prepare('update world set archived_at = 5 where id = ?').run(created.id)
      expect(() => worlds.update(created.id, { name: 'X' })).toThrow(/archived/i)
      expect(worlds.get(created.id)?.name).toBe('Eldoria')
    })
  })

  describe('affected Campaigns', () => {
    const link = (worldId: string, campaignId: string) => {
      db.$client.prepare('insert or ignore into campaign (id) values (?)').run(campaignId)
      db.$client.prepare('insert into world_campaign values (?, ?)').run(worldId, campaignId)
    }

    it('counts the Campaigns linked to a World', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      expect(worlds.affectedCampaignCount(a.id)).toBe(0)
      link(a.id, 'c1')
      link(a.id, 'c2')
      link(b.id, 'c2')
      expect(worlds.affectedCampaignCount(a.id)).toBe(2)
      expect(worlds.affectedCampaignCount(b.id)).toBe(1)
    })

    it('counts the Campaigns of every World in one call, omitting Worlds with none', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      const unused = worlds.create({ name: 'Unused' })
      link(a.id, 'c1')
      link(a.id, 'c2')
      link(b.id, 'c2')

      const counts = worlds.campaignCounts()

      expect(counts).toEqual({ [a.id]: 2, [b.id]: 1 })
      expect(counts[unused.id]).toBeUndefined()
    })

    it('drops a deleted Campaign from the count and cascades its links', () => {
      const a = worlds.create({ name: 'A' })
      link(a.id, 'c1')
      link(a.id, 'c2')
      db.$client.prepare("delete from campaign where id = 'c1'").run()

      expect(worlds.affectedCampaignCount(a.id)).toBe(1)
      const rows = db.$client.prepare('select * from world_campaign').all()
      expect(rows).toEqual([{ world_id: a.id, campaign_id: 'c2' }])
    })
  })

  describe('archive, restore and delete', () => {
    let tick: number
    beforeEach(() => {
      tick = 1000
      worlds = createWorldService(db, () => ++tick)
    })
    const link = (worldId: string, campaignId: string) => {
      db.$client.prepare('insert or ignore into campaign (id) values (?)').run(campaignId)
      db.$client.prepare('insert into world_campaign values (?, ?)').run(worldId, campaignId)
    }

    it('archives a World, bumping updated_at and hiding it from the list', () => {
      const w = worlds.create({ name: 'A' })
      const archived = worlds.archive(w.id)

      expect(archived.archivedAt).toBeGreaterThan(0)
      expect(archived.updatedAt).toBeGreaterThan(w.updatedAt)
      expect(worlds.list()).toEqual([])
      expect(worlds.listArchived().map((x) => x.id)).toEqual([w.id])
    })

    it('rejects edits to an archived World', () => {
      const w = worlds.create({ name: 'A' })
      worlds.archive(w.id)
      expect(() => worlds.update(w.id, { name: 'B' })).toThrow(/archived/i)
    })

    it('restores a World, bumping updated_at and returning it to the list', () => {
      const w = worlds.create({ name: 'A' })
      const archived = worlds.archive(w.id)
      const restored = worlds.restore(w.id)

      expect(restored.archivedAt).toBeNull()
      expect(restored.updatedAt).toBeGreaterThan(archived.updatedAt)
      expect(worlds.list().map((x) => x.id)).toEqual([w.id])
      expect(worlds.listArchived()).toEqual([])
      expect(worlds.update(w.id, { name: 'B' }).name).toBe('B')
    })

    it('throws when archiving or restoring an unknown World', () => {
      expect(() => worlds.archive('nope')).toThrow(WorldNotFoundError)
      expect(() => worlds.restore('nope')).toThrow(WorldNotFoundError)
    })

    it('archiving an archived World is a no-op that keeps archived_at and updated_at', () => {
      const w = worlds.create({ name: 'A' })
      const first = worlds.archive(w.id)
      expect(worlds.archive(w.id)).toEqual(first)
      expect(worlds.get(w.id)).toEqual(first)
    })

    it('restoring an active World is a no-op that keeps updated_at', () => {
      const w = worlds.create({ name: 'A' })
      expect(worlds.restore(w.id)).toEqual(w)
      expect(worlds.get(w.id)).toEqual(w)
    })

    it('deletes an unreferenced World', () => {
      const w = worlds.create({ name: 'A' })
      worlds.delete(w.id)
      expect(worlds.get(w.id)).toBeUndefined()
    })

    it('refuses to delete a World a Campaign references, leaving it intact', () => {
      const w = worlds.create({ name: 'A' })
      link(w.id, 'c1')
      expect(() => worlds.delete(w.id)).toThrow(WorldInUseError)
      expect(worlds.get(w.id)).toBeDefined()
    })

    it('refuses to delete an archived World that a Campaign references', () => {
      const w = worlds.create({ name: 'A' })
      link(w.id, 'c1')
      worlds.archive(w.id)
      expect(() => worlds.delete(w.id)).toThrow(WorldInUseError)
    })

    it('throws when deleting an unknown World', () => {
      expect(() => worlds.delete('nope')).toThrow(WorldNotFoundError)
    })

    it('makes a Campaign read-only while any linked World is archived', () => {
      const a = worlds.create({ name: 'A' })
      const b = worlds.create({ name: 'B' })
      link(a.id, 'c1')
      link(b.id, 'c1')
      expect(worlds.isCampaignReadOnly('c1')).toBe(false)
      expect(worlds.archivedWorldsOfCampaign('c1')).toEqual([])

      worlds.archive(b.id)
      expect(worlds.isCampaignReadOnly('c1')).toBe(true)
      expect(worlds.archivedWorldsOfCampaign('c1').map((w) => w.name)).toEqual(['B'])

      worlds.restore(b.id)
      expect(worlds.isCampaignReadOnly('c1')).toBe(false)
    })

    it('does not make a Campaign without archived Worlds read-only', () => {
      expect(worlds.isCampaignReadOnly('unknown')).toBe(false)
    })
  })
})
