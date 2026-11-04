<!-- PROTOTYPE (throwaway): "we cleared this" messages from changing an earlier choice. -->
<script lang="ts">
  import Alert from '#lib/ui/Alert.svelte'
  import type { Wizard } from './model.svelte.ts'
  let { w }: { w: Wizard } = $props()
</script>

{#each w.notices as n, i (i + n)}
  <Alert variant="info" role="status">
    <span class="flex items-center justify-between gap-2"
      >{n}
      <button type="button" class="text-sm underline" onclick={() => w.notices.splice(i, 1)}
        >Dismiss</button
      ></span
    >
  </Alert>
{/each}
