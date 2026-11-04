import { WIZARD_RULES_KEYS, type WizardRules } from '#lib/character/draft.ts'
import { loadRulesDataset } from '#lib/server/rules/dataset.ts'
import type { PageServerLoad } from './$types'

/**
 * The wizard's draft is browser-only, so the browser needs the Rules Data the resolver and
 * `deriveStats` read. They take the plain dataset shape (the same committed JSON the database is
 * seeded from), not repository rows, so the load hands over exactly the collections they use.
 */
let cached: WizardRules | undefined

export const load: PageServerLoad = () => {
  if (!cached) {
    const dataset = loadRulesDataset()
    cached = Object.fromEntries(WIZARD_RULES_KEYS.map((k) => [k, dataset[k]])) as WizardRules
  }
  return { rules: cached }
}
