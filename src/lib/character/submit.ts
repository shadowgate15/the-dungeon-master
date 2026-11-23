import { goto } from '$app/navigation'
import { resolve } from '$app/paths'
import type { CharacterWizard } from './wizard.svelte.ts'

/**
 * Posts (or, when editing, puts) the draft. Success goes to `returnHref`, an already-resolved
 * path; failure keeps the draft and sets `wizard.saveError`.
 */
export async function submitDraft(wizard: CharacterWizard, returnHref: string) {
  const input = wizard.characterInput
  if (!input) return
  wizard.saving = true
  wizard.saveError = null
  try {
    const editing = wizard.characterId
    const response = await fetch(
      editing ? resolve('/api/characters/[id]', { id: editing }) : resolve('/api/characters'),
      {
        method: editing ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      }
    )
    const result = (await response.json()) as { id?: string; error?: string }
    if (response.ok && result.id) {
      // Saved: the draft is no longer unsaved, so leaving must not ask to discard it.
      wizard.dirty = false
      // The caller resolved the path.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(returnHref)
      return
    }
    wizard.saveError = result.error ?? 'The Character could not be saved.'
  } catch {
    wizard.saveError = 'The Character could not be saved.'
  } finally {
    wizard.saving = false
  }
}
