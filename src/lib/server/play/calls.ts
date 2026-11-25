import { and, asc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { canAct } from '#lib/character/acting.ts'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { OpenCall, RollMode } from '#lib/play/call.ts'
import abilities from '#lib/rules/data/abilities.json'
import skills from '#lib/rules/data/skills.json'
import { ABILITY_KEYS, type AbilityKey } from '#lib/rules/registry.ts'
import type { ChannelEvent } from '../bridge/channels'
import { createCharacterService } from '../character/service'
import { loadWizardRules } from '../character/wizard-rules'
import type { Database, Queryable } from '../db/connect'
import {
  call,
  CALL_KINDS,
  callPart,
  campaign,
  character,
  type CheckResult,
  type Sequence
} from '../db/schema'
import type { Dice } from '../dice'
import { ToolError } from '../tools/contract'
import { orderText, recordInitiative } from './combat'
import { applyDeathSave } from './death'
import { logEvent, setAwaitingNarration } from './log'
import { characterRefs } from './scene'
import { nextStep, rollStep, sequenceText } from './sequences'

/**
 * The DC for each difficulty tier, from the SRD's "Typical Difficulty Classes" table
 * (`rule:ability-checks` in the Rules Data). Server-only: no DC ever reaches a Player payload.
 */
export const DC_BY_TIER = { easy: 10, medium: 15, hard: 20, 'very hard': 25 } as const
export const TIERS = Object.keys(DC_BY_TIER) as (keyof typeof DC_BY_TIER)[]
export type Tier = keyof typeof DC_BY_TIER

const SKILL_NAMES = new Map(skills.map((s) => [s.slug, s.name]))
export const ABILITY_NAMES = new Map(abilities.map((a) => [a.slug, a.fullName]))

const skillSlug = z
  .string()
  .transform((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
  .refine((s) => SKILL_NAMES.has(s), { message: `Expected a skill: ${[...SKILL_NAMES.keys()]}` })

export const saveKey = z
  .string()
  .transform((s) => {
    const key = s.trim().toLowerCase()
    return (ABILITY_KEYS.find((k) => k === key || ABILITY_NAMES.get(k)?.toLowerCase() === key) ??
      key) as AbilityKey
  })
  .refine((s) => (ABILITY_KEYS as readonly string[]).includes(s), {
    message: `Expected an ability: ${ABILITY_KEYS}`
  })

/** One Check: one Character or several (each with its own roll), a skill or a save, a tier. */
const checkSpec = z
  .object({
    kind: z.literal('check'),
    character: z
      .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
      .describe('Character name or char: handle, or several, each rolling'),
    skill: skillSlug.optional().describe('Skill slug, such as sleight-of-hand'),
    save: saveKey.optional().describe('Ability for a saving throw, such as dex'),
    tier: z.enum(TIERS).describe('Difficulty; code turns it into the DC'),
    adv: z.enum(['advantage', 'disadvantage']).optional(),
    reason: z.string().trim().min(1).describe('Why the roll, shown to the Player')
  })
  .refine((c) => (c.skill === undefined) !== (c.save === undefined), {
    message: 'Name exactly one of skill or save'
  })

const questionSpec = z.object({
  kind: z.literal('question'),
  text: z.string().trim().min(1),
  choices: z.array(z.string().trim().min(1)).optional().describe('Buttons; free text without')
})

/**
 * `narrate`'s `call`: a pending Call id from an action tool, an inline question, or inline Checks
 * (one, or a list for different rolls from several Characters).
 */
export const callInput = z.union([
  z.string().min(1).describe('Pending Call id from an action tool'),
  questionSpec,
  checkSpec,
  z.array(checkSpec).min(1)
])
export type CallInput = z.infer<typeof callInput>

type CharacterRow = typeof character.$inferSelect
type CallKind = (typeof CALL_KINDS)[number]

const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The Character a Call names: by id, by name, or by `char:<name>` handle. */
function findCharacter(db: Queryable, ref: string): CharacterRow {
  const key = slug(ref.replace(/^char:/, ''))
  const found = db
    .select()
    .from(character)
    .all()
    .find((c) => c.id === ref || slug(c.name) === key)
  if (!found) {
    throw new ToolError(
      'unknown_character',
      `No Character is called ${ref}`,
      'Name a Character in the Party and call narrate again'
    )
  }
  if (!canAct(found)) {
    throw new ToolError(
      'character_cannot_act',
      `${found.name} can't act`,
      'Call on a Character who can act'
    )
  }
  return found
}

function openCallRow(db: Queryable) {
  return db.select().from(call).where(eq(call.state, 'open')).get()
}

/** What a part rolls, as the Player reads it. */
function labelOf(
  part: {
    skill: string | null
    save: string | null
    sequence?: Sequence | null
  },
  kind?: CallKind
): string | null {
  if (kind === 'initiative') return 'Initiative'
  if (kind === 'death_save') return 'Death save'
  if (part.sequence) return part.sequence.label
  if (part.skill) return `${SKILL_NAMES.get(part.skill) ?? part.skill} check`
  if (part.save) return `${ABILITY_NAMES.get(part.save) ?? part.save} save`
  return null
}

/**
 * Opens a Call in the Narration's transaction. A Call ends the turn; only one is open at a time.
 * Returns its id.
 */
export function openCall(
  db: Queryable,
  input: CallInput,
  { at, openedBy }: { at: number; openedBy: number | null }
): string {
  if (openCallRow(db)) {
    throw new ToolError(
      'call_open',
      'A Call is already open, waiting on the Players',
      'Wait for its call_result, or narrate without a call'
    )
  }
  if (typeof input === 'string') return attachPending(db, input, openedBy)
  const id = db
    .insert(call)
    .values({
      campaignId: db.select({ id: campaign.id }).from(campaign).get()!.id,
      kind: Array.isArray(input) ? 'check' : input.kind,
      text: !Array.isArray(input) && input.kind === 'question' ? input.text : null,
      choices: !Array.isArray(input) && input.kind === 'question' ? (input.choices ?? []) : [],
      openedBy,
      createdAt: at
    })
    .returning({ id: call.id })
    .get().id

  const parts =
    !Array.isArray(input) && input.kind === 'question'
      ? playersAtTable(db).map((player) => ({ player }))
      : (Array.isArray(input) ? input : [input]).flatMap((check) =>
          [check.character].flat().map((ref) => {
            const who = findCharacter(db, ref)
            return {
              characterId: who.id,
              player: who.controllingPlayer,
              skill: check.skill ?? null,
              save: check.save ?? null,
              tier: check.tier,
              dc: DC_BY_TIER[check.tier],
              mode: (check.adv ?? 'normal') as RollMode,
              reason: check.reason
            }
          })
        )
  parts.forEach((part, i) => {
    db.insert(callPart)
      .values({ ...part, callId: id, position: i + 1 })
      .run()
  })
  return id
}

/** Opens a pending Call an action tool made: the Narration attaching it shows it to the Players. */
function attachPending(db: Queryable, id: string, openedBy: number | null): string {
  const attached = db
    .update(call)
    .set({ state: 'open', openedBy })
    .where(and(eq(call.id, id), eq(call.state, 'pending')))
    .returning({ id: call.id })
    .get()
  if (!attached) {
    throw new ToolError(
      'unknown_call',
      `No pending Call has the id ${id}`,
      'Attach a pending Call id an action tool returned, or pass the Call inline'
    )
  }
  return attached.id
}

/**
 * One part of a pending Call for one Character, addressed to its Controlling Player: a roll
 * sequence, or (for an initiative Call) none.
 */
export type PendingPart = {
  characterId: string
  player: string
  sequence: Sequence | null
  mode?: RollMode
  reason?: string | null
}

/**
 * Stores an action tool's roll sequences as a pending Call, hidden from the Players until the
 * closing `narrate(..., call: id)` attaches it. Returns its id.
 */
export function createPendingCall(
  db: Queryable,
  parts: PendingPart[],
  at: number,
  kind: 'roll_sequence' | 'initiative' | 'death_save' = 'roll_sequence'
): string {
  const id = db
    .insert(call)
    .values({
      campaignId: db.select({ id: campaign.id }).from(campaign).get()!.id,
      kind,
      state: 'pending',
      createdAt: at
    })
    .returning({ id: call.id })
    .get().id
  parts.forEach((part, i) => {
    db.insert(callPart)
      .values({
        callId: id,
        position: i + 1,
        characterId: part.characterId,
        player: part.player,
        sequence: part.sequence,
        mode: part.mode ?? 'normal',
        reason: part.reason ?? null
      })
      .run()
  })
  return id
}

/** The pending Calls no Narration has attached yet. */
export function pendingCalls(db: Queryable): string[] {
  return db
    .select({ id: call.id })
    .from(call)
    .where(eq(call.state, 'pending'))
    .all()
    .map((c) => c.id)
}

/** Drops a pending Call the DM won't attach; refused for any other Call. */
export function cancelPendingCall(db: Queryable, id: string, at: number) {
  const cancelled = db
    .update(call)
    .set({ state: 'cancelled', closedAt: at })
    .where(and(eq(call.id, id), eq(call.state, 'pending')))
    .returning({ id: call.id })
    .get()
  if (!cancelled) {
    throw new ToolError(
      'unknown_call',
      `No pending Call has the id ${id}`,
      'Only a pending Call an action tool returned, not yet attached, can be cancelled'
    )
  }
}

/** The Players at the table: everyone with a Character who can act (solo play: one). */
function playersAtTable(db: Queryable): string[] {
  const players = new Set(
    db
      .select()
      .from(character)
      .all()
      .filter(canAct)
      .map((c) => c.controllingPlayer)
  )
  return players.size ? [...players] : [SOLO_PLAYER]
}

/** The open Call, Player-safe (no DC, no tier), or null when none is open. */
export function openCallView(db: Queryable): OpenCall | null {
  const open = openCallRow(db)
  if (!open) return null
  const parts = db
    .select({ part: callPart, characterName: character.name })
    .from(callPart)
    .leftJoin(character, eq(character.id, callPart.characterId))
    .where(eq(callPart.callId, open.id))
    .orderBy(asc(callPart.position))
    .all()
  return {
    id: open.id,
    kind: open.kind,
    text: open.text,
    choices: open.choices,
    parts: parts.map(({ part, characterName }) => ({
      id: part.id,
      character: characterName,
      player: part.player,
      label: labelOf(part, open.kind),
      reason: part.reason,
      mode: part.mode,
      answered: part.answeredAt !== null,
      next: part.sequence ? nextStep(part.sequence) : null
    }))
  }
}

/** A closed Floor with Declarations on it withdraws the open Call; returns its id, if any. */
export function withdrawOpenCall(db: Queryable, at: number): string | null {
  const withdrawn = db
    .update(call)
    .set({ state: 'withdrawn', closedAt: at })
    .where(eq(call.state, 'open'))
    .returning({ id: call.id })
    .get()
  return withdrawn?.id ?? null
}

/** The Call or part isn't open (answered, withdrawn or unknown). */
export class CallClosedError extends Error {}

/** The part is addressed to another Player, or the answer doesn't fit it. */
export class CallRefusedError extends Error {}

/** One answered part, as the DM hears it in the call result. */
type Answered = typeof callPart.$inferSelect & { characterName: string | null; kind: CallKind }

/** A completed Call: every part answered. `after` adds lines, such as the Combat's order. */
export type CallResult = { call: string; players: string[]; parts: Answered[]; after?: string[] }

/** The DM's view of one answered part: who, what, the dice, the DC and the outcome. */
function resultLine(p: Answered): string {
  if (p.sequence) return `[${p.characterName} · ${p.player}] ${sequenceText(p.sequence, p.mode)}`
  if (p.result === null) return `[${p.player}] ${p.answer}`
  const r = p.result
  const dice = r.dice.length > 1 ? `${r.dice.join('/')} (${p.mode}) kept ${r.kept}` : `${r.kept}`
  const modifier = r.modifier >= 0 ? `+ ${r.modifier}` : `- ${-r.modifier}`
  if (p.kind === 'death_save') {
    return `[${p.characterName} · ${p.player}] Death save: d20 ${r.kept} → ${p.answer}`
  }
  if (p.kind === 'initiative') {
    return `[${p.characterName} · ${p.player}] Initiative: d20 ${dice} ${modifier} = ${r.total}`
  }
  return `[${p.characterName} · ${p.player}] ${labelOf(p)}: d20 ${dice} ${modifier} = ${r.total} vs DC ${p.dc} (${p.tier}) → ${r.success ? 'success' : 'failure'}`
}

/** The `call_result` channel event: one body line per part, in order. */
export function callResultEvent(result: CallResult): ChannelEvent {
  return {
    content: [...result.parts.map(resultLine), ...(result.after ?? [])].join('\n'),
    meta: { kind: 'call_result', call_id: result.call, players: result.players.join(',') }
  }
}

/**
 * A Campaign's Calls as the Players answer them: each click rolls (or answers) one part in code
 * and logs it; the part that completes the Call sets awaiting Narration and returns the result.
 */
export function createCalls(db: Database, now: () => number = Date.now) {
  function modifierFor(
    characterId: string,
    part: { skill: string | null; save: string | null },
    kind: CallKind
  ) {
    const detail = createCharacterService(db, now).get(characterId)
    if (!detail) return 0
    const { stats } = buildSummary(loadWizardRules(), {
      ...detailToSummaryData(detail),
      equipment: detail.inventory
    })
    if (kind === 'initiative') {
      return stats.initiative.status === 'ok' ? stats.initiative.value : 0
    }
    const stat = part.skill ? stats.skills[part.skill] : stats.savingThrows[part.save as AbilityKey]
    return stat?.status === 'ok' ? stat.value.modifier : 0
  }

  function answer(
    callId: string,
    partId: string,
    player: string,
    resolve: (
      part: typeof callPart.$inferSelect,
      kind: CallKind
    ) => {
      values: Partial<typeof callPart.$inferInsert>
      event: { kind: string; summary: string; data: Record<string, unknown> }
      /** Whether the part is finished; a roll sequence takes several clicks. */
      finished?: boolean
    }
  ): CallResult | null {
    return db.transaction(() => {
      const at = now()
      const open = db
        .select()
        .from(call)
        .where(and(eq(call.id, callId), eq(call.state, 'open')))
        .get()
      const part =
        open &&
        db
          .select()
          .from(callPart)
          .where(
            and(eq(callPart.id, partId), eq(callPart.callId, callId), isNull(callPart.answeredAt))
          )
          .get()
      if (!part) throw new CallClosedError('That Call is no longer open')
      if (part.player !== player) throw new CallRefusedError('That roll is not yours')
      const { values, event, finished = true } = resolve(part, open.kind)
      db.update(callPart)
        .set({ ...values, answeredAt: finished ? at : null })
        .where(eq(callPart.id, partId))
        .run()
      logEvent(db, { tool: 'call', ...event, data: { call: callId, ...event.data } }, { at })

      const parts = db
        .select({ part: callPart, characterName: character.name })
        .from(callPart)
        .leftJoin(character, eq(character.id, callPart.characterId))
        .where(eq(callPart.callId, callId))
        .orderBy(asc(callPart.position))
        .all()
        .map(({ part, characterName }) => ({ ...part, characterName, kind: open.kind }))
      if (parts.some((p) => p.answeredAt === null)) return null
      db.update(call).set({ state: 'answered', closedAt: at }).where(eq(call.id, callId)).run()
      const result: CallResult = {
        call: callId,
        players: [...new Set(parts.map((p) => p.player))],
        parts,
        after: open.kind === 'initiative' ? [orderText(db)] : []
      }
      logEvent(
        db,
        {
          tool: 'call',
          kind: 'call_result',
          summary: callResultEvent(result).content,
          data: { call: callId },
          dmOnly: true
        },
        { at }
      )
      setAwaitingNarration(db, at)
      return result
    })
  }

  /** One click of a roll sequence: code rolls the next step against the hidden number. */
  function rollSequenceStep(part: typeof callPart.$inferSelect, dice: Dice, player: string) {
    const rolled = rollStep(db, part.sequence!, dice, { mode: part.mode, reason: part.reason })
    const name =
      db
        .select({ name: character.name })
        .from(character)
        .where(eq(character.id, part.characterId!))
        .get()?.name ?? ''
    const mode = rolled.roll.kept === null ? 'normal' : part.mode
    return {
      values: { sequence: rolled.sequence },
      finished: rolled.sequence.done,
      event: {
        kind: 'roll',
        summary: `${name} ${rolled.what}: ${rolled.roll.total}${rolled.roll.outcome ? ` (${rolled.roll.outcome})` : ''}`,
        data: {
          part: part.id,
          characterName: name,
          player,
          what: rolled.what,
          mode,
          reason: mode === 'normal' ? null : part.reason,
          dice: rolled.roll.dice,
          modifier: rolled.roll.modifier,
          total: rolled.roll.total,
          outcome: rolled.roll.outcome,
          target: rolled.targetState
        }
      }
    }
  }

  /** A Death save: a d20 with no modifier, its tallies applied by code. */
  function rollDeathSave(part: typeof callPart.$inferSelect, dice: Dice, player: string) {
    const row = db.select().from(character).where(eq(character.id, part.characterId!)).get()!
    const d20 = dice.rollD20()
    const saved = applyDeathSave(db, row, d20.kept)
    const result: CheckResult = {
      dice: d20.dice,
      kept: d20.kept,
      modifier: 0,
      total: d20.kept,
      success: saved.success
    }
    return {
      values: { result, answer: saved.text },
      event: {
        kind: 'roll',
        summary: `${row.name} Death save: ${d20.kept} (${saved.outcome})`,
        data: {
          part: part.id,
          characterName: row.name,
          player,
          what: 'Death save',
          mode: 'normal',
          reason: null,
          ...result,
          outcome: saved.outcome
        }
      }
    }
  }

  return {
    /** The open Call, Player-safe. */
    open: () => openCallView(db),

    /**
     * Rolls one Check part in code for its Controlling Player; returns the Call's result when this
     * roll completes it, null otherwise.
     */
    roll(callId: string, partId: string, dice: Dice, player: string = SOLO_PLAYER) {
      return answer(callId, partId, player, (part, kind) => {
        if (!part.characterId) throw new CallRefusedError('That part is a question: answer it')
        if (part.sequence) return rollSequenceStep(part, dice, player)
        if (kind === 'death_save') return rollDeathSave(part, dice, player)
        const modifier = modifierFor(part.characterId, part, kind)
        const d20 =
          part.mode === 'normal'
            ? dice.rollD20()
            : dice.rollD20({ mode: part.mode, reason: part.reason ?? '' })
        const total = d20.kept + modifier
        const result: CheckResult = {
          dice: d20.dice,
          kept: d20.kept,
          modifier,
          total,
          success: total >= (part.dc ?? 0)
        }
        const name =
          db
            .select({ name: character.name })
            .from(character)
            .where(eq(character.id, part.characterId))
            .get()?.name ?? ''
        const what = labelOf(part, kind) ?? ''
        if (kind === 'initiative') {
          const handle = characterRefs(db).find((c) => c.row.id === part.characterId)?.handle
          if (handle) recordInitiative(db, handle, total)
          return {
            values: { result },
            event: {
              kind: 'roll',
              summary: `${name} ${what}: ${total}`,
              data: {
                part: partId,
                characterName: name,
                player,
                what,
                mode: part.mode,
                reason: part.reason,
                ...result,
                outcome: null
              }
            }
          }
        }
        return {
          values: { result },
          event: {
            kind: 'roll',
            summary: `${name} ${what}: ${total} (${result.success ? 'success' : 'failure'})`,
            data: {
              part: partId,
              characterName: name,
              player,
              what,
              mode: part.mode,
              reason: part.reason,
              ...result
            }
          }
        }
      })
    },

    /** Answers a question part; with choices, the answer must be one of them. */
    answer(callId: string, partId: string, text: string, player: string = SOLO_PLAYER) {
      const clean = text.trim()
      return answer(callId, partId, player, (part) => {
        if (part.characterId) throw new CallRefusedError('That part is a Check: roll it')
        const { choices, text: question } = db.select().from(call).where(eq(call.id, callId)).get()!
        if (!clean) throw new CallRefusedError('Give an answer')
        if (choices.length && !choices.includes(clean)) {
          throw new CallRefusedError(`Answer with one of: ${choices.join(', ')}`)
        }
        return {
          values: { answer: clean },
          event: {
            kind: 'answer',
            summary: `${player}: ${clean}`,
            data: { part: partId, player, question, text: clean }
          }
        }
      })
    }
  }
}

export type Calls = ReturnType<typeof createCalls>
