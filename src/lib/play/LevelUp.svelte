<script lang="ts">
  import type { LevelUpOffer } from '#lib/character/level-up.ts'
  import Button from '#lib/ui/Button.svelte'
  import Checkbox from '#lib/ui/Checkbox.svelte'

  /**
   * The level the DM awarded, taken by the Player: a "Level up" button that opens the new spells to
   * pick (exactly the offer's counts), then sends them. HP, slots and features follow on the server.
   */
  let {
    offer,
    disabled = false,
    onlevelup
  }: {
    offer: LevelUpOffer
    disabled?: boolean
    onlevelup: (picks: { cantrips: string[]; spells: string[] }) => void
  } = $props()

  let open = $state(false)
  let picked = $state<{ cantrips: string[]; spells: string[] }>({ cantrips: [], spells: [] })
  const kinds = [
    { key: 'cantrips', label: 'Cantrips' },
    { key: 'spells', label: 'Spells' }
  ] as const
  const ready = $derived(
    picked.cantrips.length === offer.cantrips.count && picked.spells.length === offer.spells.count
  )

  function toggle(kind: 'cantrips' | 'spells', slug: string, on: boolean) {
    const rest = picked[kind].filter((s) => s !== slug)
    picked[kind] = on ? [...rest, slug] : rest
  }
</script>

<section aria-label="Level up" class="rounded-control border border-primary p-2">
  {#if !open}
    <Button size="sm" {disabled} onclick={() => (open = true)}>Level up to {offer.level}</Button>
  {:else}
    <h3 class="text-xs font-semibold text-muted uppercase">Level {offer.level}</h3>
    {#each kinds as { key, label } (key)}
      {#if offer[key].count > 0}
        <fieldset class="mt-2">
          <legend class="text-xs"
            >{label}: pick {offer[key].count} ({picked[key].length} picked)</legend
          >
          <ul class="max-h-48 overflow-y-auto">
            {#each offer[key].options as o (o.slug)}
              {@const on = picked[key].includes(o.slug)}
              <li>
                <label class="flex items-center gap-2">
                  <Checkbox
                    checked={on}
                    disabled={!on && picked[key].length >= offer[key].count}
                    onchange={(e) => toggle(key, o.slug, e.currentTarget.checked)}
                  />{o.name}</label
                >
              </li>
            {/each}
          </ul>
        </fieldset>
      {/if}
    {/each}
    <div class="mt-2 flex gap-2">
      <Button
        size="sm"
        disabled={!ready || disabled}
        onclick={() =>
          onlevelup({ cantrips: [...picked.cantrips].sort(), spells: [...picked.spells].sort() })}
        >Take level {offer.level}</Button
      >
      <Button size="sm" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    </div>
  {/if}
</section>
