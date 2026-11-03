<script lang="ts">
  import { resolve } from '$app/paths'

  let { current }: { current: 'worlds' | 'campaigns' } = $props()

  const links = [
    { key: 'worlds', label: 'Worlds', href: () => resolve('/') },
    { key: 'campaigns', label: 'Campaigns', href: () => resolve('/campaigns') }
  ] as const
</script>

<nav aria-label="Sections" class="flex gap-4 border-b border-border text-sm">
  {#each links as link (link.key)}
    <a
      href={link.href()}
      aria-current={current === link.key ? 'page' : undefined}
      class={[
        '-mb-px rounded-t-sm border-b-2 px-1 pb-2 no-underline',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        current === link.key
          ? 'border-primary font-medium text-text'
          : 'border-transparent text-muted hover:text-text'
      ]}>{link.label}</a
    >
  {/each}
</nav>
