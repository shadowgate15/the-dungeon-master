import {
  GENRE_FLAVORS,
  MAGIC_LEVELS,
  PREMISE_SOFT_CAP,
  SCALES,
  TECH_LEVELS
} from '#lib/world/enums.ts'
import { FIELD_LABELS, NAME_MAX, SEED_FIELDS, type SeedField } from '#lib/world/seed.ts'

/**
 * The server-side field registry, keyed by flow and field. Each entry says how one
 * AI-suited field is generated: its label (used in the context block), the instruction the
 * model gets, its kind (which fixes the one-key output schema) and, for choice fields, the
 * legal options for a request. Adding an AI-suited field means adding an entry here.
 *
 * Text fields carry a structural length instruction (a sentence count plus a character
 * ceiling), never a schema `maxLength`: a hard cut mid-sentence is worse than trimming.
 */

interface BaseSpec {
  label: string
  /** What the model is asked to write, including any structural length wording. */
  instruction: string
}

/** Free text: `{ value }`. Over `maxChars` is trimmed to the last sentence boundary. */
export interface TextFieldSpec extends BaseSpec {
  kind: 'text'
  maxChars: number
}

/** A single slug from `options(values)`: `{ value }` constrained to those slugs. */
export interface EnumFieldSpec extends BaseSpec {
  kind: 'enum'
  /** The legal slugs for a request; an empty list means the field cannot be generated now. */
  options: (values: Record<string, string>) => readonly string[]
}

export type FieldSpec = TextFieldSpec | EnumFieldSpec

/** `flow -> field -> spec`. Key order is the order of the "other fields" context block. */
export type FieldRegistry = Record<string, Record<string, FieldSpec>>

const choice = (
  field: SeedField,
  options: readonly string[],
  instruction: string
): EnumFieldSpec => ({
  kind: 'enum',
  label: FIELD_LABELS[field],
  instruction,
  options: () => options
})

const WORLD: Record<SeedField, FieldSpec> = {
  name: {
    kind: 'text',
    label: FIELD_LABELS.name,
    instruction: `Write the name of the World: one name of 2 to 4 words, about 25 characters, never more than ${NAME_MAX}. A name only, not a sentence.`,
    maxChars: NAME_MAX
  },
  premise: {
    kind: 'text',
    label: FIELD_LABELS.premise,
    instruction: `Write the premise of the World: exactly 3 sentences, about 350 characters, never more than ${PREMISE_SOFT_CAP}. Describe the World itself in the present tense: what it is like, what makes it distinctive, and the lasting conditions, powers or tensions that shape life in it. Do not write a plot, quest or chosen-one tale, and do not name protagonists; adventures happen later, inside the World.`,
    maxChars: PREMISE_SOFT_CAP
  },
  genreFlavor: choice(
    'genreFlavor',
    GENRE_FLAVORS,
    'Choose the genre flavor that best fits the World.'
  ),
  scale: choice(
    'scale',
    SCALES,
    'Choose the scale of the World, from a single region up to planar.'
  ),
  magicLevel: choice('magicLevel', MAGIC_LEVELS, 'Choose how prevalent magic is in the World.'),
  techLevel: choice('techLevel', TECH_LEVELS, 'Choose the technology level of the World.')
}

export const FIELD_REGISTRY: FieldRegistry = {
  world: Object.fromEntries(SEED_FIELDS.map((f) => [f, WORLD[f]]))
}
