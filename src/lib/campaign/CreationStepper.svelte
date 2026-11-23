<script lang="ts" module>
  export const CREATION_STEPS = ['Seed', 'Party', 'Begin'] as const
  export type CreationStep = (typeof CREATION_STEPS)[number]
</script>

<script lang="ts">
  type Props = {
    current: CreationStep
    /** Steps that cannot be opened yet. */
    unavailable?: CreationStep[]
  }

  let { current, unavailable = [] }: Props = $props()
</script>

<nav aria-label="Campaign creation">
  <ol class="flex gap-2">
    {#each CREATION_STEPS as step, i (step)}
      <li
        aria-current={current === step ? 'step' : undefined}
        class={[
          'flex items-center gap-2 rounded-control border px-3 py-1.5 text-sm',
          current === step ? 'border-primary bg-raised font-semibold' : 'border-border text-muted',
          unavailable.includes(step) && 'opacity-50'
        ]}
      >
        <span aria-hidden="true">{i + 1}.</span>
        {step}
        {#if unavailable.includes(step)}<span class="sr-only">(not available yet)</span>{/if}
      </li>
    {/each}
  </ol>
</nav>
