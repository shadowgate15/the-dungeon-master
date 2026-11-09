import { error, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { detailToDraft } from '#lib/character/edit.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { db } from '#lib/server/db/index.ts'
import type { PageServerLoad } from './$types'

const characters = createCharacterService(db)

/**
 * Reopens a saved Character in the wizard. An archived Character is read-only, so it goes back
 * to its summary. The stored picks become the starting draft; nothing is unsaved until a change.
 */
export const load: PageServerLoad = ({ params }) => {
  const found = characters.get(params.id)
  if (!found) error(404, 'Character not found')
  if (found.archivedAt !== null) redirect(303, resolve('/characters/[id]', { id: found.id }))
  const rules = loadWizardRules()
  return { id: found.id, rules, draft: detailToDraft(rules, found) }
}
