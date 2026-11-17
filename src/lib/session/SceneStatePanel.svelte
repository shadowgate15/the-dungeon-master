<script lang="ts">
  import { examineText, goText, talkText } from './affordances.ts'
  import type { SceneState, SessionEvent } from './enums.ts'

  let {
    scene,
    log = [],
    onpick
  }: {
    scene: SceneState
    log?: SessionEvent[]
    /** When set, NPCs, exits and objects are clickable and call this with the action text to pre-fill. */
    onpick?: (text: string) => void
  } = $props()
  const talkingTo = $derived(scene.npcs.find((n) => n.id === scene.dialogueNpcId))
  const inDialogue = $derived(scene.mode === 'dialogue')
  // The talking NPC's most recent line, so the conversation is the focus of the panel.
  const latestLine = $derived(
    talkingTo ? log.findLast((e) => e.kind === 'npc-line' && e.npcId === talkingTo.id) : undefined
  )
</script>

<aside
  aria-label="Scene"
  class="space-y-4 overflow-y-auto rounded-panel border border-border bg-surface p-3 text-sm"
>
  <section aria-label="Mode">
    <h2 class="text-xs font-semibold text-muted uppercase">Mode</h2>
    <p
      class="inline-block rounded-full px-2 py-0.5 {scene.mode === 'dialogue'
        ? 'bg-primary text-on-primary'
        : 'bg-info-bg text-info'}"
    >
      {scene.mode}{talkingTo ? ` · ${talkingTo.name}` : ''}
    </p>
  </section>

  {#if inDialogue && talkingTo}
    <section aria-label="Conversation" class="rounded-control border border-primary bg-raised p-3">
      <p class="font-display text-xl">{talkingTo.name}</p>
      <p class="text-xs text-muted">Attitude: {talkingTo.attitude}</p>
      {#if latestLine}
        <blockquote class="mt-2 whitespace-pre-wrap">&ldquo;{latestLine.text}&rdquo;</blockquote>
      {:else}
        <p class="mt-2 text-muted italic">Waiting to speak.</p>
      {/if}
    </section>
  {/if}

  <section aria-label="Location">
    <h2 class="text-xs font-semibold text-muted uppercase">Location</h2>
    <p class={inDialogue ? 'text-xs text-muted' : 'font-display text-lg'}>{scene.location.name}</p>
    {#if !inDialogue}<p>{scene.location.description}</p>{/if}
  </section>

  <section aria-label="Exits">
    <h2 class="text-xs font-semibold text-muted uppercase">Exits</h2>
    {#if scene.exits.length === 0}
      <p class="text-muted">None</p>
    {:else}
      <ul class="list-inside list-disc">
        {#each scene.exits as exit (exit.id)}
          <li>
            {#if onpick}<button type="button" class="underline" onclick={() => onpick(goText(exit))}
                >{exit.name}</button
              >{:else}{exit.name}{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section aria-label="Objects">
    <h2 class="text-xs font-semibold text-muted uppercase">Objects</h2>
    {#if scene.objects.length === 0}
      <p class="text-muted">None</p>
    {:else}
      <ul class="list-inside list-disc">
        {#each scene.objects as object (object)}
          <li>
            {#if onpick}<button
                type="button"
                class="underline"
                onclick={() => onpick(examineText(object))}>{object}</button
              >{:else}{object}{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section aria-label="Present">
    <h2 class="text-xs font-semibold text-muted uppercase">Present</h2>
    {#if scene.npcs.length === 0}
      <p class="text-muted">Nobody</p>
    {:else}
      <ul class="space-y-2">
        {#each scene.npcs as npc (npc.id)}
          <li
            class="rounded-control border p-2 {npc.id === scene.dialogueNpcId
              ? 'border-primary bg-raised'
              : 'border-border'}"
          >
            <p class="font-medium">
              {#if onpick}<button
                  type="button"
                  class="underline"
                  onclick={() => onpick(talkText(npc))}>{npc.name}</button
                >{:else}{npc.name}{/if}
            </p>
            <p class="text-xs">Attitude: {npc.attitude}</p>
            <p class="text-xs text-muted">Knows: {npc.knowledge}</p>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section aria-label="Pending roll">
    <h2 class="text-xs font-semibold text-muted uppercase">Pending roll</h2>
    {#if scene.pendingRoll}
      <p>{scene.pendingRoll.check} DC {scene.pendingRoll.dc}</p>
      <p class="text-xs text-muted">{scene.pendingRoll.reason}</p>
    {:else}
      <p class="text-muted">None</p>
    {/if}
  </section>
</aside>
