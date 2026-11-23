<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import type { CharacterDraft, WizardRules } from './draft.ts'
  import type { StepId } from './steps.ts'
  import WizardShell from './WizardShell.svelte'
  import { CharacterWizard, type WizardTarget } from './wizard.svelte.ts'

  type Props = {
    rules: WizardRules
    draft: CharacterDraft
    step: StepId
    target: WizardTarget
    /** The Party step, already resolved: where saving and abandoning return to. */
    backHref: string
  }

  let { rules, draft, step, target, backHref }: Props = $props()

  // One wizard per opened draft or Character; the page keys this component on the target.
  // svelte-ignore state_referenced_locally
  const wizard = new CharacterWizard(rules, undefined, draft, target, step)

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
