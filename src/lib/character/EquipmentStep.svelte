<script lang="ts">
  import FieldAi from '#lib/ui/FieldAi.svelte'
  import Select from '#lib/ui/Select.svelte'
  import { categoryItems, emptyPick, equipmentGroups, fixedEquipment } from './equipment.ts'
  import type { CharacterWizard } from './wizard.svelte.ts'

  let { wizard }: { wizard: CharacterWizard } = $props()

  const rules = $derived(wizard.rules)
  const groups = $derived(equipmentGroups(rules, wizard.draft, wizard.resolved))
  const fixed = $derived(fixedEquipment(rules, wizard.draft))

  const setPick = (key: string, pick: (typeof groups)[number]['pick']) =>
    wizard.update({ equipment: { ...wizard.draft.equipment, [key]: pick! } })
</script>

<div class="space-y-6">
  <p class="text-muted">
    Choose your starting equipment. Wildcards such as "any martial weapon" need a specific item.
  </p>

  {#each groups as group (group.key)}
    {@const selected = group.pick ? group.options[group.pick.option] : undefined}
    <fieldset class="space-y-2" data-testid={`equipment-group-${group.key}`}>
      <legend class="font-medium text-text">
        {group.ownerName}: {group.label}
      </legend>

      <FieldAi
        {...wizard.aiField(`equipment:${group.key}`)}
        label={wizard.groupLabel(`equipment:${group.key}`) || group.label}
        kind="group"
        value={wizard.groupText(`equipment:${group.key}`)}
      />

      {#each group.options as option (option.index)}
        <div class="space-y-2">
          <label class={['flex items-start gap-2', option.disabled ? 'text-muted' : 'text-text']}>
            <input
              type="radio"
              class="mt-1"
              name={group.key}
              checked={group.pick?.option === option.index}
              disabled={option.disabled !== null}
              onchange={() => setPick(group.key, emptyPick(option))}
            />
            <span>
              {option.label}
              {#if option.disabled}
                <span class="block text-sm">{option.disabled}</span>
              {/if}
            </span>
          </label>

          {#if selected === option && option.slots.length > 0 && group.pick}
            {@const pick = group.pick}
            <div class="ml-6 grid gap-2 sm:grid-cols-2">
              {#each option.slots as category, slot (slot)}
                {@const name = rules.equipmentCategories.find((c) => c.slug === category)?.name}
                <Select
                  aria-label={`${name ?? category} item ${slot + 1}`}
                  value={pick.wild[slot] ?? ''}
                  onchange={(e) => {
                    const wild = [...pick.wild]
                    wild[slot] = e.currentTarget.value || null
                    setPick(group.key, { option: pick.option, wild })
                  }}
                >
                  <option value="">Choose from {name ?? category}…</option>
                  {#each categoryItems(rules, category) as item (item.slug)}
                    <option value={item.slug}>{item.name}</option>
                  {/each}
                </Select>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </fieldset>
  {/each}

  {#each fixed as source (source.source)}
    <section class="space-y-1" data-testid={`equipment-fixed-${source.source}`}>
      <h3 class="font-medium text-text">
        {source.source === 'class' ? `${source.ownerName} gear` : `${source.ownerName} package`}
      </h3>
      <ul class="list-disc pl-6 text-muted">
        {#each source.items as item (item.item)}
          <li>{item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}</li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
