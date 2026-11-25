<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Field from '#lib/ui/Field.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import type { PlaySheet } from './sheet'

  /** The details the Player may edit in play, the DM at the table or away. */
  export type EditableDetails = {
    notes: string | null
    personality: string | null
    appearance: string | null
  }

  /**
   * What the Player writes about a Character, on its play sheet. Notes, personality and appearance
   * are editable in play (with the DM away too) when `onsave` is given; the backstory is read-only
   * once play has begun. `onsave` throws the server's refusal.
   */
  let {
    details,
    onsave
  }: {
    details: PlaySheet['details']
    onsave?: (details: EditableDetails) => Promise<void>
  } = $props()

  // The form starts from the sheet; the {#key} around it resets it when the Character changes.
  // svelte-ignore state_referenced_locally
  let notes = $state(details.notes ?? '')
  // svelte-ignore state_referenced_locally
  let personality = $state(details.personality ?? '')
  // svelte-ignore state_referenced_locally
  let appearance = $state(details.appearance ?? '')
  let saving = $state(false)
  let outcome = $state<{ saved: true } | { error: string } | null>(null)

  const orNull = (text: string) => text.trim() || null

  async function save(event: SubmitEvent) {
    event.preventDefault()
    if (!onsave) return
    saving = true
    outcome = null
    try {
      await onsave({
        notes: orNull(notes),
        personality: orNull(personality),
        appearance: orNull(appearance)
      })
      outcome = { saved: true }
    } catch (e) {
      outcome = { error: e instanceof Error ? e.message : 'The details could not be saved' }
    } finally {
      saving = false
    }
  }
</script>

<section aria-labelledby="details-heading" class="flex flex-col gap-2">
  <h3 id="details-heading" class="text-xs font-semibold text-muted uppercase">Details</h3>
  {#if onsave}
    <form class="flex flex-col gap-2" onsubmit={save}>
      <Field label="Notes">
        {#snippet children(id, describedby)}
          <Textarea {id} aria-describedby={describedby} size="sm" rows={3} bind:value={notes} />
        {/snippet}
      </Field>
      <Field label="Personality">
        {#snippet children(id, describedby)}
          <Textarea
            {id}
            aria-describedby={describedby}
            size="sm"
            rows={2}
            bind:value={personality}
          />
        {/snippet}
      </Field>
      <Field label="Appearance">
        {#snippet children(id, describedby)}
          <Textarea
            {id}
            aria-describedby={describedby}
            size="sm"
            rows={2}
            bind:value={appearance}
          />
        {/snippet}
      </Field>
      <div class="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm" disabled={saving}>Save details</Button>
        {#if outcome && 'saved' in outcome}
          <p role="status" class="text-xs text-muted">Saved</p>
        {:else if outcome}
          <p role="alert" class="text-xs text-danger">{outcome.error}</p>
        {/if}
      </div>
    </form>
  {:else}
    {#each [['Notes', details.notes], ['Personality', details.personality], ['Appearance', details.appearance]] as [label, text] (label)}
      {#if text}<p><span class="text-muted">{label}:</span> {text}</p>{/if}
    {/each}
  {/if}
  {#if details.backstory}
    <div>
      <p class="text-xs text-muted">Backstory</p>
      <p class="whitespace-pre-line">{details.backstory}</p>
    </div>
  {/if}
</section>
