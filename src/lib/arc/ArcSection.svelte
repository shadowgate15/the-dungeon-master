<script lang="ts">
  import type { Length } from '../campaign/enums.ts'
  import Alert from '../ui/Alert.svelte'
  import Badge from '../ui/Badge.svelte'
  import Button from '../ui/Button.svelte'
  import Textarea from '../ui/Textarea.svelte'
  import TextInput from '../ui/TextInput.svelte'
  import { ARC_SIZES, arcProblems, sizeText, type ArcViewData } from './arc.ts'

  /**
   * The Arc section of the Campaign page: generate, edit inline, accept. The Arc is a draft
   * until accepted; Regenerate is free until then and asks for confirmation after. Stop and
   * failure leave the stored Arc untouched. `onchange` runs after the server stored something
   * so the page can reload.
   */
  type Props = {
    campaignId: string
    length: Length
    arc: ArcViewData | null
    /** Generate and Regenerate are offered: editable Campaign, no Session started. */
    canGenerate: boolean
    /** A Session has started: text stays editable, structure and Regenerate are locked. */
    structureLocked: boolean
    /** Archived Campaign, or one on an archived World: nothing can change. */
    readOnly: boolean
    onchange: () => void
    fetcher?: typeof fetch
  }
  let {
    campaignId,
    length,
    arc,
    canGenerate,
    structureLocked,
    readOnly,
    onchange,
    fetcher = (...args) => fetch(...args)
  }: Props = $props()

  type EditBeat = { key: string; id?: string; title: string; description: string }
  type EditAct = { key: string; id?: string; name: string; purpose: string; beats: EditBeat[] }
  type Edit = {
    title: string
    premise: string
    stakes: string
    resolution: string
    acts: EditAct[]
  }

  const newKey = () => crypto.randomUUID()
  const toEdit = (a: ArcViewData): Edit => ({
    title: a.title,
    premise: a.premise,
    stakes: a.stakes,
    resolution: a.resolution,
    acts: a.acts.map((act) => ({
      key: act.id,
      id: act.id,
      name: act.name,
      purpose: act.purpose,
      beats: act.beats.map((b) => ({
        key: b.id,
        id: b.id,
        title: b.title,
        description: b.description
      }))
    }))
  })
  const serialize = (e: Edit) => JSON.stringify(e, (k, v) => (k === 'key' ? undefined : v))

  let edit = $state<Edit | null>(null)
  let saved = $state('')
  // Reload the form whenever the stored Arc changes (generate, save, accept).
  $effect(() => {
    const next = arc ? toEdit(arc) : null
    saved = next ? serialize(next) : ''
    edit = next
  })

  let phase = $state<'idle' | 'generating' | 'saving'>('idle')
  let failure = $state('')
  let error = $state('')
  let confirming = $state(false)
  let controller: AbortController | undefined

  const busy = $derived(phase !== 'idle')
  const frozen = $derived(readOnly || busy)
  const dirty = $derived(edit !== null && serialize(edit) !== saved)
  const problems = $derived(
    edit
      ? arcProblems(
          {
            ...edit,
            acts: edit.acts.map((a) => ({ ...a }))
          },
          length
        )
      : []
  )
  const complete = $derived(
    !!arc &&
      arc.status === 'accepted' &&
      arc.acts.every((a) => a.beats.every((b) => b.state !== 'pending'))
  )
  /** Beat state, read-only, once play has started. */
  const stateText = (b: { id?: string }) => {
    const beat = arc?.acts.flatMap((a) => a.beats).find((x) => x.id === b.id)
    if (!beat || beat.state === 'pending') return 'Pending'
    if (beat.state === 'abandoned') return 'Abandoned'
    return beat.sessionNumber ? `Reached in Session ${beat.sessionNumber}` : 'Reached'
  }
  const size = $derived(ARC_SIZES[length])
  const totalBeats = $derived(edit ? edit.acts.reduce((n, a) => n + a.beats.length, 0) : 0)

  const canAddAct = $derived(
    !!edit && edit.acts.length < size.acts[1] && totalBeats + 1 <= size.beats[1]
  )
  const canDeleteAct = (act: EditAct) =>
    !!edit && edit.acts.length > size.acts[0] && totalBeats - act.beats.length >= size.beats[0]
  const canAddBeat = $derived(totalBeats < size.beats[1])
  const canDeleteBeat = (act: EditAct) => act.beats.length > 1 && totalBeats > size.beats[0]

  function move<T>(list: T[], from: number, to: number) {
    if (to < 0 || to >= list.length) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
  }

  const newBeat = (): EditBeat => ({
    key: newKey(),
    title: 'New Beat',
    description: 'What should become true.'
  })

  function addAct() {
    edit?.acts.push({
      key: newKey(),
      name: 'New Act',
      purpose: 'What this phase is for.',
      beats: [newBeat()]
    })
  }
  const addBeat = (act: EditAct) => act.beats.push(newBeat())

  async function generate() {
    confirming = false
    failure = ''
    error = ''
    phase = 'generating'
    controller = new AbortController()
    try {
      const response = await fetcher(`/api/campaigns/${campaignId}/arc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
        signal: controller.signal
      })
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        failure?: { message?: string }
      } | null
      if (body?.ok) {
        phase = 'idle'
        onchange()
        return
      }
      failure = body?.failure?.message ?? body?.error ?? 'The Arc could not be generated.'
    } catch (e) {
      // Stop: the stored Arc is untouched and nothing is shown.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        failure = 'The Arc could not be generated.'
      }
    }
    phase = 'idle'
  }

  function stop() {
    controller?.abort()
  }

  async function save(accept: boolean) {
    if (!edit) return
    error = ''
    phase = 'saving'
    try {
      const response = await fetcher(`/api/campaigns/${campaignId}/arc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          accept,
          arc: JSON.parse(serialize(edit))
        })
      })
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null
      if (body?.ok) onchange()
      else error = body?.error ?? 'The Arc could not be saved.'
    } catch {
      error = 'The Arc could not be saved.'
    }
    phase = 'idle'
  }

  const regenerate = () => (arc?.status === 'accepted' ? (confirming = true) : generate())
  const unavailable = $derived(
    readOnly
      ? 'This Campaign is read-only, so an Arc cannot be generated or changed.'
      : 'This Campaign has already started play, so an Arc can no longer be generated.'
  )
</script>

<section aria-label="Arc" class="space-y-3">
  <div class="flex items-baseline justify-between gap-2">
    <h2 class="font-display text-lg">Arc</h2>
    {#if arc}
      <span class="flex items-center gap-2 text-xs text-muted">
        <Badge variant={arc.status === 'accepted' ? 'success' : 'info'} size="sm"
          >{arc.status === 'accepted' ? 'Accepted' : 'Draft'}</Badge
        >
        Not shown during play
      </span>
    {/if}
  </div>

  {#if !arc}
    <p class="text-muted">
      No Arc yet. An Arc is the planned shape of the story: Acts of Beats the DM steers toward. The
      DM may deviate from it, and you can play without one.
    </p>
  {:else if arc.status === 'draft' && !readOnly}
    <Alert variant="info">
      Draft Arc. The DM ignores it until you accept it. Edit any text, then accept. Regenerate
      freely until you do.
    </Alert>
  {/if}

  {#if complete && structureLocked}
    <Alert variant="success">Arc complete. Every Beat has been reached or abandoned.</Alert>
  {/if}

  {#if !canGenerate}
    <p class="text-sm text-muted">{unavailable}</p>
  {/if}

  {#if !readOnly}
    <div class="flex flex-wrap items-center gap-2">
      {#if phase === 'generating'}
        <Button variant="secondary" onclick={stop}>Stop</Button>
        <span class="text-sm text-muted" role="status">Generating the Arc…</span>
      {:else if arc}
        <Button variant="secondary" onclick={regenerate} disabled={busy || !canGenerate}
          >Regenerate</Button
        >
      {:else}
        <Button onclick={generate} disabled={!canGenerate}>Generate Arc</Button>
      {/if}
      {#if !arc && canGenerate}
        <span class="text-xs text-muted">{sizeText(length)} for a {length} Campaign.</span>
      {/if}
    </div>
  {/if}

  {#if confirming}
    <Alert variant="warning">
      Regenerating replaces the whole Arc, including your edits.
      <span class="mt-2 flex gap-2">
        <Button size="sm" variant="danger" onclick={generate}>Replace Arc</Button>
        <Button size="sm" variant="ghost" onclick={() => (confirming = false)}>Keep current</Button>
      </span>
    </Alert>
  {/if}
  {#if failure}
    <Alert variant="danger">
      The Arc could not be generated. {failure}
      {arc ? 'Your current Arc is unchanged.' : ''}
      <span class="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onclick={generate}>Try again</Button>
      </span>
    </Alert>
  {/if}
  {#if error}
    <Alert variant="danger">{error}</Alert>
  {/if}

  {#if edit}
    <div class="space-y-3 text-sm" class:opacity-50={phase === 'generating'}>
      <label class="block">
        Title
        <TextInput bind:value={edit.title} disabled={frozen} aria-label="Title" />
      </label>
      <label class="block">
        Premise
        <Textarea bind:value={edit.premise} rows={2} disabled={frozen} aria-label="Premise" />
      </label>
      <label class="block">
        Stakes
        <Textarea bind:value={edit.stakes} rows={2} disabled={frozen} aria-label="Stakes" />
      </label>

      {#each edit.acts as act, i (act.key)}
        <fieldset class="space-y-2 rounded-control bg-raised p-3">
          <legend class="px-1 font-medium">Act {i + 1}</legend>
          <TextInput bind:value={act.name} disabled={frozen} aria-label={`Act ${i + 1} name`} />
          <TextInput
            bind:value={act.purpose}
            disabled={frozen}
            aria-label={`Act ${i + 1} purpose`}
          />
          {#each act.beats as beat, j (beat.key)}
            <div class="space-y-1 border-l-2 border-control-border pl-3">
              <TextInput
                bind:value={beat.title}
                disabled={frozen}
                aria-label={`Act ${i + 1} Beat ${j + 1} title`}
              />
              <Textarea
                bind:value={beat.description}
                rows={2}
                disabled={frozen}
                aria-label={`Act ${i + 1} Beat ${j + 1} description`}
              />
              {#if structureLocked && beat.id}
                <p class="text-xs text-muted">
                  <Badge
                    variant={stateText(beat) === 'Pending'
                      ? 'neutral'
                      : stateText(beat) === 'Abandoned'
                        ? 'warning'
                        : 'success'}
                    size="sm">{stateText(beat)}</Badge
                  >
                </p>
              {/if}
              {#if !structureLocked && !readOnly}
                <div class="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={frozen || j === 0}
                    aria-label={`Move Beat ${j + 1} of Act ${i + 1} up`}
                    onclick={() => move(act.beats, j, j - 1)}>Up</Button
                  >
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={frozen || j === act.beats.length - 1}
                    aria-label={`Move Beat ${j + 1} of Act ${i + 1} down`}
                    onclick={() => move(act.beats, j, j + 1)}>Down</Button
                  >
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={frozen || !canDeleteBeat(act)}
                    aria-label={`Delete Beat ${j + 1} of Act ${i + 1}`}
                    onclick={() => act.beats.splice(j, 1)}>Delete</Button
                  >
                </div>
              {/if}
            </div>
          {/each}
          {#if !structureLocked && !readOnly}
            <div class="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={frozen || !canAddBeat}
                aria-label={`Add Beat to Act ${i + 1}`}
                onclick={() => addBeat(act)}>Add Beat</Button
              >
              <Button
                size="sm"
                variant="ghost"
                disabled={frozen || i === 0}
                aria-label={`Move Act ${i + 1} up`}
                onclick={() => move(edit!.acts, i, i - 1)}>Move up</Button
              >
              <Button
                size="sm"
                variant="ghost"
                disabled={frozen || i === edit.acts.length - 1}
                aria-label={`Move Act ${i + 1} down`}
                onclick={() => move(edit!.acts, i, i + 1)}>Move down</Button
              >
              <Button
                size="sm"
                variant="ghost"
                disabled={frozen || !canDeleteAct(act)}
                aria-label={`Delete Act ${i + 1}`}
                onclick={() => edit!.acts.splice(i, 1)}>Delete Act</Button
              >
            </div>
          {/if}
        </fieldset>
      {/each}

      {#if !structureLocked && !readOnly}
        <Button size="sm" variant="secondary" disabled={frozen || !canAddAct} onclick={addAct}
          >Add Act</Button
        >
        <p class="text-xs text-muted">
          A {length} Arc holds {sizeText(length)}, and every Act needs a Beat.
        </p>
      {/if}

      <label class="block">
        Resolution
        <Textarea bind:value={edit.resolution} rows={2} disabled={frozen} aria-label="Resolution" />
      </label>

      {#if dirty && problems.length > 0}
        <Alert variant="warning">{problems.join('. ')}.</Alert>
      {/if}

      {#if !readOnly}
        <div class="flex flex-wrap gap-2">
          {#if arc?.status === 'draft'}
            <Button disabled={busy || problems.length > 0} onclick={() => save(true)}
              >Accept Arc</Button
            >
          {/if}
          <Button
            variant="secondary"
            disabled={busy || !dirty || problems.length > 0}
            onclick={() => save(false)}>Save changes</Button
          >
        </div>
      {/if}
    </div>
  {/if}
</section>
