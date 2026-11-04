<script lang="ts">
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Credits</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
  <h1 class="text-2xl font-semibold">Credits</h1>

  <section class="flex flex-col gap-2">
    <h2 class="text-lg font-semibold">D&amp;D 5e System Reference Document</h2>
    <p data-testid="srd-attribution">{data.attribution}</p>
  </section>

  <section class="flex flex-col gap-2">
    <h2 class="text-lg font-semibold">Rules data</h2>
    {#if data.dataset}
      <p data-testid="dataset-version">
        Rules data version {data.dataset.version} (SRD {data.dataset.srdVersion}), from
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="underline" href={data.dataset.repository}>{data.dataset.repository}</a>
        at tag {data.dataset.tag}.
      </p>
    {:else}
      <p>The rules data has not been loaded.</p>
    {/if}
    <details>
      <summary class="cursor-pointer">MIT licence of the rules data</summary>
      <pre class="mt-2 text-sm whitespace-pre-wrap">{data.mitNotice}</pre>
    </details>
  </section>
</main>
