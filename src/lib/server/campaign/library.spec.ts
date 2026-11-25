import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CampaignSeedError, emptyCampaignSeed } from '#lib/campaign/seed.ts'
import {
  CampaignArchivedError,
  CampaignExistsError,
  CampaignMissingError,
  CampaignNotFoundError,
  createCampaignLibrary,
  NotACampaignFolderError,
  SessionLiveError,
  type CampaignLibrary
} from './library'

let home: string
let root: string
let library: CampaignLibrary

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-library-'))
  home = path.join(tmp, 'home')
  root = path.join(tmp, 'campaigns')
  library = createCampaignLibrary({ home })
})

afterEach(() => library.close())

const folder = (name: string) => path.join(root, name)

describe('Campaign library', () => {
  describe('while a session is live', () => {
    it('refuses archive, delete and unregister, and changes nothing', () => {
      const live = new Set<string>()
      const guarded = createCampaignLibrary({ home, live: (id) => live.has(id) })
      const { id } = guarded.create({ name: 'Ember Road', folder: folder('ember') })
      live.add(id)

      expect(() => guarded.archive(id)).toThrow(SessionLiveError)
      expect(() => guarded.delete(id)).toThrow(SessionLiveError)
      expect(() => guarded.unregister(id)).toThrow(SessionLiveError)
      expect(guarded.get(id)).toMatchObject({ status: 'active' })
      expect(fs.existsSync(path.join(folder('ember'), '.dm'))).toBe(true)

      live.delete(id)
      expect(guarded.archive(id)).toMatchObject({ archivedAt: expect.any(Number) })
      guarded.close()
    })
  })

  describe('create', () => {
    it('refuses a blank name and creates nothing', () => {
      expect(() => library.create({ name: '  ', folder: folder('blank') })).toThrow(
        CampaignSeedError
      )
      expect(fs.existsSync(folder('blank'))).toBe(false)
      expect(library.list()).toEqual([])
    })

    it('refuses a folder that already holds a Campaign', () => {
      library.create({ name: 'Ember Road', folder: folder('ember-road') })

      expect(() => library.create({ name: 'Again', folder: folder('ember-road') })).toThrow(
        CampaignExistsError
      )
      expect(library.list()).toHaveLength(1)
    })

    it('creates the folder with a .dm database and lists it', () => {
      const created = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      expect(fs.existsSync(path.join(root, 'ember-road', '.dm', 'campaign.db'))).toBe(true)
      expect(library.list()).toEqual([
        expect.objectContaining({
          id: created.id,
          name: 'Ember Road',
          path: folder('ember-road'),
          status: 'active'
        })
      ])
    })
  })

  describe('missing folders', () => {
    it('shows a moved folder as Missing, keeping its name', () => {
      const created = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      library.close()
      fs.renameSync(folder('ember-road'), folder('moved'))

      expect(createCampaignLibrary({ home }).list()).toEqual([
        expect.objectContaining({ id: created.id, name: 'Ember Road', status: 'missing' })
      ])
    })

    it('re-adds a moved folder under its new path', () => {
      const created = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      library.close()
      fs.renameSync(folder('ember-road'), folder('moved'))

      library = createCampaignLibrary({ home })
      library.register(folder('moved'))

      expect(library.list()).toEqual([
        expect.objectContaining({ id: created.id, path: folder('moved'), status: 'active' })
      ])
    })

    it('keeps a live Campaign at its folder when a copy of it registers', () => {
      const live = new Set<string>()
      const guarded = createCampaignLibrary({ home, live: (id) => live.has(id) })
      const created = guarded.create({ name: 'Ember Road', folder: folder('ember-road') })
      fs.cpSync(folder('ember-road'), folder('clone'), { recursive: true })
      live.add(created.id)

      expect(guarded.register(folder('clone'))).toMatchObject({ id: created.id })
      expect(guarded.list()).toEqual([
        expect.objectContaining({ id: created.id, path: folder('ember-road') })
      ])
      guarded.close()
    })

    it('refuses to register a folder that holds no Campaign', () => {
      fs.mkdirSync(folder('empty'), { recursive: true })

      expect(() => library.register(folder('empty'))).toThrow(NotACampaignFolderError)
      expect(library.list()).toEqual([])
    })
  })

  describe('archive and restore', () => {
    it('archives a Campaign and restores it', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      library.archive(id)
      expect(library.list()).toEqual([expect.objectContaining({ id, status: 'archived' })])

      library.restore(id)
      expect(library.list()).toEqual([expect.objectContaining({ id, status: 'active' })])
    })

    it('refuses an unknown Campaign', () => {
      expect(() => library.archive('nope')).toThrow(CampaignNotFoundError)
    })

    it('refuses a Missing Campaign', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      fs.rmSync(folder('ember-road'), { recursive: true })

      expect(() => library.archive(id)).toThrow(CampaignMissingError)
    })
  })

  describe('delete', () => {
    it('removes the Campaign folder and its registry entry', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      library.delete(id)

      expect(fs.existsSync(folder('ember-road'))).toBe(false)
      expect(library.list()).toEqual([])
    })

    it('keeps files in the folder that are not the Campaign', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      fs.writeFileSync(path.join(folder('ember-road'), 'notes.md'), 'mine')

      library.delete(id)

      expect(fs.readdirSync(folder('ember-road'))).toEqual(['notes.md'])
    })
  })

  describe('remove from registry', () => {
    it('forgets the Campaign but leaves its folder', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      library.unregister(id)

      expect(library.list()).toEqual([])
      expect(fs.existsSync(path.join(folder('ember-road'), '.dm', 'campaign.db'))).toBe(true)
    })

    it('forgets a Missing Campaign', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      fs.rmSync(folder('ember-road'), { recursive: true })

      library.unregister(id)

      expect(library.list()).toEqual([])
    })
  })

  describe('Seed', () => {
    const card = {
      ...emptyCampaignSeed(),
      name: 'Ember Road',
      premise: 'Escort a relic across the ash plains.',
      tone: 'tense',
      length: 'short',
      worldName: 'Varn',
      genreFlavor: 'dark fantasy',
      scale: 'single region',
      magicLevel: 'low',
      techLevel: 'medieval'
    }

    it('starts with only the name', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      expect(library.seed(id)).toEqual({ ...emptyCampaignSeed(), name: 'Ember Road' })
    })

    it('saves every field, and the folder keeps them', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      library.saveSeed(id, { ...card, name: 'Ember Road Redux' })
      library.close()
      library = createCampaignLibrary({ home })

      expect(library.seed(id)).toEqual({ ...card, name: 'Ember Road Redux' })
      expect(library.list()).toEqual([expect.objectContaining({ name: 'Ember Road Redux' })])
    })

    it('refuses an invalid Seed and keeps the saved one', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })

      expect(() => library.saveSeed(id, { ...card, tone: 'grim' })).toThrow(CampaignSeedError)
      expect(library.seed(id).tone).toBe('')
    })

    it('refuses edits while the Campaign is archived', () => {
      const { id } = library.create({ name: 'Ember Road', folder: folder('ember-road') })
      library.archive(id)

      expect(() => library.saveSeed(id, card)).toThrow(CampaignArchivedError)
    })
  })
})
