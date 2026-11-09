<script lang="ts">
  import Alert from '#lib/ui/Alert.svelte'
  import CharacterSummary from './CharacterSummary.svelte'
  import { buildSummary, draftToSummaryData } from './summary.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const model = $derived(buildSummary(wizard.rules, draftToSummaryData(wizard.rules, wizard.draft)))
</script>

<div class="space-y-4">
  <CharacterSummary {model} />

  {#if wizard.saveError}
    <Alert variant="danger">{wizard.saveError} Your draft is kept; fix it and save again.</Alert>
  {/if}
</div>
