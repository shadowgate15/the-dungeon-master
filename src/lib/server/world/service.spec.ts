import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, migrateDatabase, type Database } from '../db/connect'
import { createWorldService, type WorldService } from './service'
import { GENRE_FLAVORS } from '#lib/world/enums.ts'

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
})
