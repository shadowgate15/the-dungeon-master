import { readFileSync } from 'node:fs'
import { COLLECTIONS, type RulesDataset } from './schema.ts'

/** The committed Rules Data as plain objects, for pure-rules tests. Test helper only. */
export function loadDataset(): RulesDataset {
  return Object.fromEntries(
    ['meta', ...COLLECTIONS].map((name) => [
      name,
      JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'))
    ])
  ) as RulesDataset
}
