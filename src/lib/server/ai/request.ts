import { z } from 'zod'
import { SEED_FIELDS } from '#lib/world/seed.ts'
import { SUMMARY_MAX } from './world-conversation.ts'

const field = z.enum(SEED_FIELDS)

/** The client resends the whole transcript every turn, so the body is bounded, not trusted. */
export const HISTORY_MAX = 400
const MESSAGE_MAX = 4000

const common = {
  seed: z.object({
    name: z.string().max(2000),
    premise: z.string().max(2000),
    genreFlavor: z.string().max(2000),
    scale: z.string().max(2000),
    magicLevel: z.string().max(2000),
    techLevel: z.string().max(2000)
  }),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(MESSAGE_MAX) }))
    .max(HISTORY_MAX),
  dismissed: z.array(z.object({ field, value: z.string().max(2000) })).max(200),
  pending: z
    .array(z.object({ field, value: z.string().max(2000) }))
    .max(SEED_FIELDS.length * 4)
    .default([]),
  summary: z.string().max(SUMMARY_MAX).optional(),
  summarizedCount: z.number().int().min(0).max(HISTORY_MAX).optional(),
  context: z
    .object({
      limit: z.number().int().min(256).max(10_000_000),
      lastUsedTokens: z.number().int().min(0).max(10_000_000).optional()
    })
    .optional()
}

const coversHistory = (b: { history: unknown[]; summarizedCount?: number }) =>
  (b.summarizedCount ?? 0) <= b.history.length

export const turnRequestSchema = z
  .object({ ...common, message: z.string().trim().min(1).max(MESSAGE_MAX) })
  .refine(coversHistory)

export const compactRequestSchema = z.object(common).refine(coversHistory)
