<script lang="ts">
  import type { Recap } from '#lib/memory/journal.ts'

  type Props = { recap: Recap }

  let { recap }: Props = $props()
</script>

<!-- Code-rendered from the previous Session's summary (else its last narration); no model call. -->
<section
  aria-labelledby="previously-title"
  class="rounded-panel border border-border bg-surface p-3"
>
  <h2 id="previously-title" class="font-display text-lg">Previously</h2>
  <p class="mt-1 text-sm whitespace-pre-line">{recap.text}</p>
</section>
