<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import AiStatusChip from './AiStatusChip.svelte'
  import type { AiStatus } from './status.ts'

  const { Story } = defineMeta({ title: 'AI/AiStatusChip', component: AiStatusChip })

  const store = (status: AiStatus | undefined) => ({ status, checking: false, check: () => {} })
</script>

<Story name="Checking" args={{ ai: store(undefined) }} />
<Story
  name="Ready"
  args={{ ai: store({ state: 'ready', model: 'qwen3-4b-2507', contextLength: 8192 }) }}
/>
<Story name="Not configured" args={{ ai: store({ state: 'not-configured' }) }} />
<Story name="Unreachable" args={{ ai: store({ state: 'unreachable', model: 'qwen3-4b-2507' }) }} />
<Story
  name="Model unavailable"
  args={{ ai: store({ state: 'model-unavailable', model: 'qwen3-4b-2507' }) }}
/>
<Story
  name="Reasoning model"
  args={{ ai: store({ state: 'reasoning-model', model: 'qwen3-4b-2507' }) }}
/>
