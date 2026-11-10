import {
  CHARACTER_AI_FIELDS,
  CHARACTER_AI_LABELS,
  CHARACTER_TEXT_LIMITS,
  type CharacterAiField
} from '#lib/character/ai-fields.ts'
import {
  describeGroupValue,
  groupBlockedReason,
  groupDefinition,
  isGroupField,
  type EquipmentGroupDefinition
} from '#lib/character/ai-groups.ts'
import { emptyDraft } from '#lib/character/draft.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { ABILITY_LABELS, type DraftAbilityMethod } from '#lib/character/ability-scores.ts'
import { LENGTHS, TONES } from '#lib/campaign/enums.ts'
import { CAMPAIGN_FIELD_LABELS, CAMPAIGN_SEED_FIELDS } from '#lib/campaign/seed.ts'
import {
  GENRE_FLAVORS,
  MAGIC_LEVELS,
  PREMISE_SOFT_CAP,
  SCALES,
  TECH_LEVELS
} from '#lib/world/enums.ts'
import { loadWizardRules } from '../character/wizard-rules.ts'
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
  /** False when the field means nothing for these values (it is then left out of the context). */
  relevant?: (values: Record<string, string>) => boolean
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
  /** How a legal value reads in the prompt (a Rules Data slug as its name); default the value. */
  display?: (value: string) => string
}

/**
 * Pick groups (#148) are built per request, not listed here: `characterGroupSpec` turns a group
 * field name and the request's draft into one of these. Code holds the count and the legal
 * options; the model only chooses among them.
 */

/** `{ values }`: exactly `count` unique slugs from `options`. */
export interface PicksFieldSpec extends BaseSpec {
  kind: 'picks'
  count: number
  options: { slug: string; name: string }[]
  /** The picks now in the form, to reject an unchanged answer and to show when revising. */
  current: string[]
}

/** `{ option, wild }`: a legal option and one legal item per wildcard slot of that option. */
export interface EquipmentFieldSpec extends BaseSpec {
  kind: 'equipment'
  group: EquipmentGroupDefinition
}

/**
 * An ability arrangement: `{ scores }` of six base scores, validated in code against the chosen
 * method (`arrangementProblem`). Its value is the scores as JSON in ability order.
 */
export interface AbilitiesFieldSpec extends BaseSpec {
  kind: 'abilities'
}

export type FieldSpec =
  TextFieldSpec | EnumFieldSpec | PicksFieldSpec | EquipmentFieldSpec | AbilitiesFieldSpec

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

const campaignChoice = (
  field: 'tone' | 'length',
  options: readonly string[],
  instruction: string
): EnumFieldSpec => ({
  kind: 'enum',
  label: CAMPAIGN_FIELD_LABELS[field],
  instruction,
  options: () => options
})

const CAMPAIGN: Record<(typeof CAMPAIGN_SEED_FIELDS)[number], FieldSpec> = {
  name: {
    kind: 'text',
    label: CAMPAIGN_FIELD_LABELS.name,
    instruction: `Write the name of the Campaign: one name of 2 to 5 words, about 30 characters, never more than ${NAME_MAX}. A name only, not a sentence. A Campaign is a story set in the Worlds listed, so name the story, not the place.`,
    maxChars: NAME_MAX
  },
  premise: {
    kind: 'text',
    label: CAMPAIGN_FIELD_LABELS.premise,
    instruction: `Write the premise of the Campaign: a story hook of 3 to 4 sentences, about 350 characters, never more than ${PREMISE_SOFT_CAP}: a goal, a threat and a stake. It must fit the Worlds the Campaign is set in. Do not name protagonists and do not script a sequence of events; the players decide who they are and what happens.`,
    maxChars: PREMISE_SOFT_CAP
  },
  tone: campaignChoice(
    'tone',
    TONES,
    'Choose the mood of play: heroic (bold deeds, clear stakes), lighthearted (humor and warmth), tense (suspense and danger), dark (grim, costly, morally heavy), mysterious (secrets and discovery) or epic (grand scale, world-shaping events).'
  ),
  length: campaignChoice(
    'length',
    LENGTHS,
    'Choose the scope of the story, not hours: one-shot (a single sitting), short (a few sessions), medium (a season of play) or long (an open-ended saga).'
  )
}

// --- Character ----------------------------------------------------------------------------------

const rules = () => loadWizardRules()
type Named = readonly { slug: string; name: string }[]
const nameIn = (list: Named) => (slug: string) => list.find((e) => e.slug === slug)?.name ?? slug

const characterText = (
  field: CharacterAiField & keyof typeof CHARACTER_TEXT_LIMITS,
  instruction: string,
  relevant?: TextFieldSpec['relevant']
): TextFieldSpec => ({
  kind: 'text',
  label: CHARACTER_AI_LABELS[field],
  instruction: `${instruction} Never more than ${CHARACTER_TEXT_LIMITS[field]} characters.`,
  maxChars: CHARACTER_TEXT_LIMITS[field],
  relevant
})

const characterSlug = (
  field: CharacterAiField,
  instruction: string,
  options: (values: Record<string, string>) => readonly string[],
  display: (slug: string) => string
): EnumFieldSpec => ({
  kind: 'enum',
  label: CHARACTER_AI_LABELS[field],
  instruction,
  options,
  display
})

/** The structural slugs of the request's values, as a draft (empty means unset). */
const slugDraft = (v: Record<string, string>) => ({
  race: v.race || null,
  subrace: v.subrace || null,
  class: v.class || null,
  subclass: v.subclass || null,
  background: v.background || null
})
const METHOD_NAMES: Record<DraftAbilityMethod, string> = {
  'standard-array': 'Standard array',
  'point-buy': 'Point buy',
  rolling: 'Rolling'
}
const METHODS = Object.keys(METHOD_NAMES) as DraftAbilityMethod[]

const isCustom = (values: Record<string, string>) => values.background === 'custom'

const CHARACTER: Record<CharacterAiField, FieldSpec> = {
  name: characterText(
    'name',
    'Write the name of the player character: one fitting name of 1 to 3 words, about 15 characters. A name only, not a sentence.'
  ),
  race: characterSlug(
    'race',
    'Choose the race that best fits the character.',
    () => rules().races.map((r) => r.slug),
    (slug) => nameIn(rules().races)(slug)
  ),
  subrace: characterSlug(
    'subrace',
    'Choose the subrace that best fits the character. It must belong to the chosen race.',
    (v) =>
      rules()
        .subraces.filter((s) => s.race === v.race)
        .map((s) => s.slug),
    (slug) => nameIn(rules().subraces)(slug)
  ),
  class: characterSlug(
    'class',
    'Choose the class that best fits the character.',
    () => rules().classes.map((c) => c.slug),
    (slug) => nameIn(rules().classes)(slug)
  ),
  subclass: characterSlug(
    'subclass',
    'Choose the subclass that best fits the character. It must belong to the chosen class.',
    (v) => {
      const draft = { ...emptyDraft(), ...slugDraft(v) }
      const group = resolveFeatures(rules(), {
        race: draft.race,
        subrace: draft.subrace,
        class: draft.class,
        subclass: null,
        background: draft.background,
        picks: {}
      }).groups.find((g) => g.kind === 'subclass')
      return group ? group.options.map((o) => o.slug) : []
    },
    (slug) => nameIn(rules().subclasses)(slug)
  ),
  background: characterSlug(
    'background',
    'Choose the background that best fits the character. "custom" lets the player write their own.',
    () => rules().backgrounds.map((b) => b.slug),
    (slug) => nameIn(rules().backgrounds)(slug)
  ),
  alignment: characterSlug(
    'alignment',
    'Choose the alignment that best fits the character.',
    () => rules().alignments.map((a) => a.slug),
    (slug) => nameIn(rules().alignments)(slug)
  ),
  appearance: characterText(
    'appearance',
    "Write the character's appearance: exactly 2 sentences, about 200 characters, describing what others notice at a glance."
  ),
  personality: characterText(
    'personality',
    "Write the character's personality traits: exactly 2 sentences, about 200 characters, in the third person."
  ),
  ideal: characterText(
    'ideal',
    "Write the character's ideal: exactly 1 sentence, about 100 characters, the principle they believe in most."
  ),
  bond: characterText(
    'bond',
    "Write the character's bond: exactly 1 sentence, about 120 characters, a person, place or oath they are tied to."
  ),
  flaw: characterText(
    'flaw',
    "Write the character's flaw: exactly 1 sentence, about 120 characters, a weakness or vice that could cause trouble."
  ),
  backstory: characterText(
    'backstory',
    "Write the character's backstory: exactly 4 sentences, about 600 characters, in the third person, covering where they come from and what set them on the road. Stay consistent with the other fields."
  ),
  customBackgroundName: characterText(
    'customBackgroundName',
    "Write the name of the character's custom background (an occupation or upbringing): 1 to 3 words, about 20 characters. A name only.",
    isCustom
  ),
  customBackgroundFeature: characterText(
    'customBackgroundFeature',
    "Write the feature of the character's custom background, given its name: exactly 2 sentences, about 250 characters, describing a social or practical advantage it gives. It has no game mechanics.",
    isCustom
  ),
  abilityMethod: characterSlug(
    'abilityMethod',
    'Choose how the character sets their ability scores: standard-array (assign 15, 14, 13, 12, 10, 8), point-buy (spend 27 points on scores from 8 to 15) or rolling (assign six rolled totals). Choose the method only; scores are set separately.',
    () => METHODS,
    (method) => METHOD_NAMES[method as DraftAbilityMethod] ?? method
  ),
  abilityScores: {
    kind: 'abilities',
    label: CHARACTER_AI_LABELS.abilityScores,
    instruction: `Assign the base scores to the six abilities (${Object.values(ABILITY_LABELS).join(', ')}) so they suit the character, putting the highest scores on the abilities its class relies on. Racial bonuses are added later; do not include them.`,
    relevant: (v) => !!v.abilityMethod
  }
}

export const FIELD_REGISTRY: FieldRegistry = {
  world: Object.fromEntries(SEED_FIELDS.map((f) => [f, WORLD[f]])),
  campaign: Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, CAMPAIGN[f]])),
  character: Object.fromEntries(CHARACTER_AI_FIELDS.map((f) => [f, CHARACTER[f]]))
}

const listNames = (options: { slug: string; name: string }[]) =>
  options.map((o) => (o.name === o.slug ? o.slug : `${o.slug} (${o.name})`)).join(', ')

/** The spec of a Character pick group for this request, or undefined when the draft has no such group. */
export function characterGroupSpec(
  field: string,
  values: Record<string, string>,
  choices: {
    picks: Record<string, string[]>
    equipment: Record<string, { option: number; wild: (string | null)[] }>
    classSpells: string[]
  }
): PicksFieldSpec | EquipmentFieldSpec | undefined {
  if (!isGroupField(field)) return undefined
  const draft = { ...emptyDraft(), ...slugDraft(values), ...choices }
  const def = groupDefinition(rules(), draft, field)
  if (!def) return undefined
  if (groupBlockedReason(def, draft)) return undefined
  if (def.kind === 'picks') {
    return {
      kind: 'picks',
      label: def.label,
      instruction: `Choose exactly ${def.count} different ${def.label.toLowerCase()} that best fit the character. Allowed values (slug, name): ${listNames(def.options)}.`,
      count: def.count,
      options: def.options,
      current: def.current
    }
  }
  const legal = def.options.filter((o) => !o.disabled)
  const lines = legal.map((o) => {
    const slots = o.slots.length
      ? ` (wild: ${o.slots.length} item${o.slots.length === 1 ? '' : 's'}, one from each of: ${o.slots.join(', ')})`
      : ' (wild: none, use an empty list)'
    return `  ${o.index}: ${o.label}${slots}`
  })
  const items = Object.entries(def.items).map(
    ([category, list]) => `  ${category}: ${list.map((i) => i.slug).join(', ')}`
  )
  return {
    kind: 'equipment',
    label: def.label,
    instruction: `Choose the starting equipment option that best fits the character. "option" is the option number; "wild" lists one item slug for each wildcard slot of that option, in order, and is empty when the option has none.\nOptions:\n${lines.join('\n')}${items.length ? `\nAllowed items per wildcard category:\n${items.join('\n')}` : ''}`,
    group: def
  }
}

/** The current value of a group spec as text, for the revise prompt. */
export const describeCurrent = (spec: PicksFieldSpec | EquipmentFieldSpec): string =>
  spec.kind === 'picks'
    ? describeGroupValue(
        {
          kind: 'picks',
          field: '',
          label: '',
          count: spec.count,
          options: spec.options,
          current: spec.current,
          needsClass: false
        },
        spec.current
      )
    : describeGroupValue(spec.group, spec.group.current)
