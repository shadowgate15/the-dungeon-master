// Build-time entry point: `pnpm rules:normalize` rewrites src/lib/rules/data from vendor/.
import { normalize } from './normalize.ts'
import { readUpstream, writeDataset } from './read.ts'
import { rulesDataset } from '../schema.ts'

const dataset = rulesDataset.parse(normalize(readUpstream()))
writeDataset(dataset)
console.log(
  `Wrote Rules Data ${dataset.meta.sourceTag}: ${dataset.races.length} races, ` +
    `${dataset.classes.length} classes, ${dataset.spells.length} spells, ` +
    `${dataset.equipment.length} equipment items.`
)
