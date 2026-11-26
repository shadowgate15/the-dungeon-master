import fs from 'node:fs'
import { inject } from 'vitest'
import { createCampaignLibrary, type CampaignLibraryOptions } from '../lib/server/campaign/library'
import { openDatabase } from '../lib/server/db/connect'

/** A Campaign database made by copying the run's seeded template: the tests' `initDatabase`. */
export function fromTemplate(file: string) {
  fs.copyFileSync(inject('campaignTemplate'), file)
  return openDatabase(file)
}

/**
 * The Campaign library for tests: new Campaigns start from the run's seeded template instead of
 * seeding Rules Data, which costs about 200ms a Campaign.
 */
export function testLibrary(options: Omit<CampaignLibraryOptions, 'initDatabase'>) {
  return createCampaignLibrary({ ...options, initDatabase: fromTemplate })
}
