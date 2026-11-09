<script module lang="ts">
  // PROTOTYPE (throwaway): three structurally different takes on the per-field AI button + feedback popover.
  // Run `pnpm storybook`, open Prototype/Field AI. Use the Variant and Scenario controls.
  import { defineMeta } from '@storybook/addon-svelte-csf'
  import Field from './Field.svelte'
  import { FieldAi, type Blocked } from './controller.svelte'

  const { Story } = defineMeta({
    title: 'Prototype/Field AI',
    tags: ['!autodocs'],
    argTypes: {
      variant: { control: 'inline-radio', options: ['A', 'B', 'C'] },
      blocked: {
        control: 'select',
        options: [undefined, 'ai-unavailable', 'archived', 'read-only']
      }
    },
    args: { variant: 'A', blocked: undefined }
  })
</script>

{#snippet template(args: { variant: 'A' | 'B' | 'C'; blocked?: Blocked })}
  {@const name = new FieldAi('Marrowgate')}
  {@const premise = new FieldAi('')}
  {@const tone = new FieldAi('Grim', ['Grim', 'Heroic', 'Whimsical', 'Gritty'])}
  {@const race = new FieldAi('Half-Elf', [
    'Dwarf',
    'Elf',
    'Halfling',
    'Human',
    'Half-Elf',
    'Tiefling'
  ])}
  <div class="max-w-md space-y-6 p-4">
    <Field variant={args.variant} label="Name" kind="text" ai={name} blocked={args.blocked} />
    <Field
      variant={args.variant}
      label="Premise"
      kind="textarea"
      ai={premise}
      blocked={args.blocked}
    />
    <Field variant={args.variant} label="Tone" kind="enum" ai={tone} blocked={args.blocked} />
    <Field
      variant={args.variant}
      label="Race (Rules Data)"
      kind="enum"
      ai={race}
      blocked={args.blocked}
    />
  </div>
{/snippet}

<Story name="Field AI" {template} />
