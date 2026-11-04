import { WIZARD_RULES_KEYS, type WizardRules } from '#lib/character/draft.ts'
import { loadRulesDataset } from '../rules/dataset.ts'

let cached: WizardRules | undefined

/**
 * The Rules Data collections the resolver and `deriveStats` read, in the plain dataset shape (the
 * committed JSON the database is seeded from). Loaded once per process.
 */
export function loadWizardRules(): WizardRules {
  if (!cached) {
    const dataset = loadRulesDataset()
    cached = Object.fromEntries(WIZARD_RULES_KEYS.map((k) => [k, dataset[k]])) as WizardRules
  }
  return cached
}
