<script lang="ts">
  import Badge from '#lib/ui/Badge.svelte'
  import Meter from '#lib/ui/Meter.svelte'
  import LevelUp from './LevelUp.svelte'
  import CharacterDetails, { type EditableDetails } from './CharacterDetails.svelte'
  import type { PlaySheet } from './sheet'

  /**
   * The console's left column: one tab per Character, and the selected tab's full sheet. The
   * selected tab is the acting Character; only Characters who can act are selectable. A pure view
   * of the server's `PlaySheet`s. A level the DM awarded shows a Level up control when `onlevelup`
   * is given. With `onsavedetails`, the Player edits the Character's notes, personality and
   * appearance (with the DM away too); the backstory stays read-only.
   */
  let {
    sheets,
    acting,
    onselect = () => {},
    onlevelup,
    onsavedetails
  }: {
    sheets: PlaySheet[]
    acting: string | null
    onselect?: (id: string) => void
    onlevelup?: (id: string, picks: { cantrips: string[]; spells: string[] }) => void
    onsavedetails?: (id: string, details: EditableDetails) => Promise<void>
  } = $props()

  const shown = $derived(sheets.find((s) => s.id === acting) ?? sheets[0])
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  const DENOMINATIONS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const
  const coinText = (coin: PlaySheet['coin']) =>
    DENOMINATIONS.filter((d) => coin[d] > 0)
      .map((d) => `${coin[d]} ${d}`)
      .join(', ') || 'None'
  const title = (slug: string) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
</script>

<aside
  aria-label="Character sheet"
  class="flex min-h-0 flex-col overflow-y-auto rounded-panel border border-border bg-surface"
>
  <div role="tablist" aria-label="Acting Character" class="flex border-b border-border">
    {#each sheets as s (s.id)}
      <button
        role="tab"
        id="sheet-tab-{s.id}"
        aria-selected={s.id === shown?.id}
        aria-controls="sheet-{s.id}"
        disabled={!s.canAct}
        class={[
          'flex-1 px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
          s.id === shown?.id && 'bg-raised font-semibold',
          s.whereabouts && 'text-muted'
        ]}
        onclick={() => onselect(s.id)}
        >{s.name}{#if s.whereabouts}<span class="block text-[10px]">{s.whereabouts}</span
          >{/if}</button
      >
    {/each}
  </div>

  {#if shown}
    <div
      role="tabpanel"
      id="sheet-{shown.id}"
      aria-labelledby="sheet-tab-{shown.id}"
      aria-label={shown.name}
      class="flex flex-col gap-3 p-3 text-sm"
    >
      <div>
        <h2 class="font-display text-xl">{shown.name}</h2>
        <p class="text-muted">{shown.headline}</p>
      </div>

      {#if shown.levelUp && onlevelup}
        {#key shown.id}
          <LevelUp offer={shown.levelUp} onlevelup={(picks) => onlevelup(shown.id, picks)} />
        {/key}
      {/if}

      <div class="grid grid-cols-[1fr_auto] items-end gap-3">
        <div role="group" aria-label="HP">
          <div class="flex justify-between text-xs">
            <span>HP</span>
            <span
              >{shown.hp.current} / {shown.hp.max ?? '—'}{#if shown.hp.temp}
                <span class="text-muted">+{shown.hp.temp} temp</span>{/if}</span
            >
          </div>
          {#if shown.hp.max}
            <Meter
              label="HP"
              used={shown.hp.current}
              limit={shown.hp.max}
              warn={shown.hp.current / shown.hp.max < 0.5}
            />
          {/if}
        </div>
        <div
          role="group"
          aria-label="AC"
          title={shown.ac ? `AC (${shown.ac.note})` : 'AC pending'}
          class="rounded-control border border-border bg-raised px-2 py-1 text-center"
        >
          <div class="text-[10px] text-muted">AC</div>
          <div class="text-lg font-semibold">{shown.ac?.value ?? '—'}</div>
        </div>
      </div>

      {#if shown.hitDice}
        <p role="group" aria-label="Hit Dice" class="flex justify-between">
          <span>Hit Dice</span><span
            >{shown.hitDice.total - shown.hitDice.spent} / {shown.hitDice.total} d{shown.hitDice
              .die}</span
          >
        </p>
      {/if}

      {#if shown.deathSaves}
        {@const { successes, failures, stable } = shown.deathSaves}
        <div role="group" aria-label="Death saves" class="flex justify-between text-xs">
          <span class="font-medium">Death saves</span>
          {#if stable}
            <span>Stable</span>
          {:else}
            <span>Successes {successes} / 3</span>
            <span class="text-danger">Failures {failures} / 3</span>
          {/if}
        </div>
      {/if}

      {#if shown.conditions.length || shown.concentration}
        <div class="flex flex-wrap gap-1">
          {#each shown.conditions as c (c)}<Badge variant="danger" size="sm">{title(c)}</Badge
            >{/each}
          {#if shown.concentration}<Badge variant="info" size="sm"
              >Concentrating: {title(shown.concentration)}</Badge
            >{/if}
        </div>
      {/if}

      <div class="grid grid-cols-3 gap-1 text-center">
        {#each shown.abilities as a (a.key)}
          <div
            role="group"
            aria-label={a.key.toUpperCase()}
            class="rounded-control border border-border py-1"
          >
            <div class="text-[10px] text-muted uppercase">{a.key}</div>
            <div class="text-lg">{signed(a.modifier)}</div>
            <div class="text-[10px] text-muted">{a.score}</div>
          </div>
        {/each}
      </div>

      <section>
        <h3 class="text-xs font-semibold text-muted uppercase">Attacks</h3>
        {#each shown.attacks as a (a.name)}
          <p class="flex justify-between gap-2">
            <span>{a.name}</span><span class="font-mono"
              >{signed(a.attackBonus)}{a.damage ? ` · ${a.damage}` : ''}</span
            >
          </p>
        {:else}<p class="text-muted">None</p>{/each}
      </section>

      {#if shown.spellSlots.length}
        <section>
          <h3 class="text-xs font-semibold text-muted uppercase">Spell slots</h3>
          {#each shown.spellSlots as s (s.level)}
            <p role="group" aria-label="Level {s.level} slots" class="flex justify-between">
              <span>Level {s.level}</span><span>{s.max - s.spent} / {s.max}</span>
            </p>
          {/each}
        </section>
      {/if}

      {#if shown.features.length}
        <section>
          <h3 class="text-xs font-semibold text-muted uppercase">Features</h3>
          <ul>
            {#each shown.features as f (f.slug)}
              <li>{f.name}{f.spent ? ` · ${f.spent} used` : ''}</li>
            {/each}
          </ul>
        </section>
      {/if}

      <section>
        <h3 class="text-xs font-semibold text-muted uppercase">Inventory</h3>
        <ul>
          {#each shown.inventory as i (i.name)}
            <li>
              {i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ''}{i.equipped ? ' (equipped)' : ''}
            </li>
          {:else}<li class="text-muted">Nothing carried</li>{/each}
        </ul>
        <p role="group" aria-label="Coin" class="mt-1 flex justify-between">
          <span class="text-muted">Coin</span><span>{coinText(shown.coin)}</span>
        </p>
      </section>

      {#key shown.id}
        <CharacterDetails
          details={shown.details}
          onsave={onsavedetails && ((details) => onsavedetails(shown.id, details))}
        />
      {/key}
    </div>
  {:else}
    <p class="p-3 text-sm text-muted">No Characters in the Party yet.</p>
  {/if}
</aside>
