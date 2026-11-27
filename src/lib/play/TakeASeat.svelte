<script lang="ts">
  import Alert from '#lib/ui/Alert.svelte'
  import Button from '#lib/ui/Button.svelte'
  import Dialog from '#lib/ui/Dialog.svelte'
  import type { ClaimRow } from './claims'

  type Props = {
    open: boolean
    rows: ClaimRow[]
    /** Where "Create a Character" goes: the Party wizard. */
    createHref: string
    closeHref: string
    problem?: string | null
    onclaim: (id: string) => void
    onletgo: (id: string) => void
    /** Whether a DM is at the table: Depart needs a live Session. */
    attended?: boolean
    ondepart?: (id: string) => void
    onrejoin?: (id: string) => void
    /** Host only: frees a taken Character. */
    onrelease?: (id: string) => void
  }

  let {
    open = $bindable(),
    rows,
    createHref,
    closeHref,
    problem = null,
    onclaim,
    onletgo,
    attended = true,
    ondepart,
    onrejoin,
    onrelease
  }: Props = $props()

  const seated = $derived(rows.some((r) => r.claim === 'yours'))
</script>

<Dialog
  bind:open
  title="Take a seat"
  {closeHref}
  class="max-w-lg"
  oncancel={(e) => !seated && e.preventDefault()}
>
  <p class="text-text-muted mb-3 text-sm">Claim the Characters you play, then sit down.</p>
  <ul class="mb-4 flex flex-col gap-2" aria-label="Party">
    {#each rows as row (row.id)}
      <li class="flex items-center justify-between gap-3 rounded-panel border border-border p-2">
        <span>{row.name}</span>
        {#if row.claim === 'yours'}
          <span class="flex items-center gap-2">
            {#if ondepart}
              <Button
                size="sm"
                variant="secondary"
                disabled={!attended}
                title={attended
                  ? undefined
                  : 'Depart needs a live Session: run dm in the Campaign folder'}
                onclick={() => ondepart(row.id)}>Depart</Button
              >
            {/if}
            <Button size="sm" variant="secondary" onclick={() => onletgo(row.id)}>Let go</Button>
          </span>
        {:else if row.departed && row.claim === 'free'}
          <Button size="sm" onclick={() => onrejoin?.(row.id)}>Rejoin</Button>
        {:else if row.claim === 'free'}
          <Button size="sm" onclick={() => onclaim(row.id)}>Claim</Button>
        {:else}
          <span class="flex items-center gap-2">
            <span class="text-text-muted text-sm">taken</span>
            {#if row.releasable && onrelease}
              <Button size="sm" variant="secondary" onclick={() => onrelease(row.id)}
                >Release</Button
              >
            {/if}
          </span>
        {/if}
      </li>
    {:else}
      <li class="text-text-muted text-sm">The Party has no Characters yet.</li>
    {/each}
  </ul>
  {#if problem}<Alert variant="danger">{problem}</Alert>{/if}
  <div class="flex items-center justify-between gap-3">
    <Button variant="secondary" href={createHref}>Create a Character</Button>
    <Button disabled={!seated} onclick={() => (open = false)}>Sit down</Button>
  </div>
</Dialog>
