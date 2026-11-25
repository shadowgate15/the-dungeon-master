import path from 'node:path'
import { DATABASE_URL, DUNGEON_MASTER_HOME } from '$app/env/private'
import { userStateDir } from '../campaign/paths'
import { seedRulesData } from '../rules/seed'
import { migrateDatabase, openDatabase, type Database } from './connect'

let db: Database | undefined

/**
 * The server's own rules database (for the credits page), opened on first use so building the
 * app opens nothing. Defaults to `rules.db` in the user-level state directory.
 */
export function rulesDatabase(): Database {
  if (!db) {
    db = openDatabase(DATABASE_URL || path.join(userStateDir({ DUNGEON_MASTER_HOME }), 'rules.db'))
    migrateDatabase(db)
    seedRulesData(db)
  }
  return db
}
