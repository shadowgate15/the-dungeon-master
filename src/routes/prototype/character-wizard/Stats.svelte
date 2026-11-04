<!-- PROTOTYPE (throwaway): computed-stats preview in three densities. Nothing here is stored. -->
<script lang="ts">
  import { ABILITIES, fmt, type Wizard } from './model.svelte.ts'

  let { w, mode }: { w: Wizard; mode: 'strip' | 'sheet' | 'chips' } = $props()
  const s = $derived(w.stats)
  const dash = (n: number | null) => (n === null ? '—' : String(n))
</script>

{#if mode === 'chips'}
  <div class="flex flex-wrap gap-2 text-xs" aria-label="Computed stats">
    {#each [['HP', dash(s.hp)], ['AC', dash(s.ac)], ['Init', fmt(s.init)], ['Prof', fmt(s.prof)], ...(s.spellDc ? [['DC', String(s.spellDc)]] : [])] as [k, v] (k)}
      <span class="rounded-full border border-border bg-raised px-2 py-0.5"
        ><span class="text-muted">{k}</span> <strong>{v}</strong></span
      >
    {/each}
  </div>
{:else if mode === 'strip'}
  <div class="grid grid-cols-6 gap-2 text-center text-xs" aria-label="Computed stats">
    {#each ABILITIES as a (a)}
      <div class="rounded-control border border-border bg-raised p-1.5">
        <div class="text-muted">{a}</div>
        <div class="text-base font-semibold">{w.score(a) ?? '—'}</div>
        <div>{w.score(a) === null ? '' : fmt(s.mods[a])}</div>
      </div>
    {/each}
    <div class="col-span-2 rounded-control border border-border bg-raised p-1.5">
      <span class="text-muted">HP</span> <strong>{dash(s.hp)}</strong>
    </div>
    <div class="col-span-2 rounded-control border border-border bg-raised p-1.5">
      <span class="text-muted">AC</span> <strong>{dash(s.ac)}</strong>
    </div>
    <div class="col-span-2 rounded-control border border-border bg-raised p-1.5">
      <span class="text-muted">Speed</span> <strong>{s.speed}</strong>
    </div>
  </div>
{:else}
  <div class="space-y-3 text-sm" aria-label="Character sheet preview">
    <div>
      <div class="font-display text-lg">{w.name || 'Unnamed hero'}</div>
      <div class="text-muted">
        {[w.subrace || w.race, w.cls].filter(Boolean).join(' ') ||
          'Race and class not chosen'}{w.background ? ` · ${w.background}` : ''}
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center">
      {#each [['HP', dash(s.hp)], ['AC', dash(s.ac)], ['Init', fmt(s.init)], ['Speed', String(s.speed)], ['Prof', fmt(s.prof)], ['Hit die', w.cl ? `d${w.cl.hitDie}` : '—']] as [k, v] (k)}
        <div class="rounded-control border border-border bg-raised p-1.5">
          <div class="text-xs text-muted">{k}</div>
          <strong>{v}</strong>
        </div>
      {/each}
    </div>
    <table class="w-full">
      <tbody>
        {#each ABILITIES as a (a)}
          {@const save = s.saves.find((x) => x.a === a)}
          <tr class="border-t border-border"
            ><th class="py-1 text-left">{a}</th><td class="font-semibold">{w.score(a) ?? '—'}</td
            ><td>{w.score(a) === null ? '' : fmt(s.mods[a])}</td>
            <td class="text-right text-muted"
              >save {fmt(save?.v ?? 0)}{save?.proficient ? ' ●' : ''}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
    {#if w.cls}
      <div>
        <span class="text-muted">Proficient skills</span><br />{s.skillMods
          .map((k) => `${k.s} ${fmt(k.v)}`)
          .join(', ')}
      </div>
    {/if}
    {#if s.spellDc}
      <div>
        <span class="text-muted">Spellcasting</span><br />Save DC {s.spellDc} · Attack {fmt(
          s.spellAtk ?? 0
        )} · {s.slots} level-1 slots
      </div>
    {/if}
  </div>
{/if}
