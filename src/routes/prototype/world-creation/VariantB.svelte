<script lang="ts">
  // Variant B: wizard. Steps group fields; each step has "Suggest for this step"; final review before Create.
  import { LABELS, OPTIONS, emptySeed, suggestField, draftSeed, type Field, type Seed } from './stub'
  const steps: { title: string; blurb: string; fields: Field[] }[] = [
    { title: 'Identity', blurb: 'What is this world called, and what is it about?', fields: ['name', 'premise'] },
    { title: 'Flavor', blurb: 'Genre and size.', fields: ['genre', 'scale'] },
    { title: 'Power', blurb: 'How magical, how technological.', fields: ['magic', 'tech'] },
    { title: 'Review', blurb: 'Check the seed, then create.', fields: [] }
  ]
  let step = $state(0)
  let seed = $state<Seed>(emptySeed())
  let pending = $state<Partial<Seed>>({})
  let busy = $state(false)
  let created = $state(false)
  const cur = $derived(steps[step])

  async function suggestStep() {
    busy = true
    for (const f of cur.fields) pending[f] = await suggestField(f, seed)
    busy = false
  }
  async function surprise() {
    busy = true
    pending = await draftSeed('')
    busy = false
    step = 3
  }
  function acceptAll() {
    for (const f of Object.keys(pending) as Field[]) seed[f] = pending[f]!
    pending = {}
  }
</script>

<h1 class="text-2xl font-bold">New World <span class="text-sm font-normal text-gray-500">(B: wizard)</span></h1>

<ol class="mt-4 flex gap-2 text-sm">
  {#each steps as s, i}
    <li class="flex-1 rounded px-3 py-2 {i === step ? 'bg-black text-white' : i < step ? 'bg-gray-200' : 'bg-gray-100 text-gray-500'}">{i + 1}. {s.title}</li>
  {/each}
</ol>

<div class="mt-6 max-w-xl">
  <p class="text-gray-600">{cur.blurb}</p>

  {#each cur.fields as f}
    <div class="mt-4">
      <label for="b-{f}" class="font-medium">{LABELS[f]}</label>
      {#if f === 'premise'}
        <textarea id="b-{f}" rows="4" maxlength="500" class="mt-1 w-full rounded border p-2" bind:value={seed[f]}></textarea>
      {:else if f === 'name'}
        <input id="b-{f}" class="mt-1 w-full rounded border p-2" bind:value={seed[f]} />
      {:else}
        <select id="b-{f}" class="mt-1 w-full rounded border p-2" bind:value={seed[f]}>
          <option value="">Unspecified</option>
          {#each OPTIONS[f] as o}<option>{o}</option>{/each}
        </select>
      {/if}
      {#if pending[f] !== undefined}
        <div class="mt-1 flex items-center gap-2 rounded bg-violet-50 p-2 text-sm">
          <span class="flex-1">✨ {pending[f]}</span>
          <button class="rounded bg-green-600 px-2 text-white" onclick={() => { seed[f] = pending[f]!; delete pending[f] }}>Accept</button>
          <button class="rounded border px-2" onclick={() => delete pending[f]}>No</button>
        </div>
      {/if}
    </div>
  {/each}

  {#if step === 3}
    <dl class="mt-4 divide-y rounded border">
      {#each Object.entries(LABELS) as [f, l]}
        <div class="flex gap-3 p-2"><dt class="w-28 text-gray-500">{l}</dt><dd>{seed[f as Field] || '— unspecified —'}</dd></div>
      {/each}
    </dl>
    {#if Object.keys(pending).length}
      <div class="mt-3 rounded bg-violet-50 p-3 text-sm">
        ✨ {Object.keys(pending).length} AI proposals waiting:
        <ul class="list-disc pl-5">{#each Object.entries(pending) as [f, v]}<li>{LABELS[f as Field]}: {v}</li>{/each}</ul>
        <button class="mt-2 rounded bg-green-600 px-2 text-white" onclick={acceptAll}>Accept all</button>
        <button class="mt-2 rounded border px-2" onclick={() => (pending = {})}>Dismiss</button>
      </div>
    {/if}
  {/if}

  <div class="mt-6 flex items-center gap-2">
    <button class="rounded border px-3 py-1 disabled:opacity-40" disabled={step === 0} onclick={() => step--}>Back</button>
    {#if step < 3}
      <button class="rounded bg-black px-3 py-1 text-white disabled:opacity-40" disabled={step === 0 && !seed.name.trim()} onclick={() => step++}>Next</button>
      <button class="ml-auto rounded bg-violet-600 px-3 py-1 text-white disabled:opacity-50" disabled={busy} onclick={suggestStep}>{busy ? 'Thinking…' : '✨ Suggest for this step'}</button>
    {:else}
      <button class="rounded bg-black px-3 py-1 text-white disabled:opacity-40" disabled={!seed.name.trim()} onclick={() => (created = true)}>Create World</button>
    {/if}
  </div>
  <button class="mt-4 text-sm text-violet-700 underline" disabled={busy} onclick={surprise}>Skip ahead: surprise me with a full draft</button>
  {#if created}<p class="mt-3 text-green-700">Created (stub). Nothing was saved.</p>{/if}
</div>

<details class="mt-6 text-xs text-gray-600"><summary>state</summary><pre>{JSON.stringify({ step, seed, pending }, null, 2)}</pre></details>
