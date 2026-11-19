import { z } from 'zod'
import { MEMORY_MAX } from '#lib/memory/enums.ts'
import { ATTITUDES } from '#lib/session/enums.ts'
import { type ChatPort } from '../ai/port.ts'
import {
  checkNpcs,
  checkPlace,
  FIRST_SCENE_MAX,
  MIN_EXITS,
  npcsSchema,
  placeSchema,
  ROLE,
  runStage,
  type NpcDraft,
  type PlaceDraft
} from './generation-stages.ts'

export { FIRST_SCENE_MAX, MIN_EXITS }

/**
 * First Scene generation: three staged structured calls (opening situation, place, NPCs), each
 * validated by code and retried once with the problem named, as `generateArc` does. UI-free; the
 * model is reached only through the injected `ChatPort`. Nothing is stored here: the caller writes
 * the result in one transaction, so a failing stage leaves nothing behind.
 */

export const FIRST_SCENE_TIMEOUT_MS = 240_000

export interface FirstSceneInput {
  campaign: { name: string; premise: string; tone: string; length: string }
  /** Every World of the Campaign, in list order. The model sees them all; the first hosts. */
  worlds: { name: string; premise?: string | null }[]
  /** The Arc's first Act and its Beats. */
  act: { name: string; purpose: string; beats: { title: string; description: string }[] }
  character: { name: string; race: string; class: string }
}

export interface FirstSceneDraft extends PlaceDraft {
  npcs: NpcDraft[]
}

export type FirstSceneResult =
  { ok: true; draft: FirstSceneDraft } | { ok: false; stage: string; message: string }

export interface GenerateFirstSceneOptions {
  signal?: AbortSignal
  /** One deadline for all three stages, retries included. Injectable for tests. */
  timeoutMs?: number
}

const situationSchema = z.object({ situation: z.string() })
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
