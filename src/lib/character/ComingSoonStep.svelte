<script lang="ts">
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()
</script>

<p class="text-muted">
  {wizard.step(wizard.current)?.label} is not available yet. Concept is the only step built so far.
</p>
