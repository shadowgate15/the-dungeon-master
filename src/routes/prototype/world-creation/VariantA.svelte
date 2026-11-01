<script lang="ts">
  // Variant A: one long form. Form is the source of truth; AI proposals sit beside fields as pending ghosts.
  import { FIELDS, LABELS, OPTIONS, emptySeed, suggestField, draftSeed, type Field, type Seed } from './stub'
  let seed = $state<Seed>(emptySeed())
  let pending = $state<Partial<Seed>>({})
  let busy = $state<Field | 'draft' | null>(null)
  let prompt = $state('')
  let created = $state(false)

  async function suggest(f: Field) {
    busy = f
    pending[f] = await suggestField(f, seed)
    busy = null
  }
  async function draft() {
    busy = 'draft'
    pending = await draftSeed(prompt)
    busy = null
  }
  function accept(f: Field) {
    seed[f] = pending[f]!
    delete pending[f]
  }
  const pendingCount = $derived(Object.keys(pending).length)
</script>

<h1 class="text-2xl font-bold">New World <span class="text-sm font-normal text-gray-500">(A: single form)</span></h1>

<section class="mt-4 rounded border border-dashed p-4">
  <label for="a-prompt" class="font-medium">Draft the whole seed from a prompt (optional)</label>
  <div class="mt-2 flex gap-2">
    <input id="a-prompt" class="flex-1 rounded border p-2" placeholder="e.g. a gloomy drowned empire" bind:value={prompt} />
    <button class="rounded bg-violet-600 px-3 text-white disabled:opacity-50" disabled={busy !== null} onclick={draft}>
      {busy === 'draft' ? 'Drafting…' : '✨ Draft'}
    </button>
  </div>
  {#if pendingCount > 1}
    <div class="mt-2 flex gap-2 text-sm">
      <button class="rounded bg-green-600 px-2 py-1 text-white" onclick={() => FIELDS.forEach((f) => pending[f] !== undefined && accept(f))}>Accept all {pendingCount}</button>
      <button class="rounded border px-2 py-1" onclick={() => (pending = {})}>Dismiss all</button>
    </div>
  {/if}
</section>

<form class="mt-6 space-y-5" onsubmit={(e) => { e.preventDefault(); created = true }}>
  {#each FIELDS as f}
    <div>
      <div class="flex items-center justify-between">
        <label for="a-{f}" class="font-medium">{LABELS[f]}{#if f === 'name'} <span class="text-red-600">*</span>{:else} <span class="text-xs text-gray-500">optional</span>{/if}</label>
        <button type="button" class="text-sm text-violet-700 disabled:opacity-50" disabled={busy !== null} onclick={() => suggest(f)}>
          {busy === f ? 'Thinking…' : '✨ Suggest'}
        </button>
      </div>
      {#if f === 'premise'}
        <textarea id="a-{f}" rows="3" maxlength="500" class="mt-1 w-full rounded border p-2" bind:value={seed[f]}></textarea>
        <div class="text-right text-xs text-gray-500">{seed[f].length}/500</div>
      {:else if f === 'name'}
        <input id="a-{f}" class="mt-1 w-full rounded border p-2" bind:value={seed[f]} />
      {:else}
        <select id="a-{f}" class="mt-1 w-full rounded border p-2" bind:value={seed[f]}>
          <option value="">Unspecified</option>
          {#each OPTIONS[f] as o}<option>{o}</option>{/each}
        </select>
      {/if}
      {#if pending[f] !== undefined}
        <div class="mt-1 flex items-center gap-2 rounded bg-violet-50 p-2 text-sm text-violet-900">
          <span class="flex-1">✨ {pending[f]}</span>
          <button type="button" class="rounded bg-green-600 px-2 py-0.5 text-white" onclick={() => accept(f)}>Accept</button>
          <button type="button" class="rounded border px-2 py-0.5" onclick={() => delete pending[f]}>Dismiss</button>
        </div>
      {/if}
    </div>
  {/each}
  <button class="rounded bg-black px-4 py-2 text-white disabled:opacity-40" disabled={!seed.name.trim()}>Create World</button>
  {#if created}<p class="text-green-700">Created (stub). Nothing was saved.</p>{/if}
</form>

<details class="mt-6 text-xs text-gray-600"><summary>state</summary><pre>{JSON.stringify({ seed, pending }, null, 2)}</pre></details>
