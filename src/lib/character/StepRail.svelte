<script lang="ts" module>
  import type { StepId, StepStatus } from './steps.ts'

  export interface RailStep {
    id: StepId
    label: string
    status: StepStatus
    /** Why the step is not valid; shown as the tooltip. */
    issues?: string[]
    /** Pending AI suggestions for this step; any number above zero shows a dot. */
    suggestions?: number
  }

  export const STATUS_LABEL: Record<StepStatus, string> = {
    locked: 'locked',
    incomplete: 'incomplete',
    attention: 'needs attention',
    valid: 'valid'
  }
</script>

<script lang="ts">
  import Button from '#lib/ui/Button.svelte'

  type Props = {
    steps: RailStep[]
    current: StepId
    onselect: (id: StepId) => void
    onabandon: () => void
  }

  let { steps, current, onselect, onabandon }: Props = $props()
</script>

<nav aria-label="Steps" class="space-y-1">
  <h1 class="font-display text-xl">New Character</h1>
  <ol class="space-y-1">
    {#each steps as step, i (step.id)}
      <li>
        <button
          type="button"
          disabled={step.status === 'locked'}
          aria-current={current === step.id ? 'step' : undefined}
          title={step.issues?.join(' ') || undefined}
          class={[
            'flex w-full items-center gap-2 rounded-control border px-3 py-2 text-left text-sm',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            'disabled:cursor-not-allowed disabled:opacity-50',
            current === step.id
              ? 'border-primary bg-raised font-semibold'
              : 'border-transparent hover:bg-raised'
          ]}
          onclick={() => onselect(step.id)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            class={[
              'h-4 w-4 shrink-0 fill-none stroke-current stroke-2',
              step.status === 'attention' && 'text-warning',
              step.status === 'valid' && 'text-success'
            ]}
          >
            {#if step.status === 'locked'}
              <rect x="3" y="7" width="10" height="7" rx="1" />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" />
            {:else if step.status === 'valid'}
              <path d="M3 8.5l3.5 3.5L13 4.5" />
            {:else if step.status === 'attention'}
              <path d="M8 2l6.5 12h-13z" />
              <path d="M8 6.5v3.5M8 12v.01" />
            {:else}
              <circle cx="8" cy="8" r="5" />
            {/if}
          </svg>
          <span>{i + 1}. {step.label}</span>
          <span class="sr-only">, {STATUS_LABEL[step.status]}</span>
          {#if step.suggestions}
            <span
              data-testid="suggestion-dot"
              class="ml-auto inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              title="AI has suggestions"
            ></span>
            <span class="sr-only">, AI has suggestions</span>
          {/if}
        </button>
      </li>
    {/each}
  </ol>
  <Button variant="ghost" size="sm" class="mt-3" onclick={onabandon}>Abandon</Button>
</nav>
