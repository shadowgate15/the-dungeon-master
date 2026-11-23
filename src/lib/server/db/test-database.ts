import { seedRulesData } from '../rules/seed'
import { migrateDatabase, openDatabase } from './connect'
import { campaign } from './schema'

/**
 * An in-memory Campaign database for tests: migrated, seeded with Rules Data and holding its one
 * Campaign row, like the `.dm/campaign.db` of a Campaign folder.
 */
export function openCampaignTestDatabase(name = 'Test Campaign') {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const row = db.insert(campaign).values({ name, createdAt: 0, updatedAt: 0 }).returning().get()
  return { db, campaignId: row.id }
}
