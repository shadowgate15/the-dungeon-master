<script lang="ts" module>
  export const CREATION_STEPS = ['Seed', 'Party', 'Begin'] as const
  export type CreationStep = (typeof CREATION_STEPS)[number]
</script>

<script lang="ts">
  type Props = {
    current: CreationStep
    /** Already-resolved paths of the steps that can be opened. */
    hrefs?: Partial<Record<CreationStep, string>>
    /** Steps that cannot be opened yet. */
    unavailable?: CreationStep[]
  }

  let { current, hrefs = {}, unavailable = [] }: Props = $props()

  const linked = (step: CreationStep) => (!unavailable.includes(step) ? hrefs[step] : undefined)
</script>

<nav aria-label="Campaign creation">
  <ol class="flex gap-2">
    {#each CREATION_STEPS as step, i (step)}
      {@const href = linked(step)}
      {@const classes = [
        'flex items-center gap-2 rounded-control border px-3 py-1.5 text-sm',
        current === step ? 'border-primary bg-raised font-semibold' : 'border-border text-muted',
        unavailable.includes(step) && 'opacity-50',
        href && 'hover:border-primary'
      ]}
      <li>
        {#if href}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller resolved it -->
          <a {href} class={classes} aria-current={current === step ? 'step' : undefined}>
            <span aria-hidden="true">{i + 1}.</span>
            {step}
          </a>
        {:else}
          <span class={classes} aria-current={current === step ? 'step' : undefined}>
            <span aria-hidden="true">{i + 1}.</span>
            {step}
            {#if unavailable.includes(step)}<span class="sr-only">(not available yet)</span>{/if}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
