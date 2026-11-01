import { DATABASE_URL } from '$app/env/private'
import { migrateDatabase, openDatabase } from './connect'

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')

export const db = openDatabase(DATABASE_URL)

migrateDatabase(db)
