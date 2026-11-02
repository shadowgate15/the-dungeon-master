import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type Database = ReturnType<typeof openDatabase>

/** The only place connections are opened, so foreign keys are always enforced. */
export function openDatabase(url: string) {
  const client = new Database(url)
  client.pragma('foreign_keys = ON')
  return drizzle(client, { schema })
}

export function migrateDatabase(db: Database) {
  migrate(db, { migrationsFolder: 'drizzle' })
}
