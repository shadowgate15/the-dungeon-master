import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import type { CharacterWizard, WizardTarget } from './wizard.svelte.ts'

/** The request that writes a stored draft and the step it is on, without saving it. */
export function draftWrite(target: { campaign: string; draft: string }, wizard: CharacterWizard) {
  return {
    url: resolve('/api/campaigns/[id]/drafts/[draft]', {
      id: target.campaign,
      draft: target.draft
    }),
    init: {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: wizard.draft, step: wizard.current })
    }
  }
}

/** The request that saves the draft: into the Party for a stored draft, over a saved Character. */
function saveRequest(target: WizardTarget, wizard: CharacterWizard) {
  const headers = { 'content-type': 'application/json' }
  if ('character' in target) {
    return {
      url: resolve('/api/campaigns/[id]/characters/[character]', {
        id: target.campaign,
        character: target.character
      }),
      init: { method: 'PUT', headers, body: JSON.stringify(wizard.draft) }
    }
  }
  return {
    url: resolve('/api/campaigns/[id]/drafts/[draft]/save', {
      id: target.campaign,
      draft: target.draft
    }),
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ draft: wizard.draft, step: wizard.current })
    }
  }
}

/**
 * Saves the draft. Success goes to `returnHref`, an already-resolved path; failure keeps the
 * draft and sets `wizard.saveError`.
 */
export async function submitDraft(wizard: CharacterWizard, returnHref: string) {
  if (!wizard.characterInput || !wizard.target) return
  wizard.saving = true
  wizard.saveError = null
  try {
    const { url, init } = saveRequest(wizard.target, wizard)
    const response = await fetch(url, init)
    const result = (await response.json()) as { id?: string; error?: string }
    if (response.ok && result.id) {
      // Saved: the draft is no longer unsaved, so leaving must not ask to discard it.
      wizard.dirty = false
      // The caller resolved the path.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(returnHref, { invalidateAll: true })
      return
    }
    wizard.saveError = result.error ?? 'The Character could not be saved.'
  } catch {
    wizard.saveError = 'The Character could not be saved.'
  } finally {
    wizard.saving = false
  }
}
