import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { RunResult } from 'better-sqlite3'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'

export type Database = ReturnType<typeof openDatabase>

/** A database or a transaction on one: what code that must work inside a transaction takes. */
export type Queryable = BaseSQLiteDatabase<'sync', RunResult, typeof schema>

/** The only place connections are opened, so foreign keys are always enforced. */
export function openDatabase(url: string) {
  const client = new Database(url)
  client.pragma('foreign_keys = ON')
  return drizzle(client, { schema })
}

export function migrateDatabase(db: Database) {
  migrate(db, { migrationsFolder: 'drizzle' })
}
