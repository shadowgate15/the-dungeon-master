import { asc, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import {
  CAMPAIGN_SEED_FIELDS,
  CampaignSeedError,
  campaignSeedCard,
  parseCampaignSeed,
  type CampaignSeed,
  type CampaignSeedField
} from '#lib/campaign/seed.ts'
import { arrangementProblem, rollTotals } from '#lib/character/ability-scores.ts'
import {
  LIMITS,
  changedDraftFields,
  emptyDraft,
  reconcile,
  type CharacterDraft
} from '#lib/character/draft.ts'
import { lengthIssue } from '#lib/character/steps.ts'
import { ABILITY_KEYS } from '#lib/rules/registry.ts'
import { loadWizardRules } from '../character/wizard-rules'
import { SeedLockedError, creationStage, refuseLockedSeed } from '../creation/begin'
import { addConversationLine } from '../creation/conversation'
import { background, campaign, character, characterDraft, classTable, race } from '../db/schema'
import { characterHolders } from '../knowledge/holders'
import { ToolError, creationTool, expectVersion, readTool, type ToolContext } from './contract'
import { SEED_HANDLE, currentSeed, seedView } from './seed-tools'

/** A Character draft's handle: drafts are Entities the DM writes into while the Player creates. */
export const draftHandle = (id: string) => `draft:${id}`

/** How the conversation's muted lines name the Seed fields. */
const SEED_FIELD_NAMES: Record<CampaignSeedField, string> = {
  name: 'name',
  premise: 'premise',
  tone: 'tone',
  length: 'length',
  worldName: 'World name',
  genreFlavor: 'genre flavor',
  scale: 'scale',
  magicLevel: 'magic level',
  techLevel: 'tech level'
}

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** How the conversation's muted lines name the draft fields the DM may set. */
const DRAFT_FIELD_NAMES = {
  name: 'name',
  race: 'race',
  subrace: 'subrace',
  class: 'class',
  subclass: 'subclass',
  background: 'background',
  alignment: 'alignment',
  appearance: 'appearance',
  personality: 'personality traits',
  ideal: 'ideal',
  bond: 'bond',
  flaw: 'flaw',
  backstory: 'backstory',
  customBackgroundName: 'custom background name',
  customBackgroundFeature: 'custom background feature',
  baseScores: 'ability scores'
} as const satisfies Partial<Record<keyof CharacterDraft, string>>

type DraftField = keyof typeof DRAFT_FIELD_NAMES

const STRUCTURE = {
  race: 'races',
  subrace: 'subraces',
  class: 'classes',
  subclass: 'subclasses',
  background: 'backgrounds',
  alignment: 'alignments'
} as const

const TEXT_FIELDS = [
  'name',
  'appearance',
  'personality',
  'ideal',
  'bond',
  'flaw',
  'backstory',
  'customBackgroundName',
  'customBackgroundFeature'
] as const satisfies (keyof typeof LIMITS)[]

const slug = z.string().min(1).nullable()
const score = z.int()

/** The draft fields the DM may set. The Ability Score Method and the rolls are the Player's. */
const draftFields = z.strictObject({
  ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, z.string().optional()])),
  ...Object.fromEntries(Object.keys(STRUCTURE).map((f) => [f, slug.optional()])),
  baseScores: z
    .strictObject(Object.fromEntries(ABILITY_KEYS.map((k) => [k, score])))
    .optional()
    .describe('All six base scores: an arrangement of what the draft’s method gave'),
  abilityMethod: z.unknown().optional().describe('Refused: the Player chooses the method'),
  abilityRolls: z.unknown().optional().describe('Refused: only the wizard rolls')
}) as z.ZodType<
  Partial<Pick<CharacterDraft, DraftField>> & {
    abilityMethod?: unknown
    abilityRolls?: unknown
  }
>

function draftRow({ db }: ToolContext, handle: string) {
  const id = handle.startsWith('draft:') ? handle.slice('draft:'.length) : null
  const found = id && db.select().from(characterDraft).where(eq(characterDraft.id, id)).get()
  if (!found) throw ToolError.unknownHandle(handle)
  return { ...found, draft: { ...emptyDraft(), ...(found.data as CharacterDraft) } }
}

const playerChoice = (message: string) =>
  new ToolError(
    'player_choice',
    message,
    'Ask the Player to make that choice in the Character wizard, then read the draft again'
  )

/** Refuses fields the wizard would not accept; the DM never gets a silent fix. */
function checkDraftFields(
  draft: CharacterDraft,
  fields: Partial<Pick<CharacterDraft, DraftField>> & {
    abilityMethod?: unknown
    abilityRolls?: unknown
  }
) {
  const invalid = (message: string) => ToolError.invalidInput('set_draft_fields', message)
  if (fields.abilityMethod !== undefined || fields.abilityRolls !== undefined) {
    throw playerChoice(
      'The Player chooses the Ability Score Method and the wizard rolls the dice; you may only arrange the values they gave'
    )
  }
  const rules = loadWizardRules()
  for (const [field, collection] of Object.entries(STRUCTURE) as [
    keyof typeof STRUCTURE,
    keyof typeof rules
  ][]) {
    const value = fields[field]
    if (!value) continue
    const known = (rules[collection] as { slug: string }[]).some((e) => e.slug === value)
    if (!known) throw invalid(`Unknown ${field}: ${value}`)
  }
  for (const field of TEXT_FIELDS) {
    const value = fields[field]
    const issue = value === undefined ? null : lengthIssue(field, value)
    if (issue) throw invalid(issue)
  }
  if (fields.baseScores) {
    if (!draft.abilityMethod)
      throw playerChoice('The Player has not chosen an Ability Score Method yet')
    if (draft.abilityMethod === 'rolling' && !draft.abilityRolls?.length) {
      throw playerChoice('The Player has not rolled ability scores yet')
    }
    const problem = arrangementProblem(
      draft.abilityMethod,
      fields.baseScores,
      rollTotals(draft.abilityRolls ?? [])
    )
    if (problem) throw invalid(`Ability scores: ${problem}`)
  }
}

const seedFields = Object.fromEntries(
  CAMPAIGN_SEED_FIELDS.map((f) => [f, z.string().optional()])
) as Record<CampaignSeedField, z.ZodOptional<z.ZodString>>

/** Helping the Player create the Campaign: where creation stands, and the forms' fields. */
export const creationTools = [
  readTool({
    name: 'creation_state',
    description:
      'Where creation stands: seed_incomplete (offer to help with the Seed), party_empty (point the Player to the Character wizard), ready (wait for the Player to press Begin) or begun (play). Also lists the missing Seed fields and the Character drafts.',
    input: z.object({}),
    activity: null,
    run: (ctx) => {
      const { state, missing, characters } = creationStage(ctx.db)
      const drafts = ctx.db
        .select()
        .from(characterDraft)
        .orderBy(asc(characterDraft.createdAt))
        .all()
        .map((d) => ({
          handle: draftHandle(d.id),
          name: (d.data as CharacterDraft).name,
          step: d.step,
          version: d.version
        }))
      return { state, missing, characters, drafts }
    }
  }),

  readTool({
    name: 'party',
    description:
      'The Party as builder needs it: each Character’s handle (char:…), name, level, race, class, background, alignment, appearance, personality, ideal, bond, flaw and backstory. Build the World and the Arc from these.',
    input: z.object({}),
    activity: 'DM reads the Party',
    run: (ctx) => {
      const handles = new Map(characterHolders(ctx.db).map((c) => [c.id, c.handle]))
      const rows = ctx.db
        .select({
          id: character.id,
          name: character.name,
          level: character.level,
          race: race.name,
          class: classTable.name,
          background: background.name,
          customBackground: character.customBackgroundName,
          alignment: character.alignment,
          appearance: character.appearance,
          personality: character.personality,
          ideal: character.ideal,
          bond: character.bond,
          flaw: character.flaw,
          backstory: character.backstory
        })
        .from(character)
        .innerJoin(race, eq(race.id, character.raceId))
        .innerJoin(classTable, eq(classTable.id, character.classId))
        .innerJoin(background, eq(background.id, character.backgroundId))
        .where(ne(character.status, 'departed'))
        .orderBy(asc(character.createdAt))
        .all()
      return {
        characters: rows.map(({ id, customBackground, ...c }) => ({
          handle: handles.get(id),
          ...c,
          background: customBackground ?? c.background
        }))
      }
    }
  }),

  creationTool({
    name: 'set_seed',
    description:
      'Set Campaign Seed fields on the Player’s Seed card, which shows them marked "✎ DM". Pass the version from your last `seed` read; an empty string clears an optional field. Only set what the Player asked for or agreed to.',
    input: z.object({ version: z.int(), ...seedFields }),
    run: (ctx, { version, ...changes }) => {
      const found = currentSeed(ctx)
      expectVersion({ handle: SEED_HANDLE, version: found.version, read: 'seed' }, version)
      if (found.archivedAt !== null) {
        throw new ToolError('archived', 'An archived Campaign cannot be changed', 'Stop here')
      }
      try {
        refuseLockedSeed(found)
      } catch (e) {
        if (!(e instanceof SeedLockedError)) throw e
        throw new ToolError(
          'seed_locked',
          e.message,
          'Leave the Seed as it is; only the Player can Start over'
        )
      }
      let seed: CampaignSeed
      try {
        seed = parseCampaignSeed({ ...campaignSeedCard(found), ...changes })
      } catch (e) {
        if (e instanceof CampaignSeedError) throw ToolError.invalidInput('set_seed', e.message)
        throw e
      }
      const set = CAMPAIGN_SEED_FIELDS.filter((f) => seed[f] !== found[f])
      if (set.length === 0) return { result: seedView(found), changed: [] }
      const saved = ctx.db
        .update(campaign)
        .set({
          ...seed,
          version: found.version + 1,
          dmSeedFields: [...new Set([...found.dmSeedFields, ...set])],
          updatedAt: ctx.now
        })
        .returning()
        .get()
      return {
        result: seedView(saved),
        line: `DM set the Seed’s ${listOf(set.map((f) => SEED_FIELD_NAMES[f]))}`,
        changed: [{ type: 'seed', campaign: ctx.campaignId }]
      }
    }
  }),

  creationTool({
    name: 'reply',
    description:
      'Answer the Player in the DM conversation pane (creation help and out-of-character talk). Out of fiction: it is not Narration and is never logged.',
    input: z.object({ text: z.string().trim().min(1) }),
    run: (ctx, { text }) => {
      addConversationLine(ctx.db, { author: 'dm', text }, ctx.now)
      return {
        result: { replied: true },
        changed: [{ type: 'conversation', campaign: ctx.campaignId }]
      }
    }
  }),

  readTool({
    name: 'draft',
    description:
      'Read a Character draft (handle from creation_state): its fields, version, wizard step, the fields you set ("✎ DM"), and the totals a rolled method gave.',
    input: z.object({ draft: z.string() }),
    activity: null,
    run: (ctx, { draft: handle }) => {
      const found = draftRow(ctx, handle)
      return {
        handle,
        version: found.version,
        step: found.step,
        fields: found.draft,
        dmFields: found.dmFields,
        rolledTotals: found.draft.abilityRolls ? rollTotals(found.draft.abilityRolls) : null
      }
    }
  }),

  creationTool({
    name: 'set_draft_fields',
    description:
      'Set fields of a Character draft in the Player’s open wizard, which shows them marked "✎ DM". Pass the version from your last `draft` read. Slugs as the rules data names them. baseScores only arranges what the Player’s chosen method gave (a permutation of the standard array or of the rolled totals, or a point-buy spend within budget); never set the method or the rolls.',
    input: z.object({ draft: z.string(), version: z.int(), fields: draftFields }),
    run: (ctx, { draft: handle, version, fields }) => {
      const found = draftRow(ctx, handle)
      expectVersion({ handle, version: found.version, read: `draft ${handle}` }, version)
      checkDraftFields(found.draft, fields)
      const settable = Object.fromEntries(
        Object.entries(fields).filter(([k]) => k !== 'abilityMethod' && k !== 'abilityRolls')
      ) as Partial<Pick<CharacterDraft, DraftField>>
      const { draft: next, notices } = reconcile(loadWizardRules(), { ...found.draft, ...settable })
      for (const field of Object.keys(settable) as DraftField[]) {
        if (changedDraftFields({ ...found.draft, ...settable }, next).includes(field)) {
          throw ToolError.invalidInput(
            'set_draft_fields',
            `The ${field} ${String(settable[field])} does not fit the rest of the draft`
          )
        }
      }
      const set = changedDraftFields(found.draft, next).filter((f) => f in settable)
      if (set.length === 0) {
        return { result: { handle, version: found.version, notices }, changed: [] }
      }
      const saved = ctx.db
        .update(characterDraft)
        .set({
          data: next,
          version: found.version + 1,
          dmFields: [...new Set([...found.dmFields, ...set])],
          updatedAt: ctx.now
        })
        .where(eq(characterDraft.id, found.id))
        .returning()
        .get()
      const who = next.name.trim() || 'a new Character'
      return {
        result: { handle, version: saved.version, set, notices },
        line: `DM set ${who}’s ${listOf(set.map((f) => DRAFT_FIELD_NAMES[f as DraftField]))}`,
        changed: [{ type: 'draft', campaign: ctx.campaignId, draft: found.id }]
      }
    }
  })
]
