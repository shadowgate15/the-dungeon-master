import { and, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { LENGTHS, TONES } from '#lib/campaign/enums.ts'
import {
  CAMPAIGN_FIELD_LABELS,
  CAMPAIGN_SEED_FIELDS,
  type CampaignSeedFields,
  type CampaignSeedField
} from '#lib/campaign/seed.ts'
import { PREMISE_SOFT_CAP } from '#lib/world/enums.ts'
import { FIELD_LABELS, NAME_MAX, PREMISE_MAX, REPLY_MAX, SEED_FIELDS } from '#lib/world/seed.ts'
import type { Database } from '../db/connect'
import { world } from '../db/schema'
import {
  createConversationEngine,
  SUMMARY_MAX,
  type CompactResult,
  type ConversationConfig,
  type ChatPort,
  type RunTurnOptions,
  type TurnInput,
  type TurnResult
} from './conversation-engine.ts'

/**
 * The Campaign creation conversation: the shared engine with the Campaign's system prompt,
 * turn schema and seed fields. The selected Worlds' Seeds are loaded from the database on
 * every turn into one extra system prompt (never the transcript or summary); a World that
 * is archived or missing fails the turn with `worlds-changed` before any model call.
 */

export const campaignTurnSchema = z.object({
  reply: z.string().max(REPLY_MAX),
  proposals: z.object({
    name: z.string().max(NAME_MAX).optional(),
    premise: z.string().max(PREMISE_MAX).optional(),
    tone: z.enum(TONES).optional(),
    length: z.enum(LENGTHS).optional()
  })
})

const SYSTEM_PROMPT = `You are helping a player create a Campaign: a story played out in one or more Worlds. The Worlds already exist and are described separately; a Campaign is a story, not a place.
Reply with a short message (a sentence or two) and a "proposals" object holding only the seed fields you want to change.
Seed fields: name (short text), premise, tone, length (each of the last two one of the allowed values). You never choose or change the Worlds; the player does.
The premise is a story hook in a few sentences, ideally 300 to 400 characters and never more than ${PREMISE_SOFT_CAP}: a goal, a threat and a stake. It must fit the Worlds the Campaign is set in. Do not name protagonists and do not script a sequence of events; the players decide who they are and what happens.
Tone is the mood of play: heroic (bold deeds, clear stakes), lighthearted (humor and warmth), tense (suspense and danger), dark (grim, costly, morally heavy), mysterious (secrets and discovery), epic (grand scale, world-shaping events).
Length is the scope of the story, not hours: one-shot (a single sitting), short (a few sessions), medium (a season of play), long (an open-ended saga).
Leave out fields you do not want to change. When the user gives feedback on a pending proposal, answer with a revised proposal for that same field.
Never repeat a proposal the user dismissed. Respect values the user already set unless asked to change them.`

const SUMMARY_PROMPT = `You compress the earlier part of a Campaign creation conversation so it can continue in a small context.
Write a short summary (a few sentences, under ${SUMMARY_MAX} characters) of the player's intent and direction: tone, themes, what they like and what they reject, and where the conversation is heading.
Include which proposals were dismissed and why they were unwanted. Keep a previous summary's still-relevant points. Do not invent details.`

function seedPrompt(seed: CampaignSeedFields) {
  const lines = CAMPAIGN_SEED_FIELDS.map(
    (f) => `- ${CAMPAIGN_FIELD_LABELS[f]}: ${seed[f] || '(unset)'}`
  )
  return `Current Campaign seed card (the user may have edited it):\n${lines.join('\n')}`
}

const engine = createConversationEngine<CampaignSeedField>({
  systemPrompt: SYSTEM_PROMPT,
  summaryPrompt: SUMMARY_PROMPT,
  turnSchema: campaignTurnSchema,
  fields: CAMPAIGN_SEED_FIELDS,
  fieldLabels: CAMPAIGN_FIELD_LABELS,
  seedPrompt
} satisfies ConversationConfig<CampaignSeedField>)

type WorldRow = typeof world.$inferSelect

function worldsPrompt(worlds: WorldRow[]) {
  if (worlds.length === 0) {
    return 'Worlds this Campaign is set in: none selected yet. Do not invent a setting; keep proposals general.'
  }
  const blocks = worlds.map((w) => {
    const lines = SEED_FIELDS.map((f) => `  - ${FIELD_LABELS[f]}: ${w[f] || '(unset)'}`)
    return `- World:\n${lines.join('\n')}`
  })
  return `Worlds this Campaign is set in (stay consistent with them and never propose changes to them):\n${blocks.join('\n')}`
}

const WORLDS_CHANGED = {
  ok: false,
  failure: {
    kind: 'worlds-changed',
    message: 'A selected World was archived or deleted. Reload the Worlds and try again.'
  }
} as const

export type CampaignTurnInput = TurnInput<CampaignSeedField> & { worldIds: string[] }

/** Loads the Worlds in the order requested; null when any is archived or missing. */
function loadActiveWorlds(db: Database, ids: string[]): WorldRow[] | null {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const rows = db
    .select()
    .from(world)
    .where(and(inArray(world.id, unique), isNull(world.archivedAt)))
    .all()
  if (rows.length !== unique.length) return null
  return unique.map((id) => rows.find((w) => w.id === id)!)
}

export const buildCampaignRequest = engine.buildRequest

export async function runCampaignTurn(
  port: ChatPort,
  db: Database,
  { worldIds, ...input }: CampaignTurnInput,
  options?: RunTurnOptions
): Promise<TurnResult<CampaignSeedField>> {
  const worlds = loadActiveWorlds(db, worldIds)
  if (!worlds) return WORLDS_CHANGED
  return engine.runTurn(port, { ...input, extraSystemPrompts: [worldsPrompt(worlds)] }, options)
}

/** The summary never includes the Worlds, so compaction needs neither the database nor the ids. */
export function compactCampaignConversation(
  port: ChatPort,
  input: TurnInput<CampaignSeedField> & { worldIds?: string[] },
  options?: RunTurnOptions
): Promise<CompactResult> {
  const { worldIds: _ignored, ...rest } = input
  void _ignored
  return engine.compactConversation(port, rest, options)
}
