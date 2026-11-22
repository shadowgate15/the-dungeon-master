<script lang="ts">
  // PROTOTYPE (wayfinder #308 "What the play screen shows"): three radically different
  // play-screen layouts on mock data, switchable via ?variant=A|B|C and the floating bar.
  // Scenario toggles in the bar flip exploration/Combat and the DM's status. Throwaway.
  import { page } from '$app/state'
  import PrototypeSwitcher from '#lib/prototype/PrototypeSwitcher.svelte'
  import type { DmStatus } from '#lib/prototype/play-mock.ts'
  import VariantA from './VariantA.svelte'
  import VariantB from './VariantB.svelte'
  import VariantC from './VariantC.svelte'

  const variants = [
    { key: 'A', name: 'Three-column table' },
    { key: 'B', name: 'Book with drawers' },
    { key: 'C', name: 'Sheet-first console' }
  ]
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')

  let combat = $state(true)
  let status = $state<DmStatus>('idle')
  let elapsed = $state(0)

  $effect(() => {
    if (status === 'idle') return
    elapsed = 0
    const t = setInterval(() => (elapsed += 1), 1000)
    return () => clearInterval(t)
  })

  const scenario = $derived({ combat, status, elapsed })
  const send = () => (status = 'thinking')
</script>

<svelte:head><title>PROTOTYPE · play screen {variant}</title></svelte:head>

{#if variant === 'A'}<VariantA
    {scenario}
    onsend={send}
    onresolve={() => (status = 'thinking')}
  />{/if}
{#if variant === 'B'}<VariantB
    {scenario}
    onsend={send}
    onresolve={() => (status = 'thinking')}
  />{/if}
{#if variant === 'C'}<VariantC
    {scenario}
    onsend={send}
    onresolve={() => (status = 'thinking')}
  />{/if}

{#if variant !== 'C'}<div class="h-20"></div>{/if}

<PrototypeSwitcher {variants} current={variant}>
  {#snippet extras()}
    <label class="flex items-center gap-1"
      ><input type="checkbox" bind:checked={combat} class="rounded" /> Combat</label
    >
    <select bind:value={status} class="rounded bg-white/10 py-0 pr-6 pl-2 text-xs text-white">
      <option value="idle">DM idle</option>
      <option value="thinking">DM thinking</option>
      <option value="permission">DM asks permission</option>
    </select>
  {/snippet}
</PrototypeSwitcher>
