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

/** Fields the AI may propose, per conversational step. Steps absent here have no AI help yet. */
export const STEP_FIELDS = {
  concept: CONCEPT_FIELDS
} as const satisfies Partial<Record<StepId, readonly string[]>>

export type ConversationStep = keyof typeof STEP_FIELDS
export const CONVERSATION_STEPS = Object.keys(STEP_FIELDS) as [
  ConversationStep,
  ...ConversationStep[]
]

export type CharacterField = (typeof CONCEPT_FIELDS)[number]
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
  backstory: 'Backstory'
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

export const FIELD_CODECS: Record<CharacterField, Codec> = {
  name: text('name'),
  race: slug('race'),
  subrace: slug('subrace'),
  class: slug('class'),
  background: slug('background'),
  alignment: slug('alignment'),
  appearance: text('appearance'),
  personality: text('personality'),
  backstory: text('backstory')
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
