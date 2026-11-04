<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import WizardShell from '#lib/character/WizardShell.svelte'
  import { CharacterWizard } from '#lib/character/wizard.svelte.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // One wizard per visit; the draft is browser-only and gone on reload or abandon.
  // svelte-ignore state_referenced_locally
  const wizard = new CharacterWizard(data.rules)
</script>

<svelte:head><title>New Character</title></svelte:head>

<WizardShell
  {wizard}
  backHref={resolve('/characters')}
  onabandon={() => goto(resolve('/characters'))}
/>
