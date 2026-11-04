import type { OptionItem } from '#lib/rules/schema.ts'
import type { ResolvedFeatures } from '#lib/rules/resolver.ts'
import type { CharacterDraft, WizardRules } from './draft.ts'
import type { StepContext, StepValidation } from './steps.ts'

/**
 * Starting equipment (#113, decided in #97). Equipment choice groups are class- and
 * background-owned bundles of options; a wildcard ("any martial weapon") is an item-table filter
 * (an equipment category in Rules Data) the player fills with a specific item. The draft stores
 * one `EquipmentPick` per group, keyed by the full choice key (`class/fighter/equipment-0`).
 * Pure: no Svelte, no browser APIs.
 */

/**
 * The player's pick for one group: the chosen option's index and, for each wildcard slot of that
 * option (in item order, a `count` of 2 giving two slots), the specific item slug or null while
 * unpicked.
 */
export interface EquipmentPick {
  option: number
  wild: (string | null)[]
}

export type EquipmentOwner = 'class' | 'background'

/** One piece of an option: a fixed item, or `count` wildcard slots over an item category. */
export type OptionLine =
  | { kind: 'item'; item: string; name: string; count: number }
  | { kind: 'wildcard'; category: string; name: string; count: number }

export interface EquipmentOption {
  index: number
  /** Plain-language summary, e.g. "Rapier" or "Crossbow, light, Crossbow bolt x20". */
  label: string
  lines: OptionLine[]
  /** Category slug of each wildcard slot, in slot order. */
  slots: string[]
  /** Why the option cannot be chosen (Cleric "if proficient"); null when it can. */
  disabled: string | null
}

export interface EquipmentGroup {
  /** Full choice key: `${ownerType}/${ownerSlug}/${groupKey}`. */
  key: string
  ownerType: EquipmentOwner
  ownerSlug: string
  ownerName: string
  /** Summary of the options, e.g. "Mace or Warhammer". */
  label: string
  options: EquipmentOption[]
  pick: EquipmentPick | null
}

export interface FixedEquipment {
  source: EquipmentOwner
  ownerName: string
  items: { item: string; name: string; quantity: number }[]
}

export interface EquipmentRow {
  choiceKey: string
  item: string
  quantity: number
}

type EquipmentRules = Pick<
  WizardRules,
  'classes' | 'backgrounds' | 'equipment' | 'equipmentCategories' | 'proficiencies'
>

const nameOf = (rules: Pick<WizardRules, 'equipment'>, slug: string) =>
  rules.equipment.find((e) => e.slug === slug)?.name ?? slug

/** The legal items of a wildcard category, in name order. */
export function categoryItems(
  rules: Pick<WizardRules, 'equipment' | 'equipmentCategories'>,
  category: string
): { slug: string; name: string }[] {
  const slugs = rules.equipmentCategories?.find((c) => c.slug === category)?.items ?? []
  return slugs
    .map((slug) => ({ slug, name: nameOf(rules, slug) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** A fresh pick of an option, with every wildcard slot still empty. */
export function emptyPick(option: EquipmentOption): EquipmentPick {
  return { option: option.index, wild: option.slots.map(() => null) }
}

function isProficient(
  rules: EquipmentRules,
  resolved: ResolvedFeatures,
  proficiency: string,
  item: string
): boolean {
  return resolved.proficiencies.some((p) => {
    if (p.slug === proficiency) return true
    const ref = rules.proficiencies.find((r) => r.slug === p.slug)?.reference
    if (!ref) return false
    if (ref.type === 'equipment') return ref.slug === item
    if (ref.type === 'equipment-category') {
      return rules.equipmentCategories?.find((c) => c.slug === ref.slug)?.items.includes(item)
    }
    return false
  })
}

function describeLine(rules: EquipmentRules, item: OptionItem): OptionLine | null {
  if (item.type === 'equipment') {
    return {
      kind: 'item',
      item: item.equipment,
      name: nameOf(rules, item.equipment),
      count: item.count
    }
  }
  if (item.type === 'equipmentCategory') {
    const name = rules.equipmentCategories?.find((c) => c.slug === item.category)?.name
    return {
      kind: 'wildcard',
      category: item.category,
      name: name ?? item.category,
      count: item.count
    }
  }
  return null
}

const lineLabel = (l: OptionLine) =>
  l.kind === 'item'
    ? l.count > 1
      ? `${l.name} ×${l.count}`
      : l.name
    : l.count > 1
      ? `${l.count} from ${l.name}`
      : `Any of ${l.name}`

/**
 * Every equipment choice group the draft's class and background own, with its options (disabled
 * with a reason when the player lacks a required proficiency) and the player's current pick.
 */
export function equipmentGroups(
  rules: EquipmentRules,
  draft: Pick<CharacterDraft, 'class' | 'background' | 'equipment'>,
  resolved: ResolvedFeatures
): EquipmentGroup[] {
  const owners: [EquipmentOwner, string | null][] = [
    ['class', draft.class],
    ['background', draft.background]
  ]
  const groups: EquipmentGroup[] = []
  for (const [ownerType, ownerSlug] of owners) {
    if (!ownerSlug) continue
    const owner = (ownerType === 'class' ? rules.classes : rules.backgrounds).find(
      (o) => o.slug === ownerSlug
    )
    for (const g of owner?.choiceGroups ?? []) {
      if (g.kind !== 'equipment') continue
      const key = `${ownerType}/${ownerSlug}/${g.key}`
      const options = g.options.map((o, index): EquipmentOption => {
        const lines = o.items.flatMap((i) => describeLine(rules, i) ?? [])
        const slots = lines.flatMap((l) =>
          l.kind === 'wildcard' ? Array(l.count).fill(l.category) : []
        )
        let disabled: string | null = null
        for (const i of o.items) {
          if (i.type === 'equipment' && i.requiresProficiency) {
            if (!isProficient(rules, resolved, i.requiresProficiency, i.equipment)) {
              const prof = rules.proficiencies.find((p) => p.slug === i.requiresProficiency)
              disabled = `Requires proficiency with ${prof?.name ?? i.requiresProficiency}.`
            }
          }
        }
        return { index, label: lines.map(lineLabel).join(', '), lines, slots, disabled }
      })
      groups.push({
        key,
        ownerType,
        ownerSlug,
        ownerName: owner?.name ?? ownerSlug,
        label: options.map((o) => o.label).join(' or '),
        options,
        pick: draft.equipment[key] ?? null
      })
    }
  }
  return groups
}

/** The fixed class items and background package: given, not chosen. Shown read-only. */
export function fixedEquipment(
  rules: EquipmentRules,
  draft: Pick<CharacterDraft, 'class' | 'background'>
): FixedEquipment[] {
  const out: FixedEquipment[] = []
  const sources: [EquipmentOwner, string | null][] = [
    ['class', draft.class],
    ['background', draft.background]
  ]
  for (const [source, slug] of sources) {
    const owner = (source === 'class' ? rules.classes : rules.backgrounds).find(
      (o) => o.slug === slug
    )
    if (!owner || owner.startingEquipment.length === 0) continue
    out.push({
      source,
      ownerName: owner.name,
      items: owner.startingEquipment.map((e) => ({
        item: e.item,
        name: nameOf(rules, e.item),
        quantity: e.quantity
      }))
    })
  }
  return out
}

/** Why a group's pick is not good yet, or null when it is. `attention` means it was once legal. */
function groupProblem(
  rules: EquipmentRules,
  g: EquipmentGroup
): { state: 'incomplete' | 'attention'; issue: string } | null {
  if (!g.pick) return { state: 'incomplete', issue: `Choose an option for: ${g.label}.` }
  const option = g.options[g.pick.option]
  if (!option) {
    return {
      state: 'attention',
      issue: `The ${g.ownerName} choice "${g.label}" no longer exists; choose again.`
    }
  }
  if (option.disabled) {
    return {
      state: 'attention',
      issue: `${option.label}: ${option.disabled} Choose another option.`
    }
  }
  for (let i = 0; i < option.slots.length; i++) {
    const item = g.pick.wild[i] ?? null
    if (!item) return { state: 'incomplete', issue: `Pick an item for ${option.label}.` }
    if (!categoryItems(rules, option.slots[i]).some((c) => c.slug === item)) {
      return {
        state: 'attention',
        issue: `${nameOf(rules, item)} is not a legal pick for ${option.label}.`
      }
    }
  }
  return null
}

/** Step validity: every group has an option and every wildcard slot a legal item. */
export function validateEquipment({ rules, draft, resolved }: StepContext): StepValidation {
  const issues: string[] = []
  let attention = false
  for (const g of equipmentGroups(rules, draft, resolved)) {
    const problem = groupProblem(rules, g)
    if (!problem) continue
    issues.push(problem.issue)
    if (problem.state === 'attention') attention = true
  }
  return { state: attention ? 'attention' : issues.length ? 'incomplete' : 'valid', issues }
}

/** The stored rows (`CharacterInput.equipment`): one per distinct item per group, merged by quantity. */
export function equipmentRows(
  rules: EquipmentRules,
  draft: Pick<CharacterDraft, 'class' | 'background' | 'equipment'>,
  resolved: ResolvedFeatures
): EquipmentRow[] {
  const rows: EquipmentRow[] = []
  for (const g of equipmentGroups(rules, draft, resolved)) {
    const option = g.pick ? g.options[g.pick.option] : undefined
    if (!g.pick || !option) continue
    const add = (item: string, quantity: number) => {
      const row = rows.find((r) => r.choiceKey === g.key && r.item === item)
      if (row) row.quantity += quantity
      else rows.push({ choiceKey: g.key, item, quantity })
    }
    let slot = 0
    for (const line of option.lines) {
      if (line.kind === 'item') add(line.item, line.count)
      else {
        for (let n = 0; n < line.count; n++) {
          const item = g.pick.wild[slot++]
          if (item) add(item, 1)
        }
      }
    }
  }
  return rows
}

/** Every item slug the Character owns: fixed items plus the picks. Feeds `deriveStats`. */
export function ownedEquipment(
  rules: EquipmentRules,
  draft: Pick<CharacterDraft, 'class' | 'background' | 'equipment'>,
  resolved: ResolvedFeatures
): string[] {
  const slugs = [
    ...fixedEquipment(rules, draft).flatMap((f) => f.items.map((i) => i.item)),
    ...equipmentRows(rules, draft, resolved).map((r) => r.item)
  ]
  return [...new Set(slugs)]
}

/**
 * The equipment part of the wizard's change rules (#89): picks whose group no longer belongs to
 * the draft's class or background are cleared with one notice per owner; a group with a single
 * option is picked for the player (the always-picked focus variants). Picks that still have a
 * group are kept; validation flags the ones that stopped being legal.
 */
export function reconcileEquipment(
  rules: Pick<WizardRules, 'classes' | 'backgrounds' | 'equipment' | 'equipmentCategories'>,
  draft: Pick<CharacterDraft, 'class' | 'background' | 'equipment'>
): { equipment: Record<string, EquipmentPick>; notices: string[] } {
  /** Live group keys; the value is the slot count of a single-option group (auto-picked), else null. */
  const live = new Map<string, number | null>()
  const owners: [EquipmentOwner, string | null][] = [
    ['class', draft.class],
    ['background', draft.background]
  ]
  for (const [ownerType, ownerSlug] of owners) {
    const owner = (ownerType === 'class' ? rules.classes : rules.backgrounds).find(
      (o) => o.slug === ownerSlug
    )
    for (const g of owner?.choiceGroups ?? []) {
      if (g.kind !== 'equipment') continue
      live.set(
        `${ownerType}/${ownerSlug}/${g.key}`,
        g.options.length === 1 ? slotCount(g.options[0].items) : null
      )
    }
  }

  const equipment: Record<string, EquipmentPick> = {}
  const notices: string[] = []
  const cleared = new Set<string>()
  for (const [key, pick] of Object.entries(draft.equipment)) {
    if (live.has(key)) equipment[key] = pick
    else {
      const [ownerType, ownerSlug] = key.split('/')
      const list = ownerType === 'class' ? rules.classes : rules.backgrounds
      cleared.add(list.find((o) => o.slug === ownerSlug)?.name ?? ownerSlug)
    }
  }
  for (const owner of cleared) {
    notices.push(`Cleared your ${owner} equipment choices: they no longer apply.`)
  }

  for (const [key, slots] of live) {
    if (slots === null || equipment[key]) continue
    equipment[key] = { option: 0, wild: Array(slots).fill(null) }
  }
  return { equipment, notices }
}

const slotCount = (items: OptionItem[]) =>
  items.reduce((n, i) => n + (i.type === 'equipmentCategory' ? i.count : 0), 0)
