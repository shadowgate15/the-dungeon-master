import { LIMITS } from './draft.ts'

/**
 * The Character fields with a Field AI control that this module covers: the Concept text fields,
 * the Rules Data slug fields, and the custom background's name and feature. Client-safe: shared by
 * the wizard's controls, the request schema and the server registry. Pick groups and abilities
 * are separate buttons (#148, #149) and extend this list.
 */
export const CHARACTER_AI_FIELDS = [
  'name',
  'race',
  'subrace',
  'class',
  'background',
  'alignment',
  'appearance',
  'personality',
  'ideal',
  'bond',
  'flaw',
  'backstory',
  'customBackgroundName',
  'customBackgroundFeature'
] as const

export type CharacterAiField = (typeof CHARACTER_AI_FIELDS)[number]

/** The form's live value of every AI field as a string; an empty string means unset. */
export type CharacterAiValues = Record<CharacterAiField, string>

export const CHARACTER_AI_LABELS: Record<CharacterAiField, string> = {
  name: 'Name',
  race: 'Race',
  subrace: 'Subrace',
  class: 'Class',
  background: 'Background',
  alignment: 'Alignment',
  appearance: 'Appearance',
  personality: 'Personality traits',
  ideal: 'Ideal',
  bond: 'Bond',
  flaw: 'Flaw',
  backstory: 'Backstory',
  customBackgroundName: 'Background name',
  customBackgroundFeature: 'Background feature'
}

/** Fields whose draft value is a Rules Data slug (or null) rather than text. */
export const CHARACTER_SLUG_FIELDS = [
  'race',
  'subrace',
  'class',
  'background',
  'alignment'
] as const

/** The maximum length of each text field, from the data model. */
export const CHARACTER_TEXT_LIMITS = {
  name: LIMITS.name,
  appearance: LIMITS.appearance,
  personality: LIMITS.personality,
  ideal: LIMITS.ideal,
  bond: LIMITS.bond,
  flaw: LIMITS.flaw,
  backstory: LIMITS.backstory,
  customBackgroundName: LIMITS.customBackgroundName,
  customBackgroundFeature: LIMITS.customBackgroundFeature
} as const
