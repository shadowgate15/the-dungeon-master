<!-- PROTOTYPE (wipe me): three variants of the World creation flow, switch with ?variant=A|B|C. Stub AI, no persistence. -->
<script lang="ts">
  import { page } from '$app/state'
  import Switcher from './Switcher.svelte'
  import VariantA from './VariantA.svelte'
  import VariantB from './VariantB.svelte'
  import VariantC from './VariantC.svelte'
  const variants = { A: 'Single form', B: 'Wizard', C: 'Conversation' }
  const v = $derived(page.url.searchParams.get('variant') ?? 'A')
</script>

<main class="mx-auto max-w-5xl p-6 pb-24">
  {#if v === 'A'}<VariantA />{:else if v === 'B'}<VariantB />{:else}<VariantC />{/if}
</main>
<Switcher {variants} />
