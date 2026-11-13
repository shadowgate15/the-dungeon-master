<script lang="ts">
  import Button from '#lib/ui/Button.svelte'

  /** The Session header's Journal button: "Journal", or "Journal · 3 new" while entries are unseen. */
  let { unseen, onclick }: { unseen: number; onclick: () => void } = $props()
</script>

<Button variant="secondary" size="sm" {onclick}>
  {unseen > 0 ? `Journal · ${unseen} new` : 'Journal'}
</Button>
