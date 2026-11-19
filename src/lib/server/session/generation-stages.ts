import { z } from 'zod'
import {
  nameSlug,
  normalizeName,
  validateDisposition,
  validateExitName,
  validateNpc,
  validatePlace
} from '#lib/memory/validate.ts'
import type { Attitude } from '#lib/session/enums.ts'
import { NO_DIGITS_RULE } from '#lib/memory/prompts.ts'
import { callModel, type ChatPort } from '../ai/port.ts'

/**
 * Pieces shared by the staged place and NPC generators (first Scene, and the destination of a
 * first move): schemas, role prompt, the validating stage runner with one retry, and the code-side
 * checks and caps. UI-free; the model is reached only through the injected `ChatPort`.
 */

export const MAX_TOKENS = 1500

/** Count caps. Tunable. Items over a cap are dropped, never a reason to fail. */
export const FIRST_SCENE_MAX = { exits: 4, objects: 5, npcs: 3, objectText: 80, situation: 400 }
export const MIN_EXITS = 2

export interface PlaceDraft {
  place: { name: string; description: string }
  /** Exit names with the ids code assigned. */
  exits: { id: string; name: string }[]
  objects: string[]
}

export interface NpcDraft {
  name: string
  nameKey: string
  description: string
  role: string
  attitude: Attitude
  knowledge: string
}

export const placeSchema = z.object({
  name: z.string(),
  description: z.string(),
  exits: z.array(z.string()),
  objects: z.array(z.string())
})
export const npcsSchema = z.object({
  npcs: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      role: z.string(),
      attitude: z.string(),
      knowledge: z.string()
    })
  )
})

const NOT_JSON = 'the answer was not the requested JSON object'

export const ROLE =
  'You are the Dungeon Master of a tabletop role-playing game, preparing its opening Scene. Reply with only the JSON object requested. ' +
  NO_DIGITS_RULE

export type StageOutcome<T> = { ok: true; value: T } | { ok: false; message: string }
export type Verdict<T> = { ok: true; value: T } | { ok: false; problem: string }

/**
 * One stage: a structured call, checked by `check`, retried once with the problem named. Returns
 * the failure message of the model when it errors outright (no retry: the model is unavailable).
 */
export async function runStage<T>(
  port: ChatPort,
  signal: AbortSignal,
  stage: { system: string[]; ask: string; schema: z.ZodObject; check: (raw: unknown) => Verdict<T> }
): Promise<StageOutcome<T>> {
  let problem = ''
  for (let tries = 0; tries < 2; tries++) {
    const call = await callModel(port, {
      systemPrompts: stage.system,
      messages: [
        {
          role: 'user',
          content: problem
            ? `${stage.ask} Your previous answer was rejected: ${problem}`
            : stage.ask
        }
      ],
      maxTokens: MAX_TOKENS,
      threadId: crypto.randomUUID(),
      outputSchema: stage.schema,
      signal
    })
    if (signal.aborted) return { ok: false, message: 'The request was stopped' }
    if (!call.ok) {
      if (call.failure.kind !== 'invalid-output') {
        return { ok: false, message: call.failure.message }
      }
      problem = NOT_JSON
      continue
    }
    const parsed = stage.schema.safeParse(call.object)
    const verdict = parsed.success
      ? stage.check(parsed.data)
      : { ok: false as const, problem: NOT_JSON }
    if (verdict.ok) return verdict
    problem = verdict.problem
  }
  return { ok: false, message: `the model did not return a usable answer: ${problem}` }
}

/** Keeps the first `max` distinct, valid items (by `key`); the rest are dropped. */
export function keep<T>(items: T[], max: number, key: (item: T) => string | null): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (k === null || !k || seen.has(k)) continue
    seen.add(k)
    out.push(item)
    if (out.length === max) break
  }
  return out
}

export function checkPlace(raw: unknown, minExits: number = MIN_EXITS): Verdict<PlaceDraft> {
  const data = raw as z.infer<typeof placeSchema>
  const place = validatePlace({ name: data.name, description: data.description })
  if (!place.ok) return { ok: false, problem: place.reason }
  const exits: { id: string; name: string }[] = []
  for (const name of data.exits) {
    const check = validateExitName(name)
    if (check.ok) exits.push({ id: nameSlug(check.value), name: check.value })
  }
  const kept = keep(exits, FIRST_SCENE_MAX.exits, (e) => e.id)
  if (kept.length < minExits) {
    return {
      ok: false,
      problem: `the place needs at least ${minExits} exits with distinct, valid names (no digits)`
    }
  }
  const objects = keep(
    data.objects.map((o) => o.trim()),
    FIRST_SCENE_MAX.objects,
    (o) => (o.length <= FIRST_SCENE_MAX.objectText ? normalizeName(o) : null)
  )
  return { ok: true, value: { place: place.value, exits: kept, objects } }
}

export function checkNpcs(raw: unknown, takenKeys: Iterable<string> = []): Verdict<NpcDraft[]> {
  const data = raw as z.infer<typeof npcsSchema>
  const taken = new Set<string>(takenKeys)
  const npcs: NpcDraft[] = []
  for (const item of data.npcs) {
    if (npcs.length === FIRST_SCENE_MAX.npcs) break
    const npc = validateNpc(item, { takenKeys: taken })
    const disposition = validateDisposition({ stance: item.attitude, note: item.knowledge })
    if (!npc.ok || !disposition.ok) continue
    taken.add(npc.value.nameKey)
    npcs.push({
      ...npc.value,
      attitude: disposition.value.stance,
      knowledge: disposition.value.note
    })
  }
  return { ok: true, value: npcs }
}
