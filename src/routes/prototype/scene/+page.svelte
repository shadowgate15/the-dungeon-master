<!--
  PROTOTYPE (throwaway). Three layouts of a state-driven, scene-and-mode session, switched with
  ?variant=A|B|C. See src/lib/prototype/README.md.
-->
<script lang="ts">
  import { page } from '$app/state'
  import PrototypeSwitcher from '#lib/prototype/PrototypeSwitcher.svelte'
  import RollOverlay from '#lib/prototype/RollOverlay.svelte'
  import { SceneStore } from '#lib/prototype/store.svelte.ts'
  import VariantA from '#lib/prototype/VariantA.svelte'
  import VariantB from '#lib/prototype/VariantB.svelte'
  import VariantC from '#lib/prototype/VariantC.svelte'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // svelte-ignore state_referenced_locally
  const store = new SceneStore(data.state, data.aiConfigured, data.stepCap)

  const variants = [
    { key: 'A', name: 'Location hero + log' },
    { key: 'B', name: 'Visual-novel stage' },
    { key: 'C', name: 'Dashboard' }
  ]
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
</script>

<svelte:head><title>PROTOTYPE: scene director</title></svelte:head>

{#if variant === 'B'}
  <VariantB {store} />
{:else if variant === 'C'}
  <VariantC {store} />
{:else}
  <VariantA {store} />
{/if}

<RollOverlay {store} />
<PrototypeSwitcher {variants} current={variant} />
