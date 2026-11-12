<!-- eslint-disable -->
<!--
  PROTOTYPE (throwaway, ticket "Arc generation and review"). Do not ship.
  Three variants of the Arc section on the Campaign page, via ?variant=A|B|C.
  All state is in memory and stubbed; Generate fakes a 3s call.
  Assumption: the Arc section sits between Character and Sessions.
-->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import TextInput from '#lib/ui/TextInput.svelte'

  type Beat = { id: number; text: string }
  type Act = { id: number; name: string; purpose: string; beats: Beat[] }
  type Arc = { title: string; premise: string; stakes: string; acts: Act[]; resolution: string }

  const make = (n: number): Arc => ({
    title: `The Ember Crown ${n}`,
    premise: 'A dying baron hides a relic that can rekindle the old war.',
    stakes: 'If the relic is claimed by the wrong hand, the valley burns.',
    acts: [
      {
        id: 1,
        name: 'Setup',
        purpose: 'Draw the Character into the baron’s troubles.',
        beats: [
          { id: 1, text: 'A courier dies at the Character’s feet, clutching a sealed letter.' },
          { id: 2, text: 'The baron’s steward offers coin to escort the letter.' }
        ]
      },
      {
        id: 2,
        name: 'Escalation',
        purpose: 'The relic’s pursuers close in.',
        beats: [
          { id: 3, text: 'The road is ambushed by cultists wearing the baron’s livery.' },
          { id: 4, text: 'The steward is revealed as a double agent.' }
        ]
      },
      {
        id: 3,
        name: 'Climax',
        purpose: 'Decide who holds the relic.',
        beats: [{ id: 5, text: 'Confrontation in the baron’s burning keep.' }]
      }
    ],
    resolution: 'The relic is destroyed, hidden or claimed; the valley’s fate follows.'
  })

  const variant = $derived(page.url.searchParams.get('variant') ?? 'A')
  const setVariant = (v: string) => goto(`?variant=${v}`, { replaceState: true, noScroll: true })

  // stub state
  let status = $state<'none' | 'generating' | 'failed' | 'ready'>('none')
  let arc = $state<Arc | null>(null)
  let started = $state(false) // first Session started → structure locked
  let failNext = $state(false)
  let gen = 1
  let timer: ReturnType<typeof setTimeout> | undefined
  let editing = $state(false) // variant C whole-arc edit
  let confirmRegen = $state(false)

  function generate() {
    confirmRegen = false
    status = 'generating'
    timer = setTimeout(() => {
      if (failNext) {
        status = 'failed'
        failNext = false
      } else {
        arc = make(gen++)
        status = 'ready'
      }
    }, 3000)
  }
  function stop() {
    clearTimeout(timer)
    status = arc ? 'ready' : 'none'
  }
  const busy = $derived(status === 'generating')
  const regenerate = () => (arc ? (confirmRegen = true) : generate())
  const locked = $derived(started)
</script>

{#snippet ctrl()}
  <div class="flex flex-wrap items-center gap-2">
    {#if busy}
      <Button variant="secondary" onclick={stop}>Stop</Button>
      <span class="text-sm text-muted" role="status">Generating the Arc…</span>
    {:else if arc}
      <Button variant="secondary" onclick={regenerate} disabled={started}>Regenerate</Button>
      {#if started}<span class="text-sm text-muted">Locked: a Session has started.</span>{/if}
    {:else}
      <Button onclick={generate}>Generate Arc</Button>
    {/if}
  </div>
  {#if confirmRegen}
    <Alert variant="warning">
      Regenerating replaces the whole Arc, including your edits.
      <span class="mt-2 flex gap-2">
        <Button size="sm" variant="danger" onclick={generate}>Replace Arc</Button>
        <Button size="sm" variant="ghost" onclick={() => (confirmRegen = false)}>Keep current</Button
        >
      </span>
    </Alert>
  {/if}
  {#if status === 'failed'}
    <Alert variant="danger">
      The Arc could not be generated. {arc ? 'Your current Arc is unchanged.' : ''}
      <Button size="sm" variant="secondary" onclick={generate}>Try again</Button>
    </Alert>
  {/if}
{/snippet}

{#snippet empty()}
  <p class="text-muted">
    No Arc yet. An Arc is the planned shape of the story. The DM steers by it but may deviate. You
    can play without one.
  </p>
{/snippet}

<section aria-label="Arc" class="space-y-3 rounded-control border border-control-border p-4">
  <div class="flex items-baseline justify-between">
    <h2 class="font-display text-lg">Arc</h2>
    {#if arc}<span class="text-xs text-muted">Not shown during play</span>{/if}
  </div>

  {#if variant === 'A'}
    <!-- A: inline, always-editable fields; acts stacked; one Regenerate in header area -->
    {#if !arc && !busy}{@render empty()}{/if}
    {@render ctrl()}
    {#if arc}
      <div class:opacity-50={busy} class="space-y-3">
        <label class="block text-sm">Title <TextInput bind:value={arc.title} /></label>
        <label class="block text-sm">Premise <Textarea bind:value={arc.premise} rows={2} /></label>
        <label class="block text-sm">Stakes <Textarea bind:value={arc.stakes} rows={2} /></label>
        {#each arc.acts as act (act.id)}
          <fieldset class="space-y-2 rounded-control bg-raised p-3">
            <legend class="px-1 text-sm font-medium">Act: {act.name}</legend>
            <TextInput bind:value={act.purpose} />
            {#each act.beats as b, i (b.id)}
              <label class="block text-sm">Beat {i + 1}<Textarea bind:value={b.text} rows={2} /></label>
            {/each}
          </fieldset>
        {/each}
        <label class="block text-sm">Resolution <Textarea bind:value={arc.resolution} rows={2} /></label>
        <p class="text-xs text-muted">Edits save as you type.</p>
      </div>
    {/if}
  {:else if variant === 'B'}
    <!-- B: read-first summary card; one expandable outline; Edit opens a Dialog-like panel per piece -->
    {#if !arc && !busy}{@render empty()}{/if}
    {#if arc}
      <div class:opacity-50={busy} class="space-y-2">
        <p class="font-display text-xl">{arc.title}</p>
        <p>{arc.premise}</p>
        <p class="text-sm text-muted">Stakes: {arc.stakes}</p>
        <ol class="space-y-1 text-sm">
          {#each arc.acts as act (act.id)}
            <li>
              <details>
                <summary class="cursor-pointer font-medium"
                  >{act.name} <span class="text-muted">· {act.beats.length} Beats</span></summary
                >
                <p class="text-muted">{act.purpose}</p>
                <ul class="ml-4 list-disc">
                  {#each act.beats as b (b.id)}<li>{b.text}</li>{/each}
                </ul>
              </details>
            </li>
          {/each}
        </ol>
        <p class="text-sm text-muted">Resolution: {arc.resolution}</p>
        <Button variant="secondary" size="sm" onclick={() => (editing = !editing)}
          >{editing ? 'Done editing' : 'Edit Arc'}</Button
        >
        {#if editing}
          <div class="space-y-2 rounded-control bg-raised p-3">
            <label class="block text-sm">Title <TextInput bind:value={arc.title} /></label>
            <label class="block text-sm">Premise <Textarea bind:value={arc.premise} rows={2} /></label>
            <label class="block text-sm">Stakes <Textarea bind:value={arc.stakes} rows={2} /></label>
            {#each arc.acts as act (act.id)}
              {#each act.beats as b (b.id)}
                <label class="block text-sm">{act.name}: Beat <Textarea bind:value={b.text} rows={2} /></label>
              {/each}
            {/each}
            <label class="block text-sm">Resolution <Textarea bind:value={arc.resolution} rows={2} /></label>
          </div>
        {/if}
      </div>
    {/if}
    {@render ctrl()}
  {:else}
    <!-- C: guided two-step "draft → accept": generated Arc is a pending draft until accepted; regenerate free while a draft -->
    {#if !arc && !busy}{@render empty()}{/if}
    {#if arc}
      <div class:opacity-50={busy} class="space-y-2 text-sm">
        <Alert variant="info">
          Draft Arc. Review it, edit any text inline, then accept it. Regenerate freely until you
          accept.
        </Alert>
        <p class="font-display text-lg">{arc.title}</p>
        <p>{arc.premise}</p>
        {#each arc.acts as act (act.id)}
          <div class="border-l-2 border-control-border pl-3">
            <p class="font-medium">{act.name}: <span class="font-normal">{act.purpose}</span></p>
            {#each act.beats as b, i (b.id)}
              <p contenteditable="true" bind:textContent={b.text} class="rounded px-1 hover:bg-raised">
              </p>
            {/each}
          </div>
        {/each}
        <p class="text-muted">Resolution: {arc.resolution}</p>
        <div class="flex gap-2">
          <Button size="sm" disabled>Accept Arc (stub)</Button>
        </div>
      </div>
    {/if}
    {@render ctrl()}
  {/if}
</section>

<div
  class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full bg-black px-4 py-2 text-xs text-white shadow-lg"
>
  <button onclick={() => setVariant(variant === 'A' ? 'C' : variant === 'B' ? 'A' : 'B')}>←</button>
  <span
    >{variant}: {variant === 'A'
      ? 'Inline form'
      : variant === 'B'
        ? 'Read-first + Edit'
        : 'Draft → accept'}</span
  >
  <button onclick={() => setVariant(variant === 'A' ? 'B' : variant === 'B' ? 'C' : 'A')}>→</button>
  <span>|</span>
  <label><input type="checkbox" bind:checked={failNext} /> next gen fails</label>
  <label><input type="checkbox" bind:checked={started} /> Session started</label>
  <button
    onclick={() => {
      arc = null
      status = 'none'
    }}>reset</button
  >
</div>
