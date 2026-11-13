import { z } from 'zod'
import type { JournalPosition } from '#lib/memory/journal.ts'
import {
  MEMORY_LIMITS,
  NPC_STATUSES,
  STANCES,
  type NpcStatus,
  type Stance
} from '#lib/memory/enums.ts'
import { callModel, type ChatPort } from '../ai/port.ts'
import { estimateTokens } from '../ai/tokens.ts'
import { transcriptLine, turnMessage } from '../session/context.ts'
import type { Turn } from '../session/service.ts'
import type { OpenBeat } from '../arc/service.ts'
import { buildMemoryBlock } from './context.ts'
import type { MemoryRepository, Provenance } from './repository.ts'

/** The Arc's side of extraction: which Beats may move, and moving one for good. */
export interface BeatProgress {
  openBeats(campaignId: string): OpenBeat[]
  transitionBeat(beatId: string, state: 'reached' | 'abandoned', at: JournalPosition): boolean
}

/**
 * Post-turn memory extraction. After a saved DM turn, one silent, stateless model call proposes
 * deltas (NPC create and update with disposition and knowledge, fact create). The model only
 * proposes: `applyDeltas` validates every item against code rules and persists the valid ones.
 * Rejected items are dropped one by one with a log entry and never count as a failure; only
 * structurally unusable output fails the call.
 */

/** Per-call caps; excess items are dropped. */
export const MAX_NPC_ITEMS = 8
export const MAX_FACT_CREATES = 8
/** Shared by supersede, retire and revive items in one call. */
export const MAX_CORRECTION_ITEMS = 4
/** Beat transitions accepted in one call. */
export const MAX_BEAT_TRANSITIONS = 3

/** After this many failed calls in a row within one Session, extraction stops for that Session. */
export const MEMORY_MAX_FAILURES = 3

export const MEMORY_TIMEOUT_MS = 60_000
export const MEMORY_MAX_TOKENS = 1024

/**
 * The share of the extraction call's remaining budget (context limit minus the reply cap, the
 * instructions, the transcript and the open Beats) that existing records may use. Its own
 * constant, separate from the DM context's share.
 */
export const EXTRACTION_MEMORY_SHARE = 0.5

/** Marks the extraction call's system prompt, so test doubles can tell it from a DM turn. */
export const EXTRACTION_MARKER = 'MEMORY EXTRACTION'

export const EXTRACTION_INSTRUCTIONS = `${EXTRACTION_MARKER}: you keep the notes of a solo Dungeons & Dragons game.
Read the new transcript and propose changes to the notes, as JSON with lists "npcs", "facts" and, rarely, "revives", "supersedes" and "retires". Propose only what the story clearly established. Reply with empty lists when nothing changed.
"npcs": a new named character is {"name", "description", "role", "status", "stance", "note", "knows"} with no "id". To change an existing character, give its "id" from the existing notes and only the fields that changed. "status" is one of ${NPC_STATUSES.join(', ')}. "stance" is how that character feels about the player's Character, one of ${STANCES.join(', ')}; "note" is a short reason. "knows" lists facts the character knows, by fact id or by the exact title of a fact you propose below. A dead character stays dead.
"revives": only when the story explicitly brings a dead character back (resurrection, undeath, a faked death): {"id", "reason", "status"}, with a short "reason" and optional "status" (default alive). Never use "npcs" to change a dead character's status.
"supersedes": a lasting fact that changed: {"id", "reason", "title", "detail", "worldChanging"} where "id" is the existing fact it replaces and the rest describes the new fact.
"retires": a fact that turned out false or irrelevant: {"id", "reason"}. Facts are never edited; only supersede or retire them.
"facts": a new lasting fact about the world, {"title", "detail", "worldChanging"}. "worldChanging" is true only when the player's Character changed the world itself. Never repeat an existing fact.
Keep every text short. Never invent numbers, dice results, hit points or items; the game's code owns those. Never reuse the name of an existing character: update it by id instead.
"beats": only when open story Beats are listed below, a change in one: {"id", "state"} where "id" is from the open Beats and "state" is "reached" or "abandoned". Use "reached" only when the transcript clearly establishes the Beat's outcome as having happened, never when it is only foreshadowed or attempted. Use "abandoned" only when the story made the Beat impossible or irrelevant. Propose at most ${MAX_BEAT_TRANSITIONS}, and never for a Beat not listed.`

const itemList = z.array(z.record(z.string(), z.unknown()))
/** Loose on purpose: each item is validated one by one, so one bad item never fails the call. */
export const extractionSchema = z.object({
  npcs: itemList,
  facts: itemList,
  revives: itemList.default([]),
  supersedes: itemList.default([]),
  retires: itemList.default([]),
  beats: itemList.default([])
})

export type RejectionLog = (entry: {
  kind: 'npc' | 'fact' | 'beat'
  reason: string
  seq: number
}) => void

export const logRejection: RejectionLog = ({ kind, reason, seq }) =>
  console.warn(`[memory] dropped ${kind} proposed in turn ${seq}: ${reason}`)

const norm = (s: string) => s.trim().toLowerCase()

/** A required, trimmed, non-empty string within `max`; otherwise the reason it is rejected. */
function text(value: unknown, field: string, max: number): string | { reject: string } {
  if (typeof value !== 'string' || !value.trim()) return { reject: `${field} is missing` }
  if (value.trim().length > max) return { reject: `${field} is longer than ${max} characters` }
  return value.trim()
}
const isReject = (v: unknown): v is { reject: string } =>
  typeof v === 'object' && v !== null && 'reject' in v

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]) {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : { reject: `${field} is not one of ${allowed.join(', ')}` }
}

/** Reads an optional field: undefined when absent, otherwise validated by `read`. */
function optional<T>(
  item: Record<string, unknown>,
  key: string,
  read: (v: unknown) => T | { reject: string }
) {
  return item[key] === undefined || item[key] === null ? undefined : read(item[key])
}

export interface ApplyContext {
  campaignId: string
  characterId: string
  at: Provenance
  log: RejectionLog
  /** The Arc, when the Campaign has one; without it Beat proposals are all rejected. */
  beats?: BeatProgress
}

/** Validates and persists one call's deltas. Facts go first so NPCs can know them by title. */
export function applyDeltas(
  repo: MemoryRepository,
  ctx: ApplyContext,
  deltas: z.infer<typeof extractionSchema>
): void {
  const reject = (kind: 'npc' | 'fact' | 'beat', reason: string) =>
    ctx.log({ kind, reason, seq: ctx.at.seq })

  const facts = repo.facts(ctx.campaignId)
  const factIdByTitle = new Map(facts.map((f) => [norm(f.title), f.id]))
  const liveFactIds = new Set(facts.filter((f) => f.retiredAt === null).map((f) => f.id))

  deltas.facts.slice(MAX_FACT_CREATES).forEach(() => reject('fact', 'over the per-call cap'))
  for (const item of deltas.facts.slice(0, MAX_FACT_CREATES)) {
    const title = text(item.title, 'title', MEMORY_LIMITS.factTitle)
    if (isReject(title)) {
      reject('fact', title.reject)
      continue
    }
    const detail = optional(item, 'detail', (v) => text(v, 'detail', MEMORY_LIMITS.factDetail))
    if (isReject(detail)) {
      reject('fact', detail.reject)
      continue
    }
    if (item.worldChanging !== undefined && typeof item.worldChanging !== 'boolean') {
      reject('fact', 'worldChanging is not a boolean')
      continue
    }
    if (factIdByTitle.has(norm(title))) {
      reject('fact', 'a fact with this title already exists')
      continue
    }
    const created = repo.createFact(
      ctx.campaignId,
      { title, detail: detail ?? null, worldChanging: item.worldChanging === true },
      ctx.at
    )
    factIdByTitle.set(norm(title), created.id)
    liveFactIds.add(created.id)
  }

  const corrections = { left: MAX_CORRECTION_ITEMS }
  /** Spends one slot of the shared correction cap; false (and a log) when it is used up. */
  const withinCap = (kind: 'npc' | 'fact') => {
    if (corrections.left <= 0) {
      reject(kind, 'over the per-call cap')
      return false
    }
    corrections.left -= 1
    return true
  }
  /** A live fact the item names by id, with a valid reason; otherwise a rejection is logged. */
  const correctable = (item: Record<string, unknown>) => {
    const target = typeof item.id === 'string' ? facts.find((f) => f.id === item.id) : undefined
    if (!target || target.retiredAt !== null) {
      reject('fact', target ? 'fact is already retired' : 'unknown fact id')
      return undefined
    }
    const reason = text(item.reason, 'reason', MEMORY_LIMITS.reason)
    if (isReject(reason)) {
      reject('fact', reason.reject)
      return undefined
    }
    return { target, reason }
  }

  for (const item of deltas.retires) {
    if (!withinCap('fact')) continue
    const found = correctable(item)
    if (found) repo.retireFact(found.target.id, found.reason, ctx.at)
  }

  for (const item of deltas.supersedes) {
    if (!withinCap('fact')) continue
    const found = correctable(item)
    if (!found) continue
    const title = text(item.title, 'title', MEMORY_LIMITS.factTitle)
    const detail = optional(item, 'detail', (v) => text(v, 'detail', MEMORY_LIMITS.factDetail))
    const problem = [title, detail].find(isReject)
    if (isReject(problem)) {
      reject('fact', problem.reject)
      continue
    }
    if (item.worldChanging !== undefined && typeof item.worldChanging !== 'boolean') {
      reject('fact', 'worldChanging is not a boolean')
      continue
    }
    if (factIdByTitle.has(norm(title as string))) {
      reject('fact', 'a fact with this title already exists')
      continue
    }
    const created = repo.createFact(
      ctx.campaignId,
      {
        title: title as string,
        detail: (detail as string | undefined) ?? null,
        worldChanging: item.worldChanging === true
      },
      ctx.at
    )
    repo.supersedeFact(found.target.id, created.id, found.reason, ctx.at)
    factIdByTitle.set(norm(title as string), created.id)
    liveFactIds.delete(found.target.id)
    liveFactIds.add(created.id)
  }

  const npcNames = new Set(repo.npcs(ctx.campaignId).map((n) => norm(n.name)))

  deltas.npcs.slice(MAX_NPC_ITEMS).forEach(() => reject('npc', 'over the per-call cap'))
  for (const item of deltas.npcs.slice(0, MAX_NPC_ITEMS)) {
    const isUpdate = item.id !== undefined && item.id !== null
    const existing = isUpdate ? repo.getNpc(String(item.id)) : undefined
    if (isUpdate && (!existing || existing.campaignId !== ctx.campaignId)) {
      reject('npc', 'unknown npc id')
      continue
    }

    // Fields: required on create, optional on update.
    const read = <T>(key: string, reader: (v: unknown) => T | { reject: string }) =>
      isUpdate ? optional(item, key, reader) : (reader(item[key]) as T | { reject: string })
    const name = isUpdate
      ? optional(item, 'name', (v) => text(v, 'name', MEMORY_LIMITS.name))
      : text(item.name, 'name', MEMORY_LIMITS.name)
    const description = read('description', (v) =>
      text(v, 'description', MEMORY_LIMITS.description)
    )
    const role = optional(item, 'role', (v) => text(v, 'role', MEMORY_LIMITS.role))
    const status = optional(item, 'status', (v) => oneOf<NpcStatus>(v, 'status', NPC_STATUSES))
    const stance = optional(item, 'stance', (v) => oneOf<Stance>(v, 'stance', STANCES))
    const note = optional(item, 'note', (v) => text(v, 'note', MEMORY_LIMITS.note))
    const problem = [name, description, role, status, stance, note].find(isReject)
    if (isReject(problem)) {
      reject('npc', problem.reject)
      continue
    }
    if (item.knows !== undefined && !Array.isArray(item.knows)) {
      reject('npc', 'knows is not a list')
      continue
    }
    if (existing?.status === 'dead' && status !== undefined && status !== 'dead') {
      reject('npc', 'a dead npc stays dead')
      continue
    }
    if (name !== undefined && norm(name as string) !== norm(existing?.name ?? '')) {
      if (npcNames.has(norm(name as string))) {
        reject('npc', 'an npc with this name already exists; update it by id')
        continue
      }
    }

    let target = existing
    if (!target) {
      target = repo.createNpc(
        ctx.campaignId,
        {
          name: name as string,
          description: description as string,
          role: (role as string | undefined) ?? '',
          status: (status as NpcStatus | undefined) ?? 'alive'
        },
        ctx.at
      )
      npcNames.add(norm(target.name))
    } else {
      const changes = {
        ...(name !== undefined && { name: name as string }),
        ...(description !== undefined && { description: description as string }),
        ...(role !== undefined && { role: role as string }),
        ...(status !== undefined && { status: status as NpcStatus })
      }
      if (Object.keys(changes).length > 0) repo.updateNpc(target.id, changes, ctx.at)
      if (changes.name) npcNames.add(norm(changes.name))
    }

    if (stance !== undefined || note !== undefined) {
      const current = repo.dispositions(target.id).find((d) => d.characterId === ctx.characterId)
      repo.setDisposition(
        target.id,
        ctx.characterId,
        {
          stance: (stance as Stance | undefined) ?? current?.stance ?? 'neutral',
          ...(note !== undefined && { note: note as string })
        },
        ctx.at
      )
    }

    for (const ref of (item.knows as unknown[] | undefined) ?? []) {
      const id =
        typeof ref === 'string'
          ? liveFactIds.has(ref)
            ? ref
            : factIdByTitle.get(norm(ref))
          : undefined
      if (id && liveFactIds.has(id)) repo.link(target.id, id)
      else reject('npc', 'knows names a fact that does not exist')
    }
  }

  for (const item of deltas.revives) {
    if (!withinCap('npc')) continue
    const target = typeof item.id === 'string' ? repo.getNpc(item.id) : undefined
    if (!target || target.campaignId !== ctx.campaignId) {
      reject('npc', 'unknown npc id')
      continue
    }
    if (target.status !== 'dead') {
      reject('npc', 'only a dead npc can be revived')
      continue
    }
    const reason = text(item.reason, 'reason', MEMORY_LIMITS.reason)
    const status = optional(item, 'status', (v) => oneOf<NpcStatus>(v, 'status', NPC_STATUSES))
    const problem = [reason, status].find(isReject)
    if (isReject(problem)) {
      reject('npc', problem.reject)
      continue
    }
    if (status === 'dead') {
      reject('npc', 'a revive must leave the npc not dead')
      continue
    }
    repo.updateNpc(target.id, { status: (status as NpcStatus | undefined) ?? 'alive' }, ctx.at)
  }

  // Beats last, judged against what was open before this call: a Beat opened by another
  // transition in the same call stays out of reach until the next one.
  const open = new Set((ctx.beats?.openBeats(ctx.campaignId) ?? []).map((b) => b.id))
  deltas.beats.slice(MAX_BEAT_TRANSITIONS).forEach(() => reject('beat', 'over the per-call cap'))
  for (const item of deltas.beats.slice(0, MAX_BEAT_TRANSITIONS)) {
    const beatId = typeof item.id === 'string' ? item.id : undefined
    if (item.state !== 'reached' && item.state !== 'abandoned') {
      reject('beat', 'state is not reached or abandoned')
    } else if (!beatId || !open.has(beatId)) {
      reject('beat', 'unknown beat id, or a Beat that is not open')
    } else if (!ctx.beats!.transitionBeat(beatId, item.state, ctx.at)) {
      reject('beat', 'beat is not pending')
    } else {
      open.delete(beatId)
    }
  }
}

const EXTRACTION_HEADER = 'Existing notes, each record with its [id]:'

/** The existing records the call sees: the DM context's selection, with ids, over this window. */
function existingRecords(
  repo: MemoryRepository,
  input: ExtractionInput,
  transcript: string,
  beats: readonly OpenBeat[]
) {
  const remaining =
    input.contextLimit -
    MEMORY_MAX_TOKENS -
    estimateTokens(EXTRACTION_INSTRUCTIONS) -
    estimateTokens(transcript) -
    estimateTokens(beats.map((b) => b.description + b.title).join(' '))
  const block = buildMemoryBlock(
    {
      ...repo.snapshot(input.campaignId, input.characterId),
      window: input.turns.map((t) => turnMessage(t).content),
      focus: { sessionId: input.sessionId, seq: input.turns.at(-1)!.seq }
    },
    Math.floor(Math.max(0, remaining) * EXTRACTION_MEMORY_SHARE),
    { ids: true, header: EXTRACTION_HEADER }
  )
  return (
    (block ?? `${EXTRACTION_HEADER} none`) +
    (beats.length
      ? `\n\nOpen story Beats:\n${beats.map((b) => `- [${b.id}] ${b.title}: ${b.description}`).join('\n')}`
      : '')
  )
}

export interface ExtractionInput {
  threadId: string
  campaignId: string
  characterId: string
  sessionId: string
  /** The model's context window, in tokens; sizes the share given to existing records. */
  contextLimit: number
  /** The unextracted Turns, oldest first; never empty. */
  turns: readonly Turn[]
  /** The Arc, when the Campaign has an accepted one: its open Beats go in, transitions come out. */
  beats?: BeatProgress
}

/**
 * One extraction call and its application. Returns true when the call produced usable output
 * (even if every item was rejected), false on any failure: a model error, an abort or timeout,
 * or output that does not parse. Never throws.
 */
export async function runExtraction(
  port: ChatPort,
  repo: MemoryRepository,
  input: ExtractionInput,
  log: RejectionLog = logRejection
): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MEMORY_TIMEOUT_MS)
  try {
    const openBeats = input.beats?.openBeats(input.campaignId) ?? []
    const transcript = input.turns.map(transcriptLine).join('\n\n')
    const result = await callModel(port, {
      systemPrompts: [EXTRACTION_INSTRUCTIONS],
      messages: [
        {
          role: 'user',
          content: `${existingRecords(repo, input, transcript, openBeats)}\n\nNew transcript:\n${transcript}`
        }
      ],
      maxTokens: MEMORY_MAX_TOKENS,
      threadId: input.threadId,
      outputSchema: extractionSchema,
      signal: controller.signal
    })
    if (!result.ok) return false
    const parsed = extractionSchema.safeParse(result.object)
    if (!parsed.success) return false
    applyDeltas(
      repo,
      {
        campaignId: input.campaignId,
        characterId: input.characterId,
        at: { sessionId: input.sessionId, seq: input.turns.at(-1)!.seq },
        log,
        beats: input.beats
      },
      parsed.data
    )
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
