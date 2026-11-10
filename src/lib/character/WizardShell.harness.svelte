<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
  import WizardShell from './WizardShell.svelte'
  import type { CharacterWizard } from './wizard.svelte.ts'

  /** Test harness: the shell inside the query client the app's layout normally provides. */
  let {
    wizard,
    backHref,
    onabandon
  }: {
    wizard: CharacterWizard
    backHref: string
    onabandon: () => void
  } = $props()

  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } })
</script>

<QueryClientProvider {client}>
  <WizardShell {wizard} {backHref} {onabandon} />
</QueryClientProvider>
