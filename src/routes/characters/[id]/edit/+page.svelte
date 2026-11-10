<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import WizardShell from '#lib/character/WizardShell.svelte'
  import { CharacterWizard } from '#lib/character/wizard.svelte.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // One wizard per visit, prefilled from the saved Character; the draft is browser-only until saved.
  // svelte-ignore state_referenced_locally
  const wizard = new CharacterWizard(data.rules, undefined, data.draft, data.id)
  const summaryHref = $derived(resolve('/characters/[id]', { id: data.id }))
</script>

<svelte:head><title>Edit {data.draft.name}</title></svelte:head>

<WizardShell {wizard} backHref={summaryHref} onabandon={() => goto(summaryHref)}></WizardShell>
