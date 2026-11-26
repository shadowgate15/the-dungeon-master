<script lang="ts">
  /* eslint-disable -- PROTOTYPE, throwaway */
  // PROTOTYPE variant B, "Roster". Claiming is a dialog over the (empty) console, so arriving looks
  // like sitting down at the table. The right rail opens with an "At the table" card: one row per
  // Party Character with who holds it (you / another Player / free), its Floor state, and the
  // Host's Release. The open Floor shows everyone's Declarations (others' read-only), and every
  // entry not addressed to the whole Scene says who it went to.
  import CharacterSheet from '#lib/play/CharacterSheet.svelte'
  import Rail from '#lib/play/Rail.svelte'
  import { journalEntries } from '#lib/play/play-fixtures.ts'
  import { knownBy } from '#lib/play/journal.ts'
  import Badge from '#lib/ui/Badge.svelte'
  import Button from '#lib/ui/Button.svelte'
  import {
    audienceLabel,
    claim,
    claimedBy,
    done,
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
  const dialog = $derived(choosing || mine.length === 0)

  let picked = $state<string | null>(null)
  const sheets = $derived(ownSheets(me))
  const acting = $derived(
    sheets.find((s) => s.id === picked) ?? sheets.find((s) => s.canAct) ?? null
  )
  let draft = $state('')
  const imDone = $derived(table.done.includes(me))
  const scene = $derived({
    clock: { minute: 0, day: 1, time: '00:10' },
    place: { name: 'The Gilded Stag' },
    present: table.inScene.map((id) => ({ id, name: nameOf(id) })),
    elsewhere: []
  })
</script>

<div class="flex h-[calc(100dvh-5rem)] flex-col gap-2 overflow-hidden p-3">
  <header class="flex shrink-0 items-center gap-3 text-sm">
    <span class="underline">The Harrowmere Letter</span>
    <Badge variant="success" size="sm">DM at the table</Badge>
    <span class="ml-auto underline">Journal and Session history</span>
    {#if viewer.host}<Button size="sm" variant="secondary">End Session</Button>{/if}
  </header>
  <main class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[20rem_minmax(0,1fr)_17rem]">
    {#if sheets.length}
      <CharacterSheet {sheets} acting={acting?.id ?? null} onselect={(id) => (picked = id)} />
    {:else}
      <div class="rounded-panel border border-dashed border-border"></div>
    {/if}

    <section class="flex min-h-0 flex-col gap-2">
      <ol
        class="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-panel border border-border bg-surface p-3"
      >
        {#each visibleTo(me) as e (e.id)}
          {@const to = audienceLabel(e)}
          <li class={[e.type === 'declaration' && 'text-right']}>
            {#if to}
              <div class="mb-0.5 text-xs font-medium text-accent">🔒 to {to}</div>
            {/if}
            {#if e.type === 'narration'}
              <p class={[to && 'border-l-2 border-accent pl-2']}>
                {#if e.voice}<strong>{e.voice}:</strong>{/if}
                {e.text}
              </p>
            {:else if e.type === 'declaration'}
              <p class="inline-block rounded-control bg-raised px-2 py-1">
                <strong>{nameOf(e.character)}</strong>: {e.text}
              </p>
            {:else}
              <p class="text-sm text-muted">⚙ {e.text}</p>
            {/if}
          </li>
        {/each}
      </ol>

      <!-- The open Floor: everyone's Declarations, your own editable. -->
      <div class="space-y-2 rounded-panel border border-border bg-surface p-3">
        <div class="text-xs text-muted uppercase">On the Floor</div>
        <ul class="space-y-1 text-sm">
          {#each mine.length ? table.declarations : [] as d (d.id)}
            <li class="flex items-center gap-2">
              <strong>{nameOf(d.character)}</strong>
              <span class="flex-1">{d.text}</span>
              {#if d.player === me && !imDone}
                <button class="text-xs underline" onclick={() => withdraw(d.id)}>withdraw</button>
              {:else if d.player !== me}
                <span class="text-xs text-muted">another Player</span>
              {/if}
            </li>
          {:else}
            <li class="text-muted">Nothing declared yet.</li>
          {/each}
        </ul>
        <div class="flex gap-2">
          <textarea
            class="min-h-10 flex-1 rounded-control border border-control-border bg-raised p-2 text-sm"
            placeholder={acting ? `What does ${acting.name} do?` : 'Claim a Character to play'}
            disabled={!acting || imDone}
            bind:value={draft}></textarea>
          <div class="flex flex-col gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={!acting || imDone}
              onclick={() => {
                if (acting) send(me, acting.id, draft)
                draft = ''
              }}>Send</Button
            >
            {#if imDone}
              <Button size="sm" variant="ghost" onclick={() => undone(me)}>Not done</Button>
            {:else}
              <Button size="sm" disabled={!acting} onclick={() => done(me)}>Done</Button>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <section class="space-y-2 rounded-panel border border-border bg-surface p-3 shadow-raised">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display">At the table</h2>
          <button class="text-xs underline" onclick={() => (choosing = true)}
            >Your Characters</button
          >
        </div>
        <ul class="space-y-1 text-sm">
          {#each party as c (c.id)}
            {@const owner = table.claims[c.id]}
            {@const inScene = table.inScene.includes(c.id)}
            <li class="flex items-center gap-2">
              <span class={['flex-1', owner === me && 'font-semibold']}>{c.name}</span>
              {#if owner === me}
                <Badge variant="success" size="sm">you</Badge>
              {:else if owner}
                <Badge size="sm">Player</Badge>
              {:else}
                <Badge variant="warning" size="sm">free</Badge>
              {/if}
              <span class="w-14 text-right text-xs">
                {#if !owner || !inScene}<span class="text-muted">—</span>
                {:else if table.done.includes(owner)}<span class="text-success">Done ✓</span>
                {:else}<span class="text-muted">…</span>{/if}
              </span>
              {#if isHost(me) && owner && owner !== me}
                <button class="text-xs text-danger underline" onclick={() => release(c.id)}
                  >Release</button
                >
              {/if}
            </li>
          {/each}
        </ul>
        <p class="text-xs text-muted">Done is per Player: Bram & Kael are Done together.</p>
      </section>
      <Rail
        {scene}
        believer={acting?.name ?? 'the Party'}
        entries={acting ? knownBy({ entries: journalEntries }, acting.id) : []}
        actor={acting?.id}
      />
    </aside>
  </main>
</div>

{#if dialog}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div
      class="w-full max-w-md space-y-3 rounded-panel border border-border bg-surface p-5 shadow-2xl"
    >
      <h2 class="font-display text-xl">Take a seat</h2>
      <p class="text-sm text-muted">
        Pick who you play on this browser. You can pick more than one.
      </p>
      <ul class="divide-y divide-border">
        {#each party as c (c.id)}
          {@const owner = table.claims[c.id]}
          <li class="flex items-center gap-3 py-2">
            <div class="flex-1">
              <div class="font-medium">{c.name}</div>
              <div class="text-xs text-muted">{c.headline}</div>
            </div>
            {#if owner === me}
              <Button size="sm" variant="secondary" onclick={() => letGo(me, c.id)}>Let go</Button>
            {:else if owner && isHost(me)}
              <span class="text-xs text-muted">taken</span>
              <Button size="sm" variant="danger" onclick={() => release(c.id)}>Release</Button>
            {:else if owner}
              <span class="text-xs text-muted">taken</span>
            {:else}
              <Button size="sm" onclick={() => claim(me, c.id)}>Claim</Button>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="flex justify-between">
        <Button size="sm" variant="ghost">+ Create a Character</Button>
        <Button size="sm" disabled={mine.length === 0} onclick={() => (choosing = false)}
          >Sit down</Button
        >
      </div>
    </div>
  </div>
{/if}
