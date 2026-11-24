import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { campaign } from '../db/schema'
import { createParty, type Party } from '../character/party'
import { createFloor, type Floor } from '../floor/floor'
import { journal } from '../knowledge/journal'
import { openSession, timeline } from '../play/log'
import { seedRulesData } from '../rules/seed'
import {
  CAMPAIGN_SEED_FIELDS,
  campaignSeedCard,
  parseCampaignSeed,
  type CampaignSeedCard
} from '#lib/campaign/seed.ts'
import type { ConversationMessage } from '#lib/creation/conversation.ts'
import { addConversationLine, conversationLines } from '../creation/conversation'
import { campaignDatabasePath, canonicalFolder } from './paths'
import { createRegistry } from './registry'

export type Campaign = typeof campaign.$inferSelect

/** A library row: a registered Campaign, read from its folder unless the folder is Missing. */
export type LibraryEntry = {
  id: string
  name: string
  path: string
  status: 'active' | 'archived' | 'missing'
  campaign: Campaign | null
}

/** No registered Campaign has this id. */
export class CampaignNotFoundError extends Error {}

/** The Campaign is registered, but its folder is gone. Re-add the folder to use it. */
export class CampaignMissingError extends Error {}

/** The folder already holds a Campaign. */
export class CampaignExistsError extends Error {}

/** An archived Campaign is read-only until restored. */
export class CampaignArchivedError extends Error {}

/** Archive, delete and unregister wait until the Campaign's live session ends. */
export class SessionLiveError extends Error {}

/** The folder has no `.dm/` Campaign database. */
export class NotACampaignFolderError extends Error {}

type Options = {
  /** The user-level state directory, which holds the registry. */
  home: string
  /** Whether the Campaign has a live session; such a Campaign can't be archived or removed. */
  live?: (id: string) => boolean
  now?: () => number
}

/**
 * Every Campaign the server knows: each lives in its own folder, with its database in `.dm/`, and
 * the registry in the user-level state directory lists the folders.
 */
export function createCampaignLibrary({ home, live = () => false, now = Date.now }: Options) {
  const registry = createRegistry(home)
  const open = new Map<string, Database>()

  /** The folder's Campaign database, opened (migrated and Rules Data seeded) once per server. */
  function database(folder: string): Database {
    let db = open.get(folder)
    if (!db) {
      db = openDatabase(campaignDatabasePath(folder))
      migrateDatabase(db)
      seedRulesData(db)
      open.set(folder, db)
    }
    return db
  }

  /** The folder's Campaign, or undefined when the folder (or its database) is gone. */
  function readCampaign(folder: string): Campaign | undefined {
    if (!fs.existsSync(campaignDatabasePath(folder))) {
      forget(folder)
      return undefined
    }
    return database(folder).select().from(campaign).get()
  }

  function forget(folder: string) {
    open.get(folder)?.$client.close()
    open.delete(folder)
  }

  /** The registered Campaign's folder and row; throws when unknown or Missing. */
  function find(id: string): { folder: string; found: Campaign } {
    const entry = registry.get(id)
    if (!entry) throw new CampaignNotFoundError('Campaign not found')
    const found = readCampaign(entry.path)
    if (!found) throw new CampaignMissingError(`${entry.name} is missing from ${entry.path}`)
    return { folder: entry.path, found }
  }

  function refuseWhileLive(id: string, name: string) {
    if (live(id)) {
      throw new SessionLiveError(`${name} has a live session. End it before changing the Campaign.`)
    }
  }

  function update(id: string, values: Partial<Campaign>): Campaign {
    const { folder, found } = find(id)
    return database(folder)
      .update(campaign)
      .set({ ...values, updatedAt: now() })
      .where(eq(campaign.id, found.id))
      .returning()
      .get()
  }

  return {
    /** Creates the Campaign folder (or uses an existing one without a Campaign) and registers it. */
    create(input: { name: string; folder: string }): Campaign {
      const { name } = parseCampaignSeed({ name: input.name })
      const folder = path.resolve(input.folder)
      if (fs.existsSync(campaignDatabasePath(folder))) {
        throw new CampaignExistsError(`${folder} already holds a Campaign`)
      }
      fs.mkdirSync(path.dirname(campaignDatabasePath(folder)), { recursive: true })
      const at = now()
      const created = database(folder)
        .insert(campaign)
        .values({ name, createdAt: at, updatedAt: at })
        .returning()
        .get()
      registry.put({ id: created.id, path: folder, name: created.name })
      return created
    },

    /**
     * Registers an existing Campaign folder. A folder whose Campaign is already registered under
     * another path (it was moved) replaces that entry, so a Missing Campaign comes back.
     */
    register(input: string): Campaign {
      const folder = path.resolve(input)
      const found = readCampaign(folder)
      if (!found) throw new NotACampaignFolderError(`No Campaign in ${folder}`)
      registry.put({ id: found.id, path: folder, name: found.name })
      return found
    },

    list(): LibraryEntry[] {
      return registry.list().map((entry): LibraryEntry => {
        const found = readCampaign(entry.path)
        if (!found) return { ...entry, status: 'missing', campaign: null }
        return {
          ...entry,
          name: found.name,
          status: found.archivedAt === null ? 'active' : 'archived',
          campaign: found
        }
      })
    },

    /** One library row, or undefined when the id is not registered. */
    get(id: string): LibraryEntry | undefined {
      return this.list().find((e) => e.id === id)
    },

    /** The Campaign Seed as card values. */
    seed(id: string): CampaignSeedCard {
      return campaignSeedCard(find(id).found)
    },

    /** The Seed fields the DM set and the Player has not edited since: the card's "✎ DM" marks. */
    dmSeedFields(id: string): string[] {
      return find(id).found.dmSeedFields
    },

    /**
     * Saves the whole Seed; an incomplete one is fine, an invalid one is refused. A field the
     * Player changed loses its "✎ DM" mark.
     */
    saveSeed(id: string, card: Partial<CampaignSeedCard>): Campaign {
      const { folder, found } = find(id)
      if (found.archivedAt !== null) {
        throw new CampaignArchivedError('An archived Campaign cannot be changed')
      }
      const seed = parseCampaignSeed(card)
      const edited = new Set(CAMPAIGN_SEED_FIELDS.filter((f) => seed[f] !== found[f]))
      const saved = update(id, {
        ...seed,
        version: found.version + 1,
        dmSeedFields: found.dmSeedFields.filter((f) => !edited.has(f as never))
      })
      registry.put({ id, path: folder, name: saved.name })
      return saved
    },

    /** The creation conversation in the DM pane. It is out of fiction and never logged. */
    conversation(id: string) {
      const db = database(find(id).folder)
      return {
        list: (): ConversationMessage[] => conversationLines(db),
        add: (line: { text: string; player: string }): ConversationMessage =>
          addConversationLine(db, { ...line, author: 'player' }, now())
      }
    },

    /** The Campaign's Characters and Character drafts. */
    party(id: string): Party {
      return createParty(database(find(id).folder), now)
    },

    /** The Campaign's open Floor and the Declarations on it. */
    floor(id: string): Floor {
      return createFloor(database(find(id).folder), now)
    },

    /** The Campaign's record of play: the Player's timeline and Journal, and its Sessions. */
    record(id: string) {
      const db = database(find(id).folder)
      return {
        timeline: () => timeline(db),
        journal: () => journal(db),
        openSession: () => openSession(db, now())
      }
    },

    /**
     * The database of the registered Campaign in this folder, or undefined when the folder is not
     * a registered Campaign (or its database is gone). How game tools find their Campaign.
     */
    databaseFor(input: string): Database | undefined {
      const entry = this.entryAt(input)
      return entry && database(entry.path)
    },

    /** The registered Campaign in this folder, or undefined (unregistered, or its database gone). */
    entryAt(input: string): { id: string; name: string; path: string } | undefined {
      const folder = canonicalFolder(input)
      const entry = registry.list().find((e) => canonicalFolder(e.path) === folder)
      if (!entry || !readCampaign(entry.path)) return undefined
      return entry
    },

    /** A no-op when already archived. */
    archive(id: string): Campaign {
      const { found } = find(id)
      refuseWhileLive(id, found.name)
      return found.archivedAt === null ? update(id, { archivedAt: now() }) : found
    },

    /** A no-op when already active. */
    restore(id: string): Campaign {
      const { found } = find(id)
      return found.archivedAt === null ? found : update(id, { archivedAt: null })
    },

    /**
     * Deletes the Campaign: its `.dm/` directory goes, then the folder itself if nothing else is
     * left in it, so the Player's own files (a git checkout, notes) are never removed.
     */
    delete(id: string): Campaign {
      const { folder, found } = find(id)
      refuseWhileLive(id, found.name)
      forget(folder)
      fs.rmSync(path.dirname(campaignDatabasePath(folder)), { recursive: true, force: true })
      if (fs.readdirSync(folder).length === 0) fs.rmdirSync(folder)
      registry.remove(id)
      return found
    },

    /** Forgets the Campaign, Missing or not, and leaves its folder alone. */
    unregister(id: string): void {
      const entry = registry.get(id)
      if (!entry) throw new CampaignNotFoundError('Campaign not found')
      refuseWhileLive(id, entry.name)
      forget(entry.path)
      registry.remove(id)
    },

    /** Closes every open Campaign database. */
    close() {
      for (const db of open.values()) db.$client.close()
      open.clear()
    }
  }
}

export type CampaignLibrary = ReturnType<typeof createCampaignLibrary>
