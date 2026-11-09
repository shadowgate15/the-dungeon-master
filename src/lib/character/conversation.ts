import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  methodPatch,
  rollTotal,
  validateAbilityScores,
  type DraftAbilityMethod
} from './ability-scores.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { resolverDraft, type CharacterDraft, type WizardRules } from './draft.ts'
import { equipmentGroups, type EquipmentPick } from './equipment.ts'
import { skillsStepGroups, type StepId } from './steps.ts'

/**
 * Client-safe vocabulary of the Character creation conversation (#116), shared by the panel and
 * the server module. One conversation spans every step; each turn allows only the active step's
 * fields. Values are Rules Data slugs or short text, never numbers. List values (later steps)
 * are encoded as strings at this edge: add `encode`/`decode` for the field, nothing else changes.
 *
 * EXTENSION POINT (#117, #118): to make a step conversational, add its fields to `STEP_FIELDS`,
 * `FIELD_LABELS` and `FIELD_CODECS` here, then register the step's schema/options/validation on
 * the server (`src/lib/server/ai/character-conversation.ts`, `STEP_MODULES`).
 */

export const CONCEPT_FIELDS = [
  'name',
  'race',
  'subrace',
  'class',
  'background',
  'alignment',
  'appearance',
  'personality',
  'backstory'
] as const

/**
 * Ability scores (#118). `abilityRolls` is never proposed by the model: it is the Roll card the
 * server adds after running `roll_ability_scores`.
 */
export const ABILITY_FIELDS = ['abilityMethod', 'abilityAssignment', 'abilityRolls'] as const

/**
 * Skills & features (#117): feature choices keyed by choice key, as "key=slug,slug; key=slug".
 * Equipment: one pick per equipment choice group, as "key=option:item,item; key=option".
 * Spells: the class cantrips and level 1 spells as one comma-separated list of spell slugs.
 */
export const SKILLS_FIELDS = ['featurePicks'] as const
export const EQUIPMENT_FIELDS = ['equipmentPicks'] as const
export const SPELL_FIELDS = ['classSpells'] as const

/** Fields the AI may propose, per conversational step. Steps absent here have no AI help yet. */
export const STEP_FIELDS = {
  concept: CONCEPT_FIELDS,
  abilities: ABILITY_FIELDS,
  skills: SKILLS_FIELDS,
  equipment: EQUIPMENT_FIELDS,
  spells: SPELL_FIELDS
} as const satisfies Partial<Record<StepId, readonly string[]>>

export type ConversationStep = keyof typeof STEP_FIELDS
export const CONVERSATION_STEPS = Object.keys(STEP_FIELDS) as [
  ConversationStep,
  ...ConversationStep[]
]

export type CharacterField =
  | (typeof CONCEPT_FIELDS)[number]
  | (typeof ABILITY_FIELDS)[number]
  | (typeof SKILLS_FIELDS)[number]
  | (typeof EQUIPMENT_FIELDS)[number]
  | (typeof SPELL_FIELDS)[number]
/** Every proposable field across all steps (request schemas and labels cover all of them). */
export const ALL_FIELDS: readonly CharacterField[] = Object.values(STEP_FIELDS).flat()

export const FIELD_LABELS: Record<CharacterField, string> = {
  name: 'Name',
  race: 'Race',
  subrace: 'Subrace',
  class: 'Class',
  background: 'Background',
  alignment: 'Alignment',
  appearance: 'Appearance',
  personality: 'Personality traits',
  backstory: 'Backstory',
  abilityMethod: 'Ability score method',
  abilityAssignment: 'Ability score assignment',
  abilityRolls: 'Roll',
  featurePicks: 'Skills and features',
  equipmentPicks: 'Starting equipment',
  classSpells: 'Spells'
}

export const isConversationStep = (step: string): step is ConversationStep => step in STEP_FIELDS

interface Codec {
  /** Draft value to the engine's string. Empty string means unset. */
  encode: (draft: CharacterDraft) => string
  /** An accepted proposal's string to a draft patch (fed to `wizard.update`). */
  decode: (value: string, draft?: CharacterDraft) => Partial<CharacterDraft>
}

const text = (key: 'name' | 'appearance' | 'personality' | 'backstory'): Codec => ({
  encode: (d) => d[key],
  decode: (v) => ({ [key]: v })
})
const slug = (key: 'race' | 'subrace' | 'class' | 'background' | 'alignment'): Codec => ({
  encode: (d) => d[key] ?? '',
  decode: (v) => ({ [key]: v })
})

// --- Ability scores (#118) ----------------------------------------------------------------------

export const ABILITY_METHODS: readonly DraftAbilityMethod[] = [
  'standard-array',
  'point-buy',
  'rolling'
]

/** "str=15, dex=14, ..." (every ability, in order); empty while any is unassigned. */
export const encodeAssignment = (scores: CharacterDraft['baseScores']) =>
  ABILITY_KEYS.every((k) => scores[k] !== null)
    ? ABILITY_KEYS.map((k) => `${k}=${scores[k]}`).join(', ')
    : ''

/** The scores of an assignment string, or null when it is not six `key=integer` pairs. */
export function parseAssignment(value: string): CharacterDraft['baseScores'] | null {
  const scores: CharacterDraft['baseScores'] = {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null
  }
  const parts = value.split(',').map((p) => p.trim())
  if (parts.length !== ABILITY_KEYS.length) return null
  for (const part of parts) {
    const m = /^([a-z]{3})=(\d{1,2})$/.exec(part)
    if (!m || !(ABILITY_KEYS as readonly string[]).includes(m[1])) return null
    const key = m[1] as (typeof ABILITY_KEYS)[number]
    if (scores[key] !== null) return null
    scores[key] = Number(m[2])
  }
  return scores
}

/** Rolled dice as "6,5,4,1;3,3,2,1;..." (roll order, every die). */
export const encodeRolls = (rolls: readonly (readonly number[])[]) =>
  rolls.map((r) => r.join(',')).join(';')

export function parseRolls(value: string): number[][] | null {
  const rolls = value.split(';').map((r) => r.split(',').map(Number))
  return rolls.every((r) => r.every((d) => Number.isInteger(d))) ? rolls : null
}

/** The Roll card's text: each roll's dice and total, readable without the codec. */
export function formatCardValue(field: string, value: string): string {
  if (field === 'abilityRolls') {
    const rolls = parseRolls(value)
    if (!rolls) return value
    return rolls
      .map((dice, i) => `Roll ${i + 1}: ${dice.join(' + ')} (drop lowest) = ${rollTotal(dice)}`)
      .join('\n')
  }
  if (field === 'abilityAssignment') {
    const scores = parseAssignment(value)
    if (scores) {
      return ABILITY_KEYS.map((k) => `${ABILITY_LABELS[k]} ${scores[k]}`).join('\n')
    }
  }
  return value
}

// --- Skills & features, equipment, spells (#117) -------------------------------------------------

const splitList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** Splits "key=rest; key=rest" into pairs, or null when any part has no key or value. */
function parseKeyed(value: string): [string, string][] | null {
  const out: [string, string][] = []
  for (const part of value.split(';')) {
    const m = /^\s*([A-Za-z0-9][A-Za-z0-9/_-]*)\s*=\s*(.*?)\s*$/.exec(part)
    if (!m) return null
    out.push([m[1], m[2]])
  }
  return out
}

export const encodeFeaturePicks = (picks: CharacterDraft['picks']) =>
  Object.entries(picks)
    .filter(([, slugs]) => slugs.length > 0)
    .map(([key, slugs]) => `${key}=${slugs.join(',')}`)
    .join('; ')

/** Picked option slugs by choice key, or null when the value is not "key=slug,slug; ..." */
export function parseFeaturePicks(value: string): CharacterDraft['picks'] | null {
  const pairs = parseKeyed(value)
  if (!pairs) return null
  const picks: CharacterDraft['picks'] = {}
  for (const [key, rest] of pairs) {
    if (key in picks) return null
    const slugs = splitList(rest)
    if (slugs.length === 0) return null
    picks[key] = slugs
  }
  return picks
}

export const encodeEquipmentPicks = (equipment: CharacterDraft['equipment']) =>
  Object.entries(equipment)
    .map(([key, p]) => {
      const wild = p.wild.map((w) => w ?? '').join(',')
      return `${key}=${p.option}${wild.replace(/,/g, '') ? `:${wild}` : ''}`
    })
    .join('; ')

/** Equipment picks by choice key, or null when the value is not "key=option:item,item; ..." */
export function parseEquipmentPicks(value: string): Record<string, EquipmentPick> | null {
  const pairs = parseKeyed(value)
  if (!pairs) return null
  const out: Record<string, EquipmentPick> = {}
  for (const [key, rest] of pairs) {
    if (key in out) return null
    const m = /^(\d{1,2})(?::(.*))?$/.exec(rest)
    if (!m) return null
    out[key] = {
      option: Number(m[1]),
      wild: m[2] === undefined ? [] : m[2].split(',').map((s) => s.trim() || null)
    }
  }
  return out
}

function skillsCodecs(): Record<
  (typeof SKILLS_FIELDS | typeof EQUIPMENT_FIELDS | typeof SPELL_FIELDS)[number],
  Codec
> {
  return {
    featurePicks: {
      encode: (d) => encodeFeaturePicks(d.picks),
      decode: (v, d) => {
        const picks = parseFeaturePicks(v)
        return picks ? { picks: { ...d?.picks, ...picks } } : {}
      }
    },
    equipmentPicks: {
      encode: (d) => encodeEquipmentPicks(d.equipment),
      decode: (v, d) => {
        const equipment = parseEquipmentPicks(v)
        return equipment ? { equipment: { ...d?.equipment, ...equipment } } : {}
      }
    },
    classSpells: {
      encode: (d) => d.classSpells.join(','),
      decode: (v) => ({ classSpells: splitList(v) })
    }
  }
}

function abilityCodecs(): Record<(typeof ABILITY_FIELDS)[number], Codec> {
  return {
    abilityMethod: {
      encode: (d) => d.abilityMethod ?? '',
      decode: (v) => methodPatch(v as DraftAbilityMethod)
    },
    abilityAssignment: {
      encode: (d) => encodeAssignment(d.baseScores),
      decode: (v) => {
        const baseScores = parseAssignment(v)
        return baseScores ? { baseScores } : {}
      }
    },
    abilityRolls: {
      encode: (d) => (d.abilityRolls ? encodeRolls(d.abilityRolls) : ''),
      decode: (v) => {
        const abilityRolls = parseRolls(v)
        return abilityRolls ? { abilityRolls } : {}
      }
    }
  }
}

export const FIELD_CODECS: Record<CharacterField, Codec> = {
  name: text('name'),
  race: slug('race'),
  subrace: slug('subrace'),
  class: slug('class'),
  background: slug('background'),
  alignment: slug('alignment'),
  appearance: text('appearance'),
  personality: text('personality'),
  backstory: text('backstory'),
  ...abilityCodecs(),
  ...skillsCodecs()
}

/** The engine's seed for the draft: every conversational field as a string. */
export function seedOf(draft: CharacterDraft): Record<CharacterField, string> {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f, FIELD_CODECS[f].encode(draft)])) as Record<
    CharacterField,
    string
  >
}

/** The draft patch for an accepted proposal. */
export const patchFor = (field: string, value: string, draft?: CharacterDraft) =>
  FIELD_CODECS[field as CharacterField].decode(value, draft)

/**
 * The patch for an accepted card given the live draft. A Roll card records the dice like the Roll
 * button: the new rolled set clears assignments made from the old one (only meaningful while the
 * method is rolling).
 */
export function acceptPatch(draft: CharacterDraft, field: string, value: string) {
  const patch = patchFor(field, value, draft)
  if (field === 'abilityRolls' && draft.abilityMethod === 'rolling' && patch.abilityRolls) {
    patch.baseScores = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  }
  return patch
}

// --- Pending cards dropped by an earlier change (#117) -------------------------------------------

interface CardRef {
  field: string
  value: string
}

/**
 * For each pending card, true when an earlier change made it impossible to accept as proposed:
 * its choice key or option no longer exists, a spell left the class list, the subrace no longer
 * fits the race, an arrangement no longer fits the method. The caller drops those cards (they are
 * not dismissals, so the model is not told to avoid them). A pending card that supplies the thing
 * another card depends on (a race card beside its subrace card) keeps the dependent card alive.
 */
export function staleCards(
  rules: WizardRules,
  draft: CharacterDraft,
  cards: readonly CardRef[]
): boolean[] {
  const pending = (field: string) => cards.find((c) => c.field === field)?.value
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  return cards.map(({ field, value }) => {
    switch (field) {
      case 'subrace': {
        const race = pending('race') ?? draft.race
        return rules.subraces.find((s) => s.slug === value)?.race !== race
      }
      case 'abilityAssignment': {
        const scores = parseAssignment(value)
        const method = (pending('abilityMethod') ??
          draft.abilityMethod) as DraftAbilityMethod | null
        if (!scores || !method) return true
        const rolls = pending('abilityRolls')
          ? parseRolls(pending('abilityRolls')!)
          : draft.abilityRolls
        return validateAbilityScores(method, scores, rolls).issues.length > 0
      }
      case 'featurePicks': {
        const picks = parseFeaturePicks(value)
        if (!picks) return true
        const groups = skillsStepGroups(resolved)
        return Object.entries(picks).some(([key, slugs]) => {
          const g = groups.find((x) => x.key === key)
          return !g || slugs.some((slug) => !g.options.some((o) => o.slug === slug))
        })
      }
      case 'equipmentPicks': {
        const picks = parseEquipmentPicks(value)
        if (!picks) return true
        const groups = equipmentGroups(rules, draft, resolved)
        return Object.entries(picks).some(([key, pick]) => {
          const g = groups.find((x) => x.key === key)
          return (
            !g ||
            !g.options[pick.option] ||
            (g.options[pick.option].slots.length !== pick.wild.length && pick.wild.length > 0)
          )
        })
      }
      case 'classSpells': {
        const slugs = splitList(value)
        if (slugs.length === 0) return true
        return slugs.some((slug) => {
          const spell = rules.spells.find((x) => x.slug === slug)
          return !spell || spell.level > 1 || !draft.class || !spell.classes.includes(draft.class)
        })
      }
      default:
        return false
    }
  })
}
