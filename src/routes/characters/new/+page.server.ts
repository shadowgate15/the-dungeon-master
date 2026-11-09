import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import type { PageServerLoad } from './$types'

/**
 * The wizard's draft is browser-only, so the browser needs the Rules Data the resolver and
 * `deriveStats` read. Saving goes through `POST /api/characters`.
 */
export const load: PageServerLoad = () => ({ rules: loadWizardRules() })
