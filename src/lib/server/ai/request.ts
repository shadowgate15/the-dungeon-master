import { z } from 'zod'
import { CAMPAIGN_SEED_FIELDS } from '#lib/campaign/seed.ts'
import { ABILITY_KEYS } from '#lib/character/ability-scores.ts'
import { ALL_FIELDS, CONVERSATION_STEPS } from '#lib/character/conversation.ts'
import { LIMITS } from '#lib/character/draft.ts'
import { SEED_FIELDS } from '#lib/world/seed.ts'
import { SUMMARY_MAX } from './world-conversation.ts'

/** The client resends the whole transcript every turn, so the body is bounded, not trusted. */
export const HISTORY_MAX = 400
const MESSAGE_MAX = 4000

// Takes `unknown`: the generic body shape (extra keys) defeats a precise parameter type.
const coversHistory = (body: unknown) => {
  const b = body as { history: unknown[]; summarizedCount?: number }
  return (b.summarizedCount ?? 0) <= b.history.length
}

/** Request schemas for one conversation: its seed fields plus any extra body keys. */
function requestSchemas<F extends readonly [string, ...string[]], E extends z.ZodRawShape>(
  fields: F,
  extra: E
) {
  const field = z.enum(fields)
  const common = {
    seed: z.object(
      Object.fromEntries(fields.map((f) => [f, z.string().max(2000)])) as Record<
        F[number],
        z.ZodString
      >
    ),
    history: z
      .array(
        z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(MESSAGE_MAX) })
      )
      .max(HISTORY_MAX),
    dismissed: z.array(z.object({ field, value: z.string().max(2000) })).max(200),
    pending: z
      .array(z.object({ field, value: z.string().max(2000) }))
      .max(fields.length * 4)
      .default([]),
    summary: z.string().max(SUMMARY_MAX).optional(),
    summarizedCount: z.number().int().min(0).max(HISTORY_MAX).optional(),
    context: z
      .object({
        limit: z.number().int().min(256).max(10_000_000),
        lastUsedTokens: z.number().int().min(0).max(10_000_000).optional()
      })
      .optional(),
    ...extra
  }
  return {
    turn: z
      .object({ ...common, message: z.string().trim().min(1).max(MESSAGE_MAX) })
      .refine(coversHistory),
    compact: z.object(common).refine(coversHistory)
  }
}

const world = requestSchemas(SEED_FIELDS, {})
export const turnRequestSchema = world.turn
export const compactRequestSchema = world.compact

/** The Worlds are sent as ids; the server loads their Seeds and checks they are still active. */
export const WORLD_IDS_MAX = 100
const campaign = requestSchemas(CAMPAIGN_SEED_FIELDS, {
  worldIds: z.array(z.string().max(200)).max(WORLD_IDS_MAX)
})
export const campaignTurnRequestSchema = campaign.turn
export const campaignCompactRequestSchema = campaign.compact

/**
 * The Character draft is browser-only, so it is sent every turn (with the active step) and
 * bounded here. Unknown keys are stripped: a step that adds draft fields adds them below.
 */
const slugOrNull = z.string().max(100).nullable()
const draftSchema = z.object({
  name: z.string().max(LIMITS.name),
  race: slugOrNull,
  subrace: slugOrNull,
  class: slugOrNull,
  subclass: slugOrNull,
  background: slugOrNull,
  alignment: slugOrNull,
  appearance: z.string().max(LIMITS.appearance * 2),
  personality: z.string().max(LIMITS.personality * 2),
  backstory: z.string().max(LIMITS.backstory * 2),
  // Ability scores (#118)
  abilityMethod: z.enum(['standard-array', 'point-buy', 'rolling']).nullable().optional(),
  baseScores: z
    .object(
      Object.fromEntries(
        ABILITY_KEYS.map((k) => [k, z.number().int().min(0).max(30).nullable()])
      ) as Record<(typeof ABILITY_KEYS)[number], z.ZodNullable<z.ZodNumber>>
    )
    .optional(),
  abilityRolls: z
    .array(z.array(z.number().int().min(1).max(6)).length(4))
    .max(6)
    .nullable()
    .optional()
})
const character = requestSchemas(ALL_FIELDS as unknown as readonly [string, ...string[]], {
  step: z.enum(CONVERSATION_STEPS),
  draft: draftSchema
})
export const characterTurnRequestSchema = character.turn
export const characterCompactRequestSchema = character.compact
