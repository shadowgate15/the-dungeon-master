<script lang="ts">
  import Button from '#lib/ui/Button.svelte'
  import Textarea from '#lib/ui/Textarea.svelte'
  import type { PendingDeclaration, ReturnedDraft } from './floor'
  import type { SceneView } from './scene'

  /**
   * The pinned composer: the open Floor's pending tray above a box that adds a Declaration for the
   * acting Character. Every tray entry can be edited or withdrawn until the Floor closes. Done
   * closes the Floor (empty or not); Ctrl+Enter is Send & Done. While the DM is answering, drafting
   * stays open but Done waits. While the DM is away, a "DM away" bar with the command that brings
   * the DM back replaces the send controls; drafting stays open. A pure view; the console wires the
   * callbacks to the server.
   */
  let {
    acting,
    declarations,
    onsend,
    ondone,
    onedit,
    onwithdraw,
    awaiting = false,
    disabled = false,
    elsewhere = [],
    oncut = () => {},
    returned = [],
    onreturned = () => {},
    away = null,
    isHost = true,
    turn = null
  }: {
    /** The acting Character's name, or null when no Character can act. */
    acting: string | null
    declarations: PendingDeclaration[]
    onsend: (text: string) => void
    /** Done; `text` is a Declaration to send first (Send & Done), or null. */
    ondone: (text: string | null) => void
    /** The DM is answering the last turn. */
    awaiting?: boolean
    onedit: (id: string, text: string) => void
    onwithdraw: (id: string) => void
    disabled?: boolean
    /** Characters off the spotlight, greyed out beside the box with "Cut to <Name>". */
    elsewhere?: SceneView['elsewhere']
    /** A spotlight request for a Character elsewhere. */
    oncut?: (character: string) => void
    /** Drafts a cut sent back; the box loads them as unsent text. */
    returned?: ReturnedDraft[]
    /** The box has loaded these returned drafts. */
    onreturned?: (ids: string[]) => void
    /** No DM is at the table: the Campaign folder to run `dm` in. */
    away?: { folder: string } | null
    /** Whether this browser is the Host's: only the Host sees the folder and relaunch command. */
    isHost?: boolean
    /** In a Combat, whose turn it is: the box is locked to that Character, or blocked for a foe. */
    turn?: string | null
  } = $props()

  /** The folder, quoted for a POSIX shell when it needs it. */
  const quoted = (folder: string) =>
    /^[\w@%+=:,./-]+$/.test(folder) ? folder : `'${folder.replaceAll("'", `'\\''`)}'`
  const relaunch = $derived(away ? `cd ${quoted(away.folder)} && dm` : '')
  let copied = $state(false)
  async function copy() {
    await navigator.clipboard.writeText(relaunch)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  let draft = $state('')
  let editing = $state<{ id: string; text: string } | null>(null)

  // A cut sent drafts back: load them into the box as unsent text, once each.
  const loaded: string[] = []
  $effect(() => {
    const fresh = returned.filter((r) => !loaded.includes(r.id))
    if (!fresh.length) return
    loaded.push(...fresh.map((r) => r.id))
    draft = [draft.trim(), ...fresh.map((r) => r.text)].filter(Boolean).join('\n')
    onreturned(fresh.map((r) => r.id))
  })

  const blocked = $derived(disabled || acting === null)
  const prompt = $derived(
    acting ? `What does ${acting} do?` : turn ? `It is ${turn}'s turn` : 'No Character can act'
  )
  const label = (d: PendingDeclaration) => `${d.characterName}: ${d.text}`

  function send() {
    const text = draft.trim()
    if (!text || blocked || away) return
    onsend(text)
    draft = ''
  }

  function done() {
    if (disabled || awaiting || away) return
    const text = draft.trim()
    ondone(text && !blocked ? text : null)
    if (text && !blocked) draft = ''
  }

  function save() {
    if (!editing) return
    const text = editing.text.trim()
    if (text) onedit(editing.id, text)
    editing = null
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault()
      done()
    } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      send()
    }
  }
</script>

<div class="flex flex-col gap-2 rounded-panel border border-border bg-raised p-2">
  {#if declarations.length}
    <ul
      class="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm"
      aria-label="Pending Declarations"
    >
      {#each declarations as d (d.id)}
        <li class="flex items-start gap-2 rounded-control bg-surface px-2 py-1">
          <span class="font-medium">{d.characterName}</span>
          {#if editing?.id === d.id}
            <form
              class="flex flex-1 flex-col gap-1"
              onsubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <Textarea
                size="sm"
                rows={2}
                aria-label="Edit Declaration"
                bind:value={editing.text}
              />
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onclick={() => (editing = null)}
                  >Cancel</Button
                >
                <Button size="sm" type="submit">Save</Button>
              </div>
            </form>
          {:else if away}
            <span class="flex-1 whitespace-pre-wrap">{d.text}</span>
          {:else}
            <span class="flex-1 whitespace-pre-wrap">{d.text}</span>
            <button
              class="text-xs text-muted underline"
              aria-label="Edit {label(d)}"
              onclick={() => (editing = { id: d.id, text: d.text })}>edit</button
            >
            <button
              class="text-xs text-muted underline"
              aria-label="Withdraw {label(d)}"
              onclick={() => onwithdraw(d.id)}>withdraw</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if turn}
    <p class="text-xs font-medium">{turn}'s turn</p>
  {/if}
  <Textarea
    size="sm"
    rows={2}
    bind:value={draft}
    {onkeydown}
    disabled={blocked}
    aria-label={prompt}
    placeholder={prompt}
  />
  {#if elsewhere.length}
    <ul class="flex flex-wrap gap-2 text-xs" aria-label="Elsewhere">
      {#each elsewhere as c (c.id)}
        <li class="flex items-center gap-1 rounded-control bg-surface px-2 py-1 text-muted">
          <span>{c.name} · elsewhere{c.whereabouts ? `: ${c.whereabouts}` : ''}</span>
          {#if !away}
            <button class="underline" onclick={() => oncut(c.id)}>Cut to {c.name}</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if away}
    <div
      role="status"
      aria-label="DM away"
      class="flex flex-wrap items-center gap-2 rounded-control bg-surface px-2 py-1 text-sm"
    >
      <span class="font-medium">The DM is away.</span>
      {#if isHost}
        <span class="text-muted">Start a Session to play on; your drafts wait here.</span>
        <code class="ml-auto rounded-control bg-raised px-1.5 py-0.5 font-mono text-xs"
          >{relaunch}</code
        >
        <Button size="sm" variant="secondary" onclick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      {:else}
        <span class="text-muted">Waiting for the Host to start the DM; your drafts wait here.</span>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-end gap-2">
      <span class="mr-auto text-xs text-muted"
        >Enter adds to the tray · Ctrl+Enter sends and closes · Shift+Enter for a new line</span
      >
      <Button size="sm" variant="secondary" onclick={send} disabled={blocked || !draft.trim()}
        >Send</Button
      >
      <Button size="sm" onclick={done} disabled={disabled || awaiting}>Done</Button>
    </div>
  {/if}
</div>
