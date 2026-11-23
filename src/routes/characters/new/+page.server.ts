import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import type { PageServerLoad } from './$types'

/**
 * The wizard's draft is browser-only, so the browser needs the Rules Data the resolver and
 * `deriveStats` read. Saving goes through `POST /api/characters`. `?campaign=<id>` names the
 * Campaign to return to; without it the wizard returns to the Campaign library.
 */
export const load: PageServerLoad = ({ url }) => ({
  rules: loadWizardRules(),
  campaign: url.searchParams.get('campaign')
})
