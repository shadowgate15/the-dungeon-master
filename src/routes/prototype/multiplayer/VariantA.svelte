<script lang="ts">
  /* eslint-disable -- PROTOTYPE, throwaway */
  // PROTOTYPE variant A, "Seats". Claiming is a full page of Character cards that replaces the
  // play screen (as the Claims decision says). On the play screen the real components stay as they
  // are; a "table" strip above the composer shows each browser at the table by its Characters,
  // with its Floor state. The Host's Release lives on the Claim page and in the strip's chips.
  // Narrowed entries are filtered silently: no marker says who else saw them.
  import CharacterSheet from '#lib/play/CharacterSheet.svelte'
  import FloorComposer from '#lib/play/FloorComposer.svelte'
  import Rail from '#lib/play/Rail.svelte'
  import Timeline from '#lib/play/Timeline.svelte'
  import { journalEntries } from '#lib/play/play-fixtures.ts'
  import { knownBy } from '#lib/play/journal.ts'
  import type { TimelineEntry } from '#lib/play/timeline.ts'
  import Badge from '#lib/ui/Badge.svelte'
  import Button from '#lib/ui/Button.svelte'
  import {
    browserName,
    claim,
    claimedBy,
    done,
    floorBrowsers,
    isHost,
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
  const showClaim = $derived(choosing || mine.length === 0)

  let picked = $state<string | null>(null)
  const sheets = $derived(ownSheets(me))
  const acting = $derived(
    sheets.find((s) => s.id === picked) ?? sheets.find((s) => s.canAct) ?? null
  )

  const entries = $derived(
    visibleTo(me).map((e): TimelineEntry =>
      e.type === 'declaration'
        ? { ...e, character: nameOf(e.character), player: table.claims[e.character] ?? 'player' }
        : e
    )
  )
  const pending = $derived(
    table.declarations
      .filter((d) => d.player === me)
      .map((d) => ({ ...d, characterName: nameOf(d.character) }))
  )
  const imDone = $derived(table.done.includes(me))
  const others = $derived(floorBrowsers().filter((b) => b !== me))
  const journal = $derived({ entries: journalEntries })
  const scene = $derived({
    clock: { minute: 0, day: 1, time: '00:10' },
    place: { name: 'The Gilded Stag' },
    present: table.inScene.map((id) => ({ id, name: nameOf(id) })),
    elsewhere: []
  })
</script>

{#if showClaim}
  <main class="mx-auto max-w-4xl space-y-4 p-6">
    <header class="space-y-1">
      <h1 class="font-display text-2xl">Who are you playing?</h1>
      <p class="text-muted">
        The Party of <em>The Harrowmere Letter</em>. Claim the Characters you play on this browser.
        {#if viewer.host}As the Host you can release a Character another browser holds.{/if}
      </p>
    </header>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each party as c (c.id)}
        {@const owner = table.claims[c.id]}
        <li
          class={[
            'flex flex-col gap-2 rounded-panel border bg-surface p-4 shadow-raised',
            owner === me ? 'border-primary ring-2 ring-primary' : 'border-border',
            owner && owner !== me && 'opacity-70'
          ]}
        >
          <div class="flex items-baseline justify-between">
            <span class="font-display text-lg">{c.name}</span>
            {#if owner === me}<Badge variant="success" size="sm">Yours</Badge>
            {:else if owner}<Badge size="sm">Taken</Badge>
            {:else}<Badge variant="info" size="sm">Free</Badge>{/if}
          </div>
          <span class="text-sm text-muted">{c.headline}</span>
          <span class="line-clamp-2 text-sm">{c.details.backstory}</span>
          <div class="mt-auto pt-2">
            {#if owner === me}
              <Button size="sm" variant="secondary" onclick={() => letGo(me, c.id)}>Let go</Button>
            {:else if owner && isHost(me)}
              <Button size="sm" variant="danger" onclick={() => release(c.id)}>Release</Button>
            {:else if owner}
              <span class="text-sm text-muted">Another Player has this Character.</span>
            {:else}
              <Button size="sm" onclick={() => claim(me, c.id)}>Claim</Button>
            {/if}
          </div>
        </li>
      {/each}
      <li
        class="flex items-center justify-center rounded-panel border border-dashed border-border p-4"
      >
        <Button variant="ghost">+ Create a Character</Button>
      </li>
    </ul>
    {#if mine.length > 0}
      <Button onclick={() => (choosing = false)}>Play as {mine.map(nameOf).join(' & ')}</Button>
    {/if}
  </main>
{:else}
  <div class="flex h-[calc(100dvh-5rem)] flex-col gap-2 overflow-hidden p-3">
    <header class="flex shrink-0 items-center gap-3 text-sm">
      <span class="underline">The Harrowmere Letter</span>
      <Badge variant="success" size="sm">DM at the table</Badge>
      <button class="ml-auto underline" onclick={() => (choosing = true)}>Your Characters</button>
      <span class="underline">Journal and Session history</span>
      {#if viewer.host}<Button size="sm" variant="secondary">End Session</Button>{/if}
    </header>
    <main class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_15rem]">
      <CharacterSheet {sheets} acting={acting?.id ?? null} onselect={(id) => (picked = id)} />
      <section class="flex min-h-0 flex-col gap-2">
        <Timeline {entries} awaitingSince={null} />

        <!-- The table: every browser on this Floor, named by its Characters. -->
        <div
          class="flex flex-wrap items-center gap-2 rounded-control border border-border bg-raised px-2 py-1.5 text-sm"
          aria-label="At the table"
        >
          <span class="text-muted">At the table:</span>
          <span
            class={[
              'rounded-full border px-2 py-0.5',
              imDone ? 'border-success text-success' : 'border-primary'
            ]}>You ({mine.map(nameOf).join(' & ')}) · {imDone ? 'Done ✓' : 'deciding'}</span
          >
          {#each others as b (b)}
            {@const isDone = table.done.includes(b)}
            <span
              class={[
                'group inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                isDone ? 'border-success text-success' : 'border-border text-muted'
              ]}
            >
              {browserName(b)} · {isDone ? 'Done ✓' : 'deciding…'}
              {#if viewer.host}
                {#each claimedBy(b) as c (c)}
                  <button
                    class="hidden text-xs text-danger underline group-hover:inline"
                    onclick={() => release(c)}>release {nameOf(c)}</button
                  >
                {/each}
              {/if}
            </span>
          {/each}
          {#each table.inScene.filter((c) => !table.claims[c]) as c (c)}
            <span class="rounded-full border border-dashed border-border px-2 py-0.5 text-muted"
              >{nameOf(c)} · unclaimed, sits out</span
            >
          {/each}
          {#if imDone}
            <button class="ml-auto text-xs underline" onclick={() => undone(me)}
              >Not done yet</button
            >
          {/if}
        </div>

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
      <Rail
        {scene}
        believer={acting?.name ?? 'the Party'}
        entries={acting ? knownBy(journal, acting.id) : []}
        actor={acting?.id}
      />
    </main>
  </div>
{/if}
