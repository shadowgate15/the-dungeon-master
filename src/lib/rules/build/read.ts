import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { COLLECTIONS, type RulesDataset } from '../schema.ts'
import { UPSTREAM_FILES } from './source.ts'
import type { Upstream } from './normalize.ts'

const VENDOR_DIR = new URL('../../../../vendor/5e-database/2014/en/', import.meta.url)
export const DATA_DIR = new URL('../data/', import.meta.url)

/** Reads the vendored upstream files. */
export function readUpstream(dir: URL = VENDOR_DIR): Upstream {
  return Object.fromEntries(
    Object.entries(UPSTREAM_FILES).map(([name, file]) => [
      name,
      JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
    ])
  ) as Upstream
}

/** Writes one JSON file per collection, in a stable format so diffs show only data changes. */
export function writeDataset(dataset: RulesDataset, dir: URL = DATA_DIR) {
  mkdirSync(dir, { recursive: true })
  for (const name of ['meta', ...COLLECTIONS] as const) {
    writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(dataset[name], null, 2) + '\n')
  }
}
