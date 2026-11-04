import { error } from '@sveltejs/kit'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { db } from '#lib/server/db/index.ts'
import type { PageServerLoad } from './$types'

const characters = createCharacterService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = characters.get(params.id)
  if (!found) error(404, 'Character not found')
  return {
    id: found.id,
    name: found.name,
    archived: found.archivedAt !== null,
    // Computed here, with the Rules Data on the server, so the browser needs none of it.
    summary: buildSummary(loadWizardRules(), detailToSummaryData(found))
  }
}
