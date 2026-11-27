<script lang="ts">
  import Journal from './Journal.svelte'
  import { knownBy, type Journal as JournalData } from './journal'
  import type { SceneView } from './scene'
  import RailCard from './RailCard.svelte'
  import SceneRail from './SceneRail.svelte'

  /**
   * The play console's right rail: the clock and Scene, the initiative order in a Combat, and
   * the Journal of what the viewed Character believes. On a wide screen it is held to its
   * column's height: the Scene card keeps its size, and the initiative and Journal cards share
   * the rest, each scrolling its own body under a pinned header.
   */
  let {
    scene,
    journal,
    viewer
  }: {
    scene: SceneView
    journal: JournalData
    /** The viewed Character (the open sheet tab, even one elsewhere): whose Beliefs the card shows. */
    viewer: { id: string; name: string }
  } = $props()
</script>

<aside
  aria-label="Scene"
  class="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm lg:overflow-hidden"
>
  <SceneRail {scene} />
  <RailCard id="knows-heading" headingClass="text-xs font-semibold text-muted uppercase">
    {#snippet heading()}What {viewer.name} knows{/snippet}
    <Journal entries={knownBy(journal, viewer.id)} actor={viewer.id} />
  </RailCard>
</aside>
