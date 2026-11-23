import { error, fail, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { library } from '#lib/server/campaign/index.ts'
import { DraftNotFoundError } from '#lib/server/character/party.ts'
import { CharacterNotFoundError } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import type { Actions, PageServerLoad } from './$types'

/**
 * The Party step: the Campaign's saved Characters and drafts. `?draft=<id>` opens a stored draft
 * in the wizard and `?character=<id>` a saved Character; the wizard then needs the Rules Data the
 * resolver and `deriveStats` read in the browser.
 */
export const load: PageServerLoad = ({ params, url }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  const campaign = { id: entry.id, name: entry.name, path: entry.path, status: entry.status }
  if (entry.status === 'missing') return { campaign, members: [], open: null }

  const party = library.party(entry.id)
  const draftId = url.searchParams.get('draft')
  const characterId = url.searchParams.get('character')
  let open = null
  try {
    if (draftId) {
      const { id, draft, step } = party.draft(draftId)
      open = { rules: loadWizardRules(), draft, step, target: { campaign: entry.id, draft: id } }
    } else if (characterId) {
      const { character, draft } = party.character(characterId)
      open = {
        rules: loadWizardRules(),
        draft,
        step: 'review' as const,
        target: { campaign: entry.id, character: character.id }
      }
    }
  } catch (e) {
    if (e instanceof DraftNotFoundError || e instanceof CharacterNotFoundError) {
      error(404, e.message)
    }
    throw e
  }
  return { campaign, members: party.list(), open }
}

export const actions: Actions = {
  /** Starts a draft with the Campaign and opens it in the wizard. */
  newDraft: ({ params }) => {
    const entry = library.get(params.id)
    if (!entry) error(404, 'Campaign not found')
    if (entry.status !== 'active') {
      return fail(400, { error: 'An archived or missing Campaign cannot be changed' })
    }
    const { id } = library.party(entry.id).startDraft()
    redirect(
      303,
      `${resolve('/campaigns/[id]/party', { id: entry.id })}?draft=${encodeURIComponent(id)}`
    )
  }
}
