<script lang="ts">
  /* eslint-disable -- PROTOTYPE, throwaway */
  // PROTOTYPE variant C, "Own seat". Arriving is a short checklist: tick who you play, Join the
  // table, all at once. The play screen is the same for every browser (no Host controls inline):
  // a table band across the top shows the whole Party as seats, Done marks and a "waiting on" line.
  // Entries addressed to fewer than the Scene read as whispers. The Host's Claims controls live in
  // a separate Host drawer, grouped by browser, so Releasing is a deliberate act.
  import CharacterSheet from '#lib/play/CharacterSheet.svelte'
  import FloorComposer from '#lib/play/FloorComposer.svelte'
  import Button from '#lib/ui/Button.svelte'
  import {
    audienceLabel,
    browserName,
    claim,
    claimedBy,
    done,
    floorBrowsers,
    letGo,
    nameOf,
    ownSheets,
    party,
    release,
    send,
    table,
    undone,
    visibleTo,
    withdraw,
    type BrowserId
  } from './table.svelte.ts'

  let { viewer }: { viewer: { id: BrowserId; label: string; host: boolean } } = $props()
  const me = $derived(viewer.id)
  const mine = $derived(claimedBy(me))
  let choosing = $state(false)
  let ticked = $state<string[]>([])
  let drawer = $state(false)
  const joining = $derived(choosing || mine.length === 0)

  let picked = $state<string | null>(null)
  const sheets = $derived(ownSheets(me))
  const acting = $derived(
    sheets.find((s) => s.id === picked) ?? sheets.find((s) => s.canAct) ?? null
  )
  const imDone = $derived(table.done.includes(me))
  const waitingOn = $derived(floorBrowsers().filter((b) => !table.done.includes(b)))
  const total = $derived(floorBrowsers().length)
  const pending = $derived(
    table.declarations
      .filter((d) => d.player === me)
      .map((d) => ({ ...d, characterName: nameOf(d.character) }))
  )
  const holders = $derived([
    ...new Set(Object.values(table.claims).filter((b): b is BrowserId => b !== null))
  ])

  function join() {
    for (const c of ticked) claim(me, c)
    for (const c of mine) if (!ticked.includes(c)) letGo(me, c)
    choosing = false
  }
  function openChooser() {
    ticked = [...mine]
    choosing = true
  }
</script>

{#if joining}
  <main class="mx-auto max-w-lg space-y-4 p-6">
    <h1 class="font-display text-2xl">Join the table</h1>
    <p class="text-sm text-muted">The Harrowmere Letter · Session 3 is open. Tick who you play.</p>
    <ul class="divide-y divide-border rounded-panel border border-border bg-surface">
      {#each party as c (c.id)}
        {@const owner = table.claims[c.id]}
        {@const taken = owner !== null && owner !== me}
        <li>
          <label
            class={['flex items-center gap-3 px-4 py-3', taken ? 'opacity-50' : 'cursor-pointer']}
          >
            <input
              type="checkbox"
              disabled={taken}
              checked={ticked.includes(c.id) || owner === me}
              onchange={(e) =>
                (ticked = e.currentTarget.checked
                  ? [...ticked, c.id]
                  : ticked.filter((t) => t !== c.id))}
            />
            <span class="flex-1">
              <span class="font-medium">{c.name}</span>
              <span class="text-sm text-muted"> · {c.headline}</span>
            </span>
            {#if taken}<span class="text-xs">at the table</span>{/if}
          </label>
        </li>
      {/each}
    </ul>
    <div class="flex items-center justify-between">
      <Button variant="ghost" size="sm">+ Create a Character</Button>
      <Button disabled={ticked.length === 0 && mine.length === 0} onclick={join}
        >Join the table</Button
      >
    </div>
    {#if viewer.host}
      <p class="text-xs text-muted">
        Someone else holding a Character you need? Use Host › Claims on the play screen.
      </p>
    {/if}
  </main>
{:else}
  <div class="flex h-[calc(100dvh-5rem)] flex-col gap-2 overflow-hidden p-3">
    <header class="flex shrink-0 items-center gap-3 text-sm">
      <span class="underline">The Harrowmere Letter</span>
      <span class="text-muted">The Gilded Stag · 00:10, day 1</span>
      <button class="ml-auto underline" onclick={openChooser}>Your Characters</button>
      {#if viewer.host}
        <Button size="sm" variant="secondary" onclick={() => (drawer = !drawer)}>Host ▾</Button>
      {/if}
    </header>

    <!-- The table band: every seat in the Party. -->
    <section
      class="flex shrink-0 items-center gap-4 rounded-panel border border-border bg-surface px-4 py-2"
      aria-label="The table"
    >
      {#each party as c (c.id)}
        {@const owner = table.claims[c.id]}
        {@const isDone = owner !== null && table.done.includes(owner)}
        <div class="flex flex-col items-center gap-0.5 text-xs">
          <span
            class={[
              'relative flex size-9 items-center justify-center rounded-full border-2 font-display text-base',
              owner === me ? 'border-primary bg-primary text-on-primary' : 'bg-raised',
              owner === null && 'border-dashed border-border text-muted',
              owner !== null && owner !== me && (isDone ? 'border-success' : 'border-border')
            ]}
            >{c.name[0]}
            {#if isDone}<span class="absolute -right-1 -bottom-1 text-success">✓</span>{/if}
          </span>
          <span class={owner === me ? 'font-semibold' : 'text-muted'}>{c.name}</span>
        </div>
      {/each}
      <div class="ml-auto text-right text-sm">
        <div class="font-medium">{total - waitingOn.length} of {total} Players Done</div>
        <div class="text-muted">
          {#if waitingOn.length === 0}The DM is answering…
          {:else}Waiting on {waitingOn
              .map((b) => (b === me ? 'you' : browserName(b)))
              .join(', ')}{/if}
        </div>
      </div>
    </section>

    <main class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <CharacterSheet {sheets} acting={acting?.id ?? null} onselect={(id) => (picked = id)} />
      <section class="flex min-h-0 flex-col gap-2">
        <ol
          class="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-panel border border-border bg-surface p-4"
        >
          {#each visibleTo(me) as e (e.id)}
            {@const to = audienceLabel(e)}
            {@const mineOnly = to !== null && e.audience.every((c) => mine.includes(c))}
            <li>
              {#if to}
                <div
                  class="ml-8 rounded-control border border-dashed border-accent bg-raised p-2 italic"
                >
                  <div class="text-xs text-accent not-italic">
                    {mineOnly ? 'Whispered to you' : `Whispered to ${to}`}
                  </div>
                  {e.type === 'declaration' ? `${nameOf(e.character)}: ` : ''}{e.text}
                </div>
              {:else if e.type === 'declaration'}
                <p class="text-right"><strong>{nameOf(e.character)}</strong>: {e.text}</p>
              {:else if e.type === 'activity'}
                <p class="text-sm text-muted">⚙ DM {e.text.replace(/^DM /, '')}</p>
              {:else}
                <p>
                  {#if e.voice}<strong>{e.voice}:</strong>{/if}
                  {e.text}
                </p>
              {/if}
            </li>
          {/each}
        </ol>
        {#if imDone}
          <div
            class="flex items-center justify-between rounded-control bg-success-bg px-3 py-2 text-sm text-success"
          >
            You're Done. {waitingOn.length ? 'The Floor closes when everyone is.' : ''}
            <button class="underline" onclick={() => undone(me)}>Not done yet</button>
          </div>
        {/if}
        <FloorComposer
          acting={acting?.name ?? null}
          declarations={pending}
          awaiting={imDone}
          onsend={(text) => acting && send(me, acting.id, text)}
          ondone={(text) => {
            if (text && acting) send(me, acting.id, text)
            done(me)
          }}
          onedit={() => {}}
          onwithdraw={withdraw}
        />
      </section>
    </main>
  </div>

  {#if drawer && viewer.host}
    <aside
      class="fixed top-20 right-3 z-40 w-80 space-y-3 rounded-panel border border-border bg-surface p-4 shadow-2xl"
    >
      <div class="flex items-baseline justify-between">
        <h2 class="font-display text-lg">Claims</h2>
        <button class="text-sm" onclick={() => (drawer = false)}>✕</button>
      </div>
      <p class="text-xs text-muted">Each browser at the table, by the Characters it holds.</p>
      <ul class="space-y-2">
        {#each holders as b (b)}
          <li class="rounded-control border border-border p-2 text-sm">
            <div class="mb-1 font-medium">
              {b === me ? 'This browser' : 'A browser'} · {table.done.includes(b)
                ? 'Done'
                : 'deciding'}
            </div>
            {#each claimedBy(b) as c (c)}
              <div class="flex items-center justify-between">
                <span>{nameOf(c)}</span>
                <button class="text-xs text-danger underline" onclick={() => release(c)}
                  >Release</button
                >
              </div>
            {/each}
          </li>
        {/each}
        {#each party.filter((c) => !table.claims[c.id]) as c (c.id)}
          <li class="text-sm text-muted">{c.name} · free</li>
        {/each}
      </ul>
      <div class="border-t border-border pt-2 text-xs text-muted">
        Join at <span class="font-mono">http://192.168.1.20:5173/campaigns/…</span>
      </div>
    </aside>
  {/if}
{/if}
