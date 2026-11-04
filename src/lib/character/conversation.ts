import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  methodPatch,
  rollTotal,
  type DraftAbilityMethod
} from './ability-scores.ts'
import type { CharacterDraft } from './draft.ts'
import type { StepId } from './steps.ts'

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

/** Fields the AI may propose, per conversational step. Steps absent here have no AI help yet. */
export const STEP_FIELDS = {
  concept: CONCEPT_FIELDS,
  abilities: ABILITY_FIELDS
} as const satisfies Partial<Record<StepId, readonly string[]>>

export type ConversationStep = keyof typeof STEP_FIELDS
export const CONVERSATION_STEPS = Object.keys(STEP_FIELDS) as [
  ConversationStep,
  ...ConversationStep[]
]

export type CharacterField = (typeof CONCEPT_FIELDS)[number] | (typeof ABILITY_FIELDS)[number]
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
  abilityRolls: 'Roll'
}

export const isConversationStep = (step: string): step is ConversationStep => step in STEP_FIELDS

interface Codec {
  /** Draft value to the engine's string. Empty string means unset. */
  encode: (draft: CharacterDraft) => string
  /** An accepted proposal's string to a draft patch (fed to `wizard.update`). */
  decode: (value: string) => Partial<CharacterDraft>
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
  ...abilityCodecs()
}

/** The engine's seed for the draft: every conversational field as a string. */
export function seedOf(draft: CharacterDraft): Record<CharacterField, string> {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f, FIELD_CODECS[f].encode(draft)])) as Record<
    CharacterField,
    string
  >
}

/** The draft patch for an accepted proposal. */
export const patchFor = (field: string, value: string) =>
  FIELD_CODECS[field as CharacterField].decode(value)

/**
 * The patch for an accepted card given the live draft. A Roll card records the dice like the Roll
 * button: the new rolled set clears assignments made from the old one (only meaningful while the
 * method is rolling).
 */
export function acceptPatch(draft: CharacterDraft, field: string, value: string) {
  const patch = patchFor(field, value)
  if (field === 'abilityRolls' && draft.abilityMethod === 'rolling' && patch.abilityRolls) {
    patch.baseScores = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  }
  return patch
}
