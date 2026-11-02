<!-- PROTOTYPE (issue #74): three variants of /campaigns, switch with ?variant=A|B|C (or ← →). In-memory stub data; wipe me. -->
<script lang="ts">
  import { page } from '$app/state'
  import PrototypeSwitcher from './PrototypeSwitcher.svelte'
  import VariantA from './VariantA.svelte'
  import VariantB from './VariantB.svelte'
  import VariantC from './VariantC.svelte'

  const variants = { A: 'Mirror Worlds', B: 'Worlds first', C: 'Seed card hero' }
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  const worldFilter = $derived(page.url.searchParams.get('world'))
  const view = $derived(page.url.searchParams.get('view') === 'archived' ? 'archived' : 'active')
</script>

{#if variant === 'A'}<VariantA {worldFilter} {view} />{/if}
{#if variant === 'B'}<VariantB {worldFilter} {view} />{/if}
{#if variant === 'C'}<VariantC {worldFilter} {view} />{/if}
<PrototypeSwitcher {variants} current={variant} />
