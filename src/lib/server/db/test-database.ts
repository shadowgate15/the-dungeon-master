import fs from 'node:fs'
import { inject } from 'vitest'
import { openDatabase } from './connect'
import { campaign } from './schema'

let template: Buffer | undefined

/**
 * An in-memory Campaign database for tests: migrated, seeded with Rules Data and holding its one
 * Campaign row, like the `.dm/campaign.db` of a Campaign folder. It loads the run's seeded
 * template rather than seeding again.
 */
export function openCampaignTestDatabase(name = 'Test Campaign') {
  template ??= fs.readFileSync(inject('campaignTemplate'))
  const db = openDatabase(template)
  const row = db.insert(campaign).values({ name, createdAt: 0, updatedAt: 0 }).returning().get()
  return { db, campaignId: row.id }
}
