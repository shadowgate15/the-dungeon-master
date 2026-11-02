<script lang="ts">
  import { resolve } from '$app/paths'

  let { current }: { current: 'worlds' | 'campaigns' } = $props()

  const links = [
    { key: 'worlds', label: 'Worlds', href: () => resolve('/') },
    { key: 'campaigns', label: 'Campaigns', href: () => resolve('/campaigns') }
  ] as const
</script>

<nav aria-label="Sections" class="flex gap-4 border-b text-sm">
  {#each links as link (link.key)}
    <a
      href={link.href()}
      aria-current={current === link.key ? 'page' : undefined}
      class="pb-2 {current === link.key
        ? 'border-b-2 border-slate-800 font-medium'
        : 'text-slate-500'}">{link.label}</a
    >
  {/each}
</nav>
