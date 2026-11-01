<script lang="ts">
  // Variant C: conversation. Chat on the left asks about each field; a live editable seed card (the form) on the right.
  import { FIELDS, LABELS, OPTIONS, emptySeed, suggestField, draftSeed, type Field, type Seed } from './stub'
  type Msg = { who: 'ai' | 'me'; text: string; proposal?: { field: Field; value: string; state: 'open' | 'accepted' | 'dismissed' } }
  let seed = $state<Seed>(emptySeed())
  let msgs = $state<Msg[]>([{ who: 'ai', text: "Let's build your world. Describe it in a sentence, or tell me its name. I'll propose; you decide." }])
  let input = $state('')
  let busy = $state(false)
  let created = $state(false)

  async function send() {
    const text = input.trim()
    if (!text) return
    input = ''
    msgs.push({ who: 'me', text })
    busy = true
    const d = await draftSeed(text)
    msgs.push({ who: 'ai', text: 'Here is what I would put on the card. Accept what you like.' })
    for (const f of FIELDS) msgs.push({ who: 'ai', text: LABELS[f], proposal: { field: f, value: d[f], state: 'open' } })
    busy = false
  }
  async function ask(f: Field) {
    msgs.push({ who: 'me', text: `Suggest a ${LABELS[f].toLowerCase()}` })
    busy = true
    const value = await suggestField(f, seed)
    msgs.push({ who: 'ai', text: LABELS[f], proposal: { field: f, value, state: 'open' } })
    busy = false
  }
  function resolve(m: Msg, accept: boolean) {
    if (accept) seed[m.proposal!.field] = m.proposal!.value
    m.proposal!.state = accept ? 'accepted' : 'dismissed'
  }
</script>

<h1 class="text-2xl font-bold">New World <span class="text-sm font-normal text-gray-500">(C: conversation)</span></h1>

<div class="mt-4 grid gap-6 md:grid-cols-[1fr_20rem]">
  <section class="flex h-[32rem] flex-col rounded border">
    <div class="flex-1 space-y-2 overflow-y-auto p-3">
      {#each msgs as m}
        <div class="flex {m.who === 'me' ? 'justify-end' : ''}">
          <div class="max-w-[80%] rounded-lg px-3 py-2 text-sm {m.who === 'me' ? 'bg-black text-white' : 'bg-gray-100'}">
            {#if m.proposal}
              <div class="text-xs text-gray-500">{m.text}</div>
              <div>{m.proposal.value}</div>
              {#if m.proposal.state === 'open'}
                <button class="mt-1 rounded bg-green-600 px-2 text-xs text-white" onclick={() => resolve(m, true)}>Accept</button>
                <button class="mt-1 rounded border px-2 text-xs" onclick={() => resolve(m, false)}>Dismiss</button>
              {:else}<div class="text-xs italic text-gray-500">{m.proposal.state}</div>{/if}
            {:else}{m.text}{/if}
          </div>
        </div>
      {/each}
      {#if busy}<div class="text-sm text-gray-500">…thinking</div>{/if}
    </div>
    <div class="flex gap-2 border-t p-2">
      <input class="flex-1 rounded border p-2" placeholder="Describe your world…" bind:value={input} onkeydown={(e) => e.key === 'Enter' && send()} />
      <button class="rounded bg-violet-600 px-3 text-white disabled:opacity-50" disabled={busy} onclick={send}>Send</button>
    </div>
  </section>

  <aside class="space-y-3 rounded border p-3">
    <h2 class="font-semibold">Seed card <span class="text-xs font-normal text-gray-500">(edit directly anytime)</span></h2>
    {#each FIELDS as f}
      <div>
        <div class="flex justify-between"><label for="c-{f}" class="text-sm font-medium">{LABELS[f]}{f === 'name' ? ' *' : ''}</label>
          <button class="text-xs text-violet-700 disabled:opacity-50" disabled={busy} onclick={() => ask(f)}>✨ ask</button></div>
        {#if f === 'premise'}
          <textarea id="c-{f}" rows="3" maxlength="500" class="w-full rounded border p-1 text-sm" bind:value={seed[f]}></textarea>
        {:else if f === 'name'}
          <input id="c-{f}" class="w-full rounded border p-1 text-sm" bind:value={seed[f]} />
        {:else}
          <select id="c-{f}" class="w-full rounded border p-1 text-sm" bind:value={seed[f]}>
            <option value="">Unspecified</option>
            {#each OPTIONS[f] as o}<option>{o}</option>{/each}
          </select>
        {/if}
      </div>
    {/each}
    <button class="w-full rounded bg-black py-2 text-white disabled:opacity-40" disabled={!seed.name.trim()} onclick={() => (created = true)}>Create World</button>
    {#if created}<p class="text-sm text-green-700">Created (stub). Nothing saved.</p>{/if}
  </aside>
</div>
