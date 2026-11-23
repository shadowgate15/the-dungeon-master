import { rulesDatabase } from '#lib/server/db/index.ts'
import { loadCredits } from '#lib/server/rules/credits.ts'
import { createRulesRepository } from '#lib/server/rules/repository.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => loadCredits(createRulesRepository(rulesDatabase()))
