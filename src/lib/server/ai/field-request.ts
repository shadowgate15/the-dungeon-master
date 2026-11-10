import { z } from 'zod'
import { CAMPAIGN_SEED_FIELDS } from '#lib/campaign/seed.ts'
import { CHARACTER_AI_FIELDS } from '#lib/character/ai-fields.ts'
import { CLASS_SPELL_FIELDS, EQUIPMENT_PREFIX, PICKS_PREFIX } from '#lib/character/ai-groups.ts'
import { SEED_FIELDS } from '#lib/world/seed.ts'

/**
 * The body of `POST /api/ai/field`: a discriminated union on `flow`, so each flow brings its
 * own field names and form values. Stateless: the form values, the target field, the mode and,
 * for feedback, the current value and the player's note are the whole request.
 *
 */

const VALUE_MAX = 2000
const NOTE_MAX = 1000

const common = {
  mode: z.enum(['generate', 'feedback']),
  /** Feedback only: the field's current value. */
  current: z.string().max(VALUE_MAX).optional(),
  /** Feedback only: what the player wants changed. */
  note: z.string().max(NOTE_MAX).optional()
}

const world = z.object({
  flow: z.literal('world'),
  field: z.enum(SEED_FIELDS),
  /** The World seed's live values; an empty string means unset. */
  values: z.object(
    Object.fromEntries(SEED_FIELDS.map((f) => [f, z.string().max(VALUE_MAX)])) as Record<
      (typeof SEED_FIELDS)[number],
      z.ZodString
    >
  ),
  ...common
})

/** The Worlds are sent as ids; the server loads their Seeds and checks they are still active. */
const WORLD_IDS_MAX = 100

const campaign = z.object({
  flow: z.literal('campaign'),
  field: z.enum(CAMPAIGN_SEED_FIELDS),
  /** The Campaign seed's live values; an empty string means unset. */
  values: z.object(
    Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, z.string().max(VALUE_MAX)])) as Record<
      (typeof CAMPAIGN_SEED_FIELDS)[number],
      z.ZodString
    >
  ),
  worldIds: z.array(z.string().max(200)).max(WORLD_IDS_MAX),
  ...common
})

/**
 * The Character draft is browser-only, so the form values travel with the request: Rules Data
 * slugs for race, subrace, class, background and alignment, text for the rest. The server
 * resolves slugs to names for the prompt. Empty means unset.
 */
const GROUP_KEY_MAX = 200
const GROUP_ITEMS_MAX = 100
const slugList = z.array(z.string().max(GROUP_KEY_MAX)).max(GROUP_ITEMS_MAX)

/**
 * A pick group's field name carries its key (`picks:<key>`, `equipment:<key>`, or a class spell
 * list); the group's own choices travel in `choices` so the server can build its legal options.
 */
const groupField = z
  .string()
  .max(GROUP_KEY_MAX)
  .refine(
    (f) =>
      (f.startsWith(PICKS_PREFIX) && f.length > PICKS_PREFIX.length) ||
      (f.startsWith(EQUIPMENT_PREFIX) && f.length > EQUIPMENT_PREFIX.length) ||
      (CLASS_SPELL_FIELDS as readonly string[]).includes(f),
    'Unknown group field'
  )

/** The draft's pick groups: feature picks, equipment picks and class spells. */
const choices = z
  .object({
    picks: z.record(z.string().max(GROUP_KEY_MAX), slugList),
    equipment: z.record(
      z.string().max(GROUP_KEY_MAX),
      z.object({
        option: z.number().int().min(0).max(GROUP_ITEMS_MAX),
        wild: z.array(z.string().max(GROUP_KEY_MAX).nullable()).max(GROUP_ITEMS_MAX)
      })
    ),
    classSpells: slugList
  })
  .default({ picks: {}, equipment: {}, classSpells: [] })

const character = z.object({
  flow: z.literal('character'),
  field: z.union([z.enum(CHARACTER_AI_FIELDS), groupField]),
  choices,
  values: z.object(
    Object.fromEntries(CHARACTER_AI_FIELDS.map((f) => [f, z.string().max(VALUE_MAX)])) as Record<
      (typeof CHARACTER_AI_FIELDS)[number],
      z.ZodString
    >
  ),
  ...common
})

export const fieldRequestSchema = z.discriminatedUnion('flow', [world, campaign, character])

export type FieldRequest = z.infer<typeof fieldRequestSchema>
