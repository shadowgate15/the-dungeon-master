import { z } from 'zod'
import { CAMPAIGN_SEED_FIELDS } from '#lib/campaign/seed.ts'
import { SEED_FIELDS } from '#lib/world/seed.ts'

/**
 * The body of `POST /api/ai/field`: a discriminated union on `flow`, so each flow brings its
 * own field names and form values. Stateless: the form values, the target field, the mode and,
 * for feedback, the current value and the player's note are the whole request.
 *
 * Further flows (campaign, character) add their own member here and entries in the registry.
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

export const fieldRequestSchema = z.discriminatedUnion('flow', [world, campaign])

export type FieldRequest = z.infer<typeof fieldRequestSchema>
