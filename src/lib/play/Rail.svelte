<script lang="ts">
  import Journal from './Journal.svelte'
  import type { JournalEntry } from './journal'
  import type { SceneView } from './scene'
  import RailCard from './RailCard.svelte'
  import SceneRail from './SceneRail.svelte'

  /**
   * The play console's right rail: the clock and Scene, the initiative order in a Combat, and
   * the Journal of what the acting Character believes. On a wide screen it is held to its
   * column's height: the Scene card keeps its size, and the initiative and Journal cards share
   * the rest, each scrolling its own body under a pinned header.
   */
  let {
    scene,
    believer,
    entries,
    actor
  }: {
    scene: SceneView
    /** Whose Beliefs the Journal card shows, for its heading: the acting Character's name, or "the Party". */
    believer: string
    entries: JournalEntry[]
    actor?: string
  } = $props()
</script>

<aside
  aria-label="Scene"
  class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm lg:overflow-hidden"
>
  <SceneRail {scene} />
  <RailCard id="knows-heading" headingClass="text-xs font-semibold text-muted uppercase">
    {#snippet heading()}What {believer} knows{/snippet}
    <Journal {entries} {actor} />
  </RailCard>
</aside>
