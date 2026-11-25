<script lang="ts">
  import type { SessionSummary } from './sessions'

  /** The Player's read-only Session history, newest first. Summaries are never editable. */
  let { sessions }: { sessions: SessionSummary[] } = $props()

  /** An in-fiction clock minute: minute 0 is day 1, 08:00. */
  function clock(minute: number): string {
    const total = minute + 8 * 60
    const day = Math.floor(total / 1440) + 1
    const time = total % 1440
    const pad = (n: number) => String(n).padStart(2, '0')
    return `day ${day}, ${pad(Math.floor(time / 60))}:${pad(time % 60)}`
  }

  function span({ from, to }: { from: number; to: number }): string {
    return from === to ? clock(from) : `${clock(from)} – ${clock(to)}`
  }

  const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
</script>

{#if sessions.length === 0}
  <p class="text-sm text-muted">No Session has closed yet.</p>
{:else}
  <div class="flex flex-col gap-3">
    {#each sessions as s (s.number)}
      <article
        aria-labelledby="session-{s.number}"
        class="rounded-panel border border-border bg-surface p-3 text-sm"
      >
        <header class="mb-1 flex flex-wrap items-baseline gap-x-3">
          <h3 id="session-{s.number}" class="font-semibold">Session {s.number}</h3>
          <span class="text-xs text-muted">{date.format(s.startedAt)}</span>
          {#if s.span}<span class="text-xs text-muted">{span(s.span)}</span>{/if}
        </header>
        <p class="whitespace-pre-wrap">{s.summary}</p>
        {#if s.threads.length}
          <h4 class="mt-2 text-xs font-semibold text-muted uppercase">Open threads</h4>
          <ul class="list-disc pl-5">
            {#each s.threads as thread, i (i)}<li>{thread}</li>{/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
{/if}
