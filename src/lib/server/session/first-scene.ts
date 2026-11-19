import { z } from 'zod'
import { MEMORY_MAX } from '#lib/memory/enums.ts'
import {
  normalizeName,
  validateDisposition,
  validateExitName,
  validateNpc,
  validatePlace
} from '#lib/memory/validate.ts'
import { ATTITUDES, type Attitude } from '#lib/session/enums.ts'
import { callModel, type ChatPort } from '../ai/port.ts'

/**
 * First Scene generation: three staged structured calls (opening situation, place, NPCs), each
 * validated by code and retried once with the problem named, as `generateArc` does. UI-free; the
 * model is reached only through the injected `ChatPort`. Nothing is stored here: the caller writes
 * the result in one transaction, so a failing stage leaves nothing behind.
 */

export const FIRST_SCENE_TIMEOUT_MS = 240_000
const MAX_TOKENS = 1500

/** Count caps. Tunable. Items over a cap are dropped, never a reason to fail. */
export const FIRST_SCENE_MAX = { exits: 4, objects: 5, npcs: 3, objectText: 80, situation: 400 }
export const MIN_EXITS = 2

export interface FirstSceneInput {
  campaign: { name: string; premise: string; tone: string; length: string }
  /** Every World of the Campaign, in list order. The model sees them all; the first hosts. */
  worlds: { name: string; premise?: string | null }[]
  /** The Arc's first Act and its Beats. */
  act: { name: string; purpose: string; beats: { title: string; description: string }[] }
  character: { name: string; race: string; class: string }
}

export interface FirstSceneDraft {
  place: { name: string; description: string }
  /** Exit names with the ids code assigned. */
  exits: { id: string; name: string }[]
  objects: string[]
  npcs: {
    name: string
    nameKey: string
    description: string
    role: string
    attitude: Attitude
    knowledge: string
  }[]
}

export type FirstSceneResult =
  { ok: true; draft: FirstSceneDraft } | { ok: false; stage: string; message: string }

export interface GenerateFirstSceneOptions {
  signal?: AbortSignal
  /** One deadline for all three stages, retries included. Injectable for tests. */
  timeoutMs?: number
}

const situationSchema = z.object({ situation: z.string() })
const placeSchema = z.object({
  name: z.string(),
  description: z.string(),
  exits: z.array(z.string()),
  objects: z.array(z.string())
})
const npcsSchema = z.object({
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

/** A stable id for an exit from its name: lowercase words joined by hyphens. */
const exitSlug = (name: string) => normalizeName(name).replace(/\s+/g, '-')

function context(input: FirstSceneInput): string {
  const worlds = input.worlds
    .map((w) => `- ${w.name}${w.premise ? `: ${w.premise}` : ''}`)
    .join('\n')
  const beats = input.act.beats.map((b) => `  - ${b.title}: ${b.description}`).join('\n')
  const c = input.campaign
  return [
    `Campaign: ${c.name}. ${c.premise} Tone: ${c.tone}. Length: ${c.length}.`,
    `Worlds it is set in (the opening is in the first one, ${input.worlds[0]?.name ?? 'unknown'}):\n${worlds}`,
    `The Arc's first Act is "${input.act.name}": ${input.act.purpose}\nIts Beats:\n${beats}`,
    `The Character: ${input.character.name}, a ${input.character.race} ${input.character.class}.`
  ].join('\n\n')
}

const ROLE =
  'You are the Dungeon Master of a tabletop role-playing game, preparing its opening Scene. Reply with only the JSON object requested. Never use digits or numerals in any text.'

type StageOutcome<T> = { ok: true; value: T } | { ok: false; message: string }
type Verdict<T> = { ok: true; value: T } | { ok: false; problem: string }

/**
 * One stage: a structured call, checked by `check`, retried once with the problem named. Returns
 * the failure message of the model when it errors outright (no retry: the model is unavailable).
 */
async function runStage<T>(
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
function keep<T>(items: T[], max: number, key: (item: T) => string | null): T[] {
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

function checkPlace(raw: unknown): Verdict<Omit<FirstSceneDraft, 'npcs'>> {
  const data = raw as z.infer<typeof placeSchema>
  const place = validatePlace({ name: data.name, description: data.description })
  if (!place.ok) return { ok: false, problem: place.reason }
  const exits: { id: string; name: string }[] = []
  for (const name of data.exits) {
    const check = validateExitName(name)
    if (check.ok) exits.push({ id: exitSlug(check.value), name: check.value })
  }
  const kept = keep(exits, FIRST_SCENE_MAX.exits, (e) => e.id)
  if (kept.length < MIN_EXITS) {
    return {
      ok: false,
      problem: `the place needs at least ${MIN_EXITS} exits with distinct, valid names (no digits)`
    }
  }
  const objects = keep(
    data.objects.map((o) => o.trim()),
    FIRST_SCENE_MAX.objects,
    (o) => (o.length <= FIRST_SCENE_MAX.objectText ? normalizeName(o) : null)
  )
  return { ok: true, value: { place: place.value, exits: kept, objects } }
}

function checkNpcs(raw: unknown): Verdict<FirstSceneDraft['npcs']> {
  const data = raw as z.infer<typeof npcsSchema>
  const taken = new Set<string>()
  const npcs: FirstSceneDraft['npcs'] = []
  for (const item of data.npcs) {
    if (npcs.length === FIRST_SCENE_MAX.npcs) break
    if (!(ATTITUDES as readonly string[]).includes(item.attitude)) continue
    const npc = validateNpc(item, { takenKeys: taken })
    const disposition = validateDisposition({ stance: item.attitude, note: item.knowledge })
    if (!npc.ok || !disposition.ok) continue
    taken.add(npc.value.nameKey)
    npcs.push({
      ...npc.value,
      attitude: item.attitude as Attitude,
      knowledge: disposition.value.note
    })
  }
  return { ok: true, value: npcs }
}

export async function generateFirstScene(
  port: ChatPort,
  input: FirstSceneInput,
  options: GenerateFirstSceneOptions = {}
): Promise<FirstSceneResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FIRST_SCENE_TIMEOUT_MS)
  const onCancel = () => controller.abort()
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()
  const timedOut = () => !options.signal?.aborted

  const fail = (stage: string, message: string): FirstSceneResult => ({
    ok: false,
    stage,
    message: controller.signal.aborted
      ? timedOut()
        ? 'The model took too long to reply'
        : 'The request was stopped'
      : message
  })

  try {
    const base = context(input)

    const situation = await runStage(port, controller.signal, {
      system: [
        ROLE,
        `${base}\n\nDescribe the opening situation: where the Characters are, what is happening right now, and why they have a reason to act, drawn from the first Act. 1 to 3 sentences, at most ${FIRST_SCENE_MAX.situation} characters. Reply as {"situation": "..."}.`
      ],
      ask: 'Write the opening situation.',
      schema: situationSchema,
      check: (raw) => {
        const text = (raw as z.infer<typeof situationSchema>).situation.trim()
        if (!text) return { ok: false, problem: 'the situation is empty' }
        if (text.length > FIRST_SCENE_MAX.situation) {
          return {
            ok: false,
            problem: `the situation is over ${FIRST_SCENE_MAX.situation} characters`
          }
        }
        return { ok: true, value: text }
      }
    })
    if (!situation.ok) return fail('opening situation', situation.message)

    const placed = await runStage(port, controller.signal, {
      system: [
        ROLE,
        `${base}\n\nOpening situation: ${situation.value}\n\nDescribe the place the Scene is set in, a location in the first World. Give a name (at most ${MEMORY_MAX.placeName} characters), a description (at most ${MEMORY_MAX.placeDescription}), ${MIN_EXITS} to ${FIRST_SCENE_MAX.exits} exit names (each at most ${MEMORY_MAX.exitName} characters, naming where it leads) and up to ${FIRST_SCENE_MAX.objects} notable objects. Reply as {"name", "description", "exits": [...], "objects": [...]}.`
      ],
      ask: 'Write the place.',
      schema: placeSchema,
      check: checkPlace
    })
    if (!placed.ok) return fail('place', placed.message)

    const npcs = await runStage(port, controller.signal, {
      system: [
        ROLE,
        `${base}\n\nOpening situation: ${situation.value}\nThe place: ${placed.value.place.name}. ${placed.value.place.description}\n\nName 0 to ${FIRST_SCENE_MAX.npcs} NPCs present in this place. Each has a name (at most ${MEMORY_MAX.npcName} characters), a description (at most ${MEMORY_MAX.npcDescription}), a role (at most ${MEMORY_MAX.npcRole}), an attitude toward the Character (one of ${ATTITUDES.join(', ')}) and a short knowledge note (at most ${MEMORY_MAX.dispositionNote} characters) of what they know. Reply as {"npcs": [{"name", "description", "role", "attitude", "knowledge"}]}; an empty list is fine.`
      ],
      ask: 'Write the NPCs.',
      schema: npcsSchema,
      check: checkNpcs
    })
    if (!npcs.ok) return fail('NPCs', npcs.message)

    return { ok: true, draft: { ...placed.value, npcs: npcs.value } }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCancel)
  }
}
