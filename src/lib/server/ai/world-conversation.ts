import { z } from 'zod'
import {
  GENRE_FLAVORS,
  MAGIC_LEVELS,
  PREMISE_SOFT_CAP,
  SCALES,
  TECH_LEVELS
} from '#lib/world/enums.ts'
import {
  FIELD_LABELS,
  NAME_MAX,
  PREMISE_MAX,
  REPLY_MAX,
  SEED_FIELDS,
  type Seed,
  type SeedField
} from '#lib/world/seed.ts'
import {
  createConversationEngine,
  SUMMARY_MAX,
  type ConversationConfig,
  type TurnInput as EngineTurnInput,
  type TurnResult as EngineTurnResult
} from './conversation-engine.ts'

/**
 * The World creation conversation: the shared engine (`conversation-engine.ts`) with the
 * World's system prompt, turn schema, seed fields and seed prompt. The generic types and
 * helpers are re-exported so World callers keep one import.
 */

export {
  createChatPort,
  MAX_TOKENS,
  SUMMARY_MAX,
  SUMMARY_MAX_TOKENS,
  summarySchema,
  TURN_TIMEOUT_MS,
  type ChatMessage,
  type ChatPort,
  type ChatRequest,
  type Compaction,
  type RunTurnOptions,
  type TokenUsage,
  type TurnFailure
} from './conversation-engine.ts'

export type TurnInput = EngineTurnInput<SeedField>
export type TurnResult = EngineTurnResult<SeedField>

export const turnSchema = z.object({
  reply: z.string().max(REPLY_MAX),
  proposals: z.object({
    name: z.string().max(NAME_MAX).optional(),
    premise: z.string().max(PREMISE_MAX).optional(),
    genreFlavor: z.enum(GENRE_FLAVORS).optional(),
    scale: z.enum(SCALES).optional(),
    magicLevel: z.enum(MAGIC_LEVELS).optional(),
    techLevel: z.enum(TECH_LEVELS).optional()
  })
})

const SYSTEM_PROMPT = `You are helping a player create a World: the lasting setting that many tabletop role-playing campaigns can be set in. A World is a place, not a story.
Reply with a short message (a sentence or two) and a "proposals" object holding only the seed fields you want to change.
Seed fields: name (short text), premise, genreFlavor, scale, magicLevel, techLevel (each one of the allowed values).
The premise describes the World itself in a few sentences, ideally 300 to 400 characters and never more than ${PREMISE_SOFT_CAP}: what it is like, what makes it distinctive, and the lasting conditions, powers or tensions that shape life in it. Write it as a description of a place and its present state, in the present tense. Do not write a plot, quest, chosen-one tale or character arc, and do not name protagonists or tell a sequence of events; adventures happen later, inside the World. Stay consistent with the genre flavor, scale, magic level and tech level when they are set.
Leave out fields you do not want to change. When the user gives feedback on a pending proposal, answer with a revised proposal for that same field.
Never repeat a proposal the user dismissed. Respect values the user already set unless asked to change them.`

const SUMMARY_PROMPT = `You compress the earlier part of a World creation conversation so it can continue in a small context.
Write a short summary (a few sentences, under ${SUMMARY_MAX} characters) of the player's intent and direction: tone, themes, what they like and what they reject, and where the conversation is heading.
Include which proposals were dismissed and why they were unwanted. Keep a previous summary's still-relevant points. Do not invent details.`

function seedPrompt(seed: Seed) {
  const lines = SEED_FIELDS.map((f) => `- ${FIELD_LABELS[f]}: ${seed[f] || '(unset)'}`)
  return `Current seed card (the user may have edited it):\n${lines.join('\n')}`
}

const worldConfig: ConversationConfig<SeedField> = {
  systemPrompt: SYSTEM_PROMPT,
  summaryPrompt: SUMMARY_PROMPT,
  turnSchema,
  fields: SEED_FIELDS,
  fieldLabels: FIELD_LABELS,
  seedPrompt
}

export const { buildRequest, runTurn, compactConversation } = createConversationEngine(worldConfig)
