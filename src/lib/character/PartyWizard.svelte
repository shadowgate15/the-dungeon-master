<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import type { CharacterDraft, WizardRules } from './draft.ts'
  import type { StepId } from './steps.ts'
  import WizardShell from './WizardShell.svelte'
  import { createDraftQuery } from '#lib/creation/client.ts'
  import { CharacterWizard, type WizardTarget } from './wizard.svelte.ts'

  type Props = {
    rules: WizardRules
    draft: CharacterDraft
    step: StepId
    target: WizardTarget
    /** The Party step, already resolved: where saving and abandoning return to. */
    backHref: string
    /** A stored draft's version and the fields the DM set ("✎ DM"). */
    stored?: { version: number; dmFields: string[] }
  }

  let { rules, draft, step, target, backHref, stored }: Props = $props()

  // One wizard per opened draft or Character; the page keys this component on the target.
  // svelte-ignore state_referenced_locally
  const wizard = new CharacterWizard(rules, undefined, draft, target, step)

  // A stored draft follows the DM's writes: they refetch it and the changed fields land here.
  // svelte-ignore state_referenced_locally
  if ('draft' in target && stored) {
    const query = createDraftQuery(
      () => target.campaign,
      () => target.draft,
      () => ({ draft, ...stored })
    )
    $effect(() => {
      const next = query.data
      untrack(() => wizard.adopt(next))
    })
  }

  /** Abandoning a stored draft discards it; leaving an edit just drops the changes. */
  async function abandon() {
    if ('draft' in target) {
      await fetch(
        resolve('/api/campaigns/[id]/drafts/[draft]', { id: target.campaign, draft: target.draft }),
        { method: 'DELETE' }
      )
    }
    // The caller resolved the path.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    await goto(backHref, { invalidateAll: true })
  }
</script>

<WizardShell {wizard} {backHref} onabandon={abandon} />
