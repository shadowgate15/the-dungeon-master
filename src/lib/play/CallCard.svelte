<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import type { OpenCall } from './call'

  /**
   * The open Call at the foot of the timeline: one button group per Character for a Check (the
   * skill or save and the reason, never the DC; advantage marked), or a question with its choices
   * as buttons (free text without). Clicking rolls on the server; nothing is rolled here.
   */
  let {
    call,
    onroll,
    onanswer,
    disabled = false
  }: {
    call: OpenCall
    onroll: (part: string) => void
    onanswer: (part: string, answer: string) => void
    disabled?: boolean
  } = $props()

  let drafts = $state<Record<string, string>>({})
</script>

<section
  aria-label="Call"
  class="flex shrink-0 flex-col gap-2 rounded-panel border-2 border-primary bg-raised p-3 text-sm"
>
  {#if call.kind === 'question'}
    <p class="font-medium">{call.text}</p>
  {/if}
  {#each call.parts as part (part.id)}
    <div
      role="group"
      aria-label={part.character ?? part.player}
      class="flex flex-wrap items-center gap-2"
    >
      {#if call.kind === 'check'}
        <span class="font-medium">{part.character}</span>
        <span>{part.label}</span>
        {#if part.mode !== 'normal'}
          <span class="text-xs font-semibold text-accent uppercase"
            >{part.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}</span
          >
        {/if}
        <span class="text-muted">{part.reason}</span>
        {#if part.answered}
          <span class="ml-auto text-xs text-muted">Rolled</span>
        {:else}
          <Button
            size="sm"
            class="ml-auto"
            aria-label="Roll {part.label} for {part.character}"
            {disabled}
            onclick={() => onroll(part.id)}>🎲 Roll</Button
          >
        {/if}
      {:else if part.answered}
        <span class="text-xs text-muted">Answered</span>
      {:else if call.choices.length}
        {#each call.choices as choice (choice)}
          <Button size="sm" variant="secondary" {disabled} onclick={() => onanswer(part.id, choice)}
            >{choice}</Button
          >
        {/each}
      {:else}
        <form
          class="flex flex-1 gap-2"
          onsubmit={(e) => {
            e.preventDefault()
            const text = (drafts[part.id] ?? '').trim()
            if (text) onanswer(part.id, text)
          }}
        >
          <input
            aria-label="Your answer"
            class="flex-1 rounded-control border border-control-border bg-surface px-2 py-1"
            bind:value={drafts[part.id]}
          />
          <Button size="sm" type="submit" {disabled}>Answer</Button>
        </form>
      {/if}
    </div>
  {/each}
</section>
