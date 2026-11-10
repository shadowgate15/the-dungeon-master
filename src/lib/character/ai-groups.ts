import { resolveFeatures } from '#lib/rules/resolver.ts'
import type { CharacterDraft, WizardRules } from './draft.ts'
import { resolverDraft } from './draft.ts'
import {
  categoryItems,
  equipmentGroups,
  type EquipmentOption,
  type EquipmentPick
} from './equipment.ts'
import { classSpellOptions, spellAllowance } from './spells.ts'
import { groupLabel } from './steps.ts'

/**
 * The Field AI pick groups (#148): feature choice groups (skills, tools, languages, ...), each
 * equipment choice group, and the class spell lists. Code builds the legal options and owns the
 * counts; the model only chooses among them. Client-safe and pure: the wizard uses it to render
 * and disable the controls, the server uses it to build and check a request.
 *
 * A group's field name carries its key: `picks:<choice key>`, `equipment:<choice key>`,
 * `classSpells:cantrips` or `classSpells:spells`. Granted spells and derived entries have none.
 */

export const PICKS_PREFIX = 'picks:'
export const EQUIPMENT_PREFIX = 'equipment:'
export const CLASS_SPELL_FIELDS = ['classSpells:cantrips', 'classSpells:spells'] as const

/** The value of an equipment group: the option index and the wildcard items, as stored. */
export type EquipmentValue = EquipmentPick
/** What a group field holds and the AI writes: slugs for a pick group, an option for equipment. */
export type GroupValue = string[] | EquipmentValue

export const isGroupField = (field: string): boolean =>
  field.startsWith(PICKS_PREFIX) ||
  field.startsWith(EQUIPMENT_PREFIX) ||
  (CLASS_SPELL_FIELDS as readonly string[]).includes(field)

/** The part of the draft a group depends on. */
export type GroupDraft = Pick<
  CharacterDraft,
  'race' | 'subrace' | 'class' | 'subclass' | 'background' | 'picks' | 'equipment' | 'classSpells'
>

export interface PickGroupDefinition {
  kind: 'picks'
  field: string
  label: string
  /** The exact number of picks required. */
  count: number
  /** The legal options, by slug and name. */
  options: { slug: string; name: string }[]
  current: string[]
  /** Class spell lists need a class. */
  needsClass: boolean
}

export interface EquipmentGroupDefinition {
  kind: 'equipment'
  field: string
  label: string
  /** Every option; the ones with `disabled` set are not legal. */
  options: EquipmentOption[]
  /** The legal item slugs of each wildcard category used by the options. */
  items: Record<string, { slug: string; name: string }[]>
  current: EquipmentPick | null
}

export type GroupDefinition = PickGroupDefinition | EquipmentGroupDefinition

type Rules = WizardRules
const nameIn = (list: readonly { slug: string; name: string }[], slug: string) =>
  list.find((e) => e.slug === slug)?.name ?? slug

const ownerName = (rules: Rules, type: string, slug: string) => {
  const list =
    type === 'class'
      ? rules.classes
      : type === 'race'
        ? rules.races
        : type === 'background'
          ? rules.backgrounds
          : type === 'subclass'
            ? rules.subclasses
            : rules.traits
  return nameIn(list, slug)
}

const levelOf = (rules: Rules, slug: string) => rules.spells.find((s) => s.slug === slug)?.level

/** Spells a class pick may not repeat: granted, or chosen in a racial spell group. */
function takenSpells(rules: Rules, draft: GroupDraft) {
  const resolved = resolveFeatures(rules, resolverDraft(draft as CharacterDraft))
  return new Set([
    ...resolved.grantedSpells.map((s) => s.spell),
    ...resolved.groups.filter((g) => g.kind === 'spell').flatMap((g) => g.picks)
  ])
}

/**
 * The definition of one group field for this draft, or undefined when the draft has no such
 * group (the control has nothing to attach to).
 */
export function groupDefinition(
  rules: Rules,
  draft: GroupDraft,
  field: string
): GroupDefinition | undefined {
  if (field.startsWith(PICKS_PREFIX)) {
    const key = field.slice(PICKS_PREFIX.length)
    const resolved = resolveFeatures(rules, resolverDraft(draft as CharacterDraft))
    const g = resolved.groups.find((x) => x.key === key)
    if (!g || g.kind === 'subclass' || g.kind === 'abilityBonus') return undefined
    const options =
      g.kind === 'spell'
        ? g.options.filter((o) => !o.disabled && !draft.classSpells.includes(o.slug))
        : g.options.filter((o) => !o.disabled)
    return {
      kind: 'picks',
      field,
      label: `${groupLabel(g)} (${ownerName(rules, g.ownerType, g.ownerSlug)})`,
      count: g.choose,
      options: options.map((o) => ({ slug: o.slug, name: o.name })),
      current: draft.picks[key] ?? [],
      needsClass: false
    }
  }
  if (field.startsWith(EQUIPMENT_PREFIX)) {
    const key = field.slice(EQUIPMENT_PREFIX.length)
    const resolved = resolveFeatures(rules, resolverDraft(draft as CharacterDraft))
    const g = equipmentGroups(rules, draft, resolved).find((x) => x.key === key)
    if (!g) return undefined
    const items: EquipmentGroupDefinition['items'] = {}
    for (const o of g.options) {
      for (const category of o.slots) {
        items[category] ??= categoryItems(rules, category)
      }
    }
    return {
      kind: 'equipment',
      field,
      label: `${g.ownerName} equipment: ${g.label}`,
      options: g.options,
      items,
      current: g.pick
    }
  }
  if ((CLASS_SPELL_FIELDS as readonly string[]).includes(field)) {
    const level = field === 'classSpells:cantrips' ? 0 : 1
    const allowance = spellAllowance(rules, draft.class)
    const taken = takenSpells(rules, draft)
    return {
      kind: 'picks',
      field,
      label: level === 0 ? 'Cantrips' : 'Level 1 spells',
      count: level === 0 ? allowance.cantrips : allowance.spells,
      options: classSpellOptions(rules, draft.class, level).filter((s) => !taken.has(s.slug)),
      current: draft.classSpells.filter((s) => levelOf(rules, s) === level),
      needsClass: true
    }
  }
  return undefined
}

/** Why a group cannot be generated now, or undefined when it can. */
export function groupBlockedReason(
  def: GroupDefinition | undefined,
  draft: Pick<CharacterDraft, 'class'>
): string | undefined {
  if (!def) return 'This choice is not available'
  if (def.kind === 'picks') {
    if (def.needsClass && !draft.class) return 'Choose a class first'
    if (def.count === 0) return 'Nothing to pick here'
    if (def.options.length < def.count) return 'Not enough legal options to choose from'
    return undefined
  }
  if (!def.options.some((o) => !o.disabled)) return 'No legal options to choose from'
  return undefined
}

/** The group's value as a readable summary for the control and the prompt; empty when unset. */
export function describeGroupValue(def: GroupDefinition, value: GroupValue | null): string {
  if (!value) return ''
  if (Array.isArray(value)) {
    if (def.kind !== 'picks') return ''
    return value.map((slug) => nameIn(def.options, slug)).join(', ')
  }
  if (def.kind !== 'equipment') return ''
  const option = def.options[value.option]
  if (!option) return ''
  const named = Object.values(def.items).flat()
  const wild = value.wild.filter((w): w is string => !!w).map((slug) => nameIn(named, slug))
  return wild.length ? `${option.label} (${wild.join(', ')})` : option.label
}

/** The current value of a group field in the draft, or null/empty when unset. */
export function currentGroupValue(def: GroupDefinition): GroupValue | null {
  if (def.kind === 'equipment') return def.current
  return def.current.length ? def.current : null
}

/**
 * The draft patch that writes `value` into a group field. Class spell lists replace only their
 * own level, keeping the other level's picks.
 */
export function applyGroupValue(
  rules: Rules,
  draft: GroupDraft,
  field: string,
  value: GroupValue
): Partial<CharacterDraft> {
  if (field.startsWith(PICKS_PREFIX)) {
    return { picks: { ...draft.picks, [field.slice(PICKS_PREFIX.length)]: value as string[] } }
  }
  if (field.startsWith(EQUIPMENT_PREFIX)) {
    return {
      equipment: {
        ...draft.equipment,
        [field.slice(EQUIPMENT_PREFIX.length)]: value as EquipmentPick
      }
    }
  }
  const level = field === 'classSpells:cantrips' ? 0 : 1
  return {
    classSpells: [
      ...draft.classSpells.filter((s) => levelOf(rules, s) !== level),
      ...(value as string[])
    ]
  }
}
