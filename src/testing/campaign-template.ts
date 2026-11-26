import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TestProject } from 'vitest/node'
import { openSeededDatabase } from '../lib/server/rules/seed'

/**
 * Vitest global setup: migrates and seeds one Campaign database per run, so tests copy it instead
 * of seeding Rules Data for each test (about 200ms each). Tests read it with `inject`.
 */
export function setup(project: TestProject) {
  // Not tempDir(): global setup runs outside the test hooks that clean those up.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-template-'))
  const file = path.join(dir, 'campaign.db')
  openSeededDatabase(file).$client.close()
  project.provide('campaignTemplate', file)
  return () => fs.rmSync(dir, { recursive: true, force: true })
}

declare module 'vitest' {
  export interface ProvidedContext {
    /** A migrated Campaign database seeded with Rules Data, holding no Campaign yet. */
    campaignTemplate: string
  }
}
