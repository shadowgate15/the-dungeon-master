<script lang="ts">
  // PROTOTYPE (wayfinder #308 "What the play screen shows"): three layouts for the Campaign
  // page during creation, ?variant=A|B|C. Bar toggle: whether a DM session is live. Throwaway.
  import { page } from '$app/state'
  import Button from '#lib/ui/Button.svelte'
  import PrototypeSwitcher from '#lib/prototype/PrototypeSwitcher.svelte'
  import DmChat from '#lib/prototype/DmChat.svelte'
  import SeedFields from '#lib/prototype/SeedFields.svelte'
  import WizardStep from '#lib/prototype/WizardStep.svelte'
  import { beginReady, characters, seed } from '#lib/prototype/creation-mock.ts'

  const variants = [
    { key: 'A', name: 'Side by side' },
    { key: 'B', name: 'Stepper + docked chat' },
    { key: 'C', name: 'Conversation-first' }
  ]
  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  let live = $state(true)
  let step = $state<'Seed' | 'Party' | 'Begin'>('Party')
  const canBegin = beginReady.seedValid && beginReady.partyCount > 0
</script>

<svelte:head><title>PROTOTYPE · campaign creation {variant}</title></svelte:head>

{#snippet party()}
  <ul class="flex flex-col gap-1 text-sm">
    {#each characters as c (c.name)}
      <li class="flex items-center justify-between rounded-control bg-raised px-2 py-1">
        <span
          ><span class="font-medium">{c.name}</span>
          <span class="text-muted">{c.summary}</span></span
        >
        <span class={['text-xs', c.status === 'draft' ? 'text-warning' : 'text-success']}>
          {c.status === 'draft' ? `draft · step ${c.step + 1}/6` : 'in the Party'}
        </span>
      </li>
    {/each}
  </ul>
  <Button size="sm" variant="secondary" class="mt-2">+ New Character</Button>
{/snippet}

{#snippet begin()}
  <div class="flex items-center gap-3">
    <Button disabled={!canBegin}>Begin</Button>
    <span class="text-xs text-muted">
      {canBegin
        ? `Seed valid · ${beginReady.partyCount} Character in the Party`
        : 'Needs a valid Seed and one Character'}
      {#if !live}· needs a live session{/if}
    </span>
  </div>
{/snippet}

{#if variant === 'A'}
  <!-- A: three equal columns, everything visible at once. -->
  <main class="mx-auto flex max-w-7xl flex-col gap-3 p-4">
    <header class="flex items-center justify-between">
      <div>
        <p class="text-sm text-muted">New Campaign</p>
        <h1 class="font-display text-2xl">The Salt Road</h1>
      </div>
      {@render begin()}
    </header>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section class="rounded-panel border border-border bg-surface p-3">
        <h2 class="mb-2 font-display">Seed</h2>
        <SeedFields />
      </section>
      <section class="flex flex-col gap-3 rounded-panel border border-border bg-surface p-3">
        <h2 class="font-display">Party</h2>
        {@render party()}
        <hr class="border-border" />
        <WizardStep />
      </section>
      <DmChat {live} class="min-h-[32rem]" />
    </div>
  </main>
{:else if variant === 'B'}
  <!-- B: one form at a time behind a stepper; DM chat docked on the right. -->
  <div class="grid min-h-[calc(100vh-3rem)] grid-cols-1 lg:grid-cols-[1fr_24rem]">
    <main class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 class="font-display text-3xl">The Salt Road</h1>
      <nav class="flex gap-0 border-b border-border">
        {#each ['Seed', 'Party', 'Begin'] as const as s, i (s)}
          <button
            class={[
              'px-4 py-2 text-sm',
              step === s ? 'border-b-2 border-primary font-semibold' : 'text-muted'
            ]}
            onclick={() => (step = s)}>{i + 1}. {s} {s === 'Seed' ? '✓' : ''}</button
          >
        {/each}
      </nav>
      {#if step === 'Seed'}
        <SeedFields />
      {:else if step === 'Party'}
        {@render party()}
        <div class="rounded-panel border border-border bg-surface p-4"><WizardStep /></div>
      {:else}
        <div class="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4 text-sm">
          <p>
            When you Begin, the DM builds the World and the first Arc from your Seed and Party.
            You’ll get a spoiler-free pitch, then play opens.
          </p>
          <p class="text-muted">
            The Seed locks after Begin. Start over stays available until the first Narration.
          </p>
          {@render begin()}
        </div>
      {/if}
    </main>
    <DmChat {live} class="rounded-none border-y-0 border-r-0" />
  </div>
{:else}
  <!-- C: the conversation is the page; forms are live cards that show what the DM fills in. -->
  <div class="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_22rem]">
    <DmChat {live} class="min-h-[75vh]" />
    <aside class="flex flex-col gap-3">
      <section class="rounded-panel border border-border bg-surface p-3">
        <div class="mb-2 flex justify-between">
          <h2 class="font-display">Seed</h2>
          <span class="text-xs text-muted"
            >{seed.filter((f) => f.value).length}/{seed.length} filled</span
          >
        </div>
        <SeedFields dense />
      </section>
      <section class="rounded-panel border border-border bg-surface p-3">
        <h2 class="mb-2 font-display">Party</h2>
        {@render party()}
        <p class="mt-2 text-xs text-muted">Open a draft to edit it in the full wizard.</p>
      </section>
      <section class="rounded-panel border border-border bg-surface p-3">{@render begin()}</section>
    </aside>
  </div>
{/if}

<div class="h-20"></div>

<PrototypeSwitcher {variants} current={variant}>
  {#snippet extras()}
    <label class="flex items-center gap-1"
      ><input type="checkbox" bind:checked={live} class="rounded" /> Session live</label
    >
  {/snippet}
</PrototypeSwitcher>
