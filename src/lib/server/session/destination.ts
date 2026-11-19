import { MEMORY_MAX } from '#lib/memory/enums.ts'
import { ATTITUDES } from '#lib/session/enums.ts'
import type { ChatPort } from '../ai/port.ts'
import {
  checkNpcs,
  checkPlace,
  FIRST_SCENE_MAX,
  npcsSchema,
  placeSchema,
  ROLE,
  runStage,
  type NpcDraft,
  type PlaceDraft
} from './generation-stages.ts'

/**
 * Destination generation: the first move through an exit asks the model for the place beyond it
 * and who is there, as stages 2 and 3 of first Scene generation do (same validators, one retry
 * naming the problem). Nothing is stored here; the caller stores the result, or falls back to a
 * bare place when this fails, so a move never dead-ends.
 */

export const DESTINATION_TIMEOUT_MS = 120_000

/** The model gives at least one exit of its own; code adds the way back. */
export const MIN_DESTINATION_EXITS = 1
const MAX_DESTINATION_EXITS = FIRST_SCENE_MAX.exits - 1

export interface DestinationInput {
  campaign: { name: string; premise: string; tone: string; length: string }
  /** The World hosting the destination: the one the origin sits in. */
  world: { name: string; premise?: string | null }
  /** The Arc's current Act and its Beats. */
  act: { name: string; purpose: string; beats: { title: string; description: string }[] }
  origin: { name: string; description: string }
  exitName: string
  character: { name: string; race: string; class: string }
  /** Name keys of NPCs the Campaign already has; the model must not repeat them. */
  takenNpcKeys: string[]
}

export interface DestinationDraft extends PlaceDraft {
  npcs: NpcDraft[]
}

export type DestinationResult =
  { ok: true; draft: DestinationDraft } | { ok: false; stage: string; message: string }

export async function generateDestination(
  port: ChatPort,
  input: DestinationInput,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DestinationResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DESTINATION_TIMEOUT_MS)
  const onCancel = () => controller.abort()
  options.signal?.addEventListener('abort', onCancel)
  if (options.signal?.aborted) onCancel()

  try {
    const c = input.campaign
    const beats = input.act.beats.map((b) => `  - ${b.title}: ${b.description}`).join('\n')
    const base = [
      `Campaign: ${c.name}. ${c.premise} Tone: ${c.tone}. Length: ${c.length}.`,
      `The World this is in: ${input.world.name}${input.world.premise ? `: ${input.world.premise}` : ''}`,
      `The Arc's current Act is "${input.act.name}": ${input.act.purpose}\nIts Beats:\n${beats}`,
      `The Character: ${input.character.name}, a ${input.character.race} ${input.character.class}.`,
      `The Characters are leaving "${input.origin.name}" (${input.origin.description}) through the exit "${input.exitName}".`
    ].join('\n\n')

    const placed = await runStage(port, controller.signal, {
      system: [
        ROLE,
        `${base}\n\nDescribe the place that exit leads to, in the same World. Give a name (at most ${MEMORY_MAX.placeName} characters), a description (at most ${MEMORY_MAX.placeDescription}), ${MIN_DESTINATION_EXITS} to ${MAX_DESTINATION_EXITS} exit names (each at most ${MEMORY_MAX.exitName} characters, naming where it leads; do not list the way back to "${input.origin.name}", code adds it) and up to ${FIRST_SCENE_MAX.objects} notable objects. Reply as {"name", "description", "exits": [...], "objects": [...]}.`
      ],
      ask: 'Write the place.',
      schema: placeSchema,
      check: (raw) => checkPlace(raw, MIN_DESTINATION_EXITS)
    })
    if (!placed.ok) return { ok: false, stage: 'place', message: placed.message }

    const taken = input.takenNpcKeys
    const npcs = await runStage(port, controller.signal, {
      system: [
        ROLE,
        `${base}\n\nThe place: ${placed.value.place.name}. ${placed.value.place.description}\n\nName 0 to ${FIRST_SCENE_MAX.npcs} NPCs present in this place${taken.length ? `, none of them named: ${taken.join(', ')}` : ''}. Each has a name (at most ${MEMORY_MAX.npcName} characters), a description (at most ${MEMORY_MAX.npcDescription}), a role (at most ${MEMORY_MAX.npcRole}), an attitude toward the Character (one of ${ATTITUDES.join(', ')}) and a short knowledge note (at most ${MEMORY_MAX.dispositionNote} characters) of what they know. Reply as {"npcs": [{"name", "description", "role", "attitude", "knowledge"}]}; an empty list is fine.`
      ],
      ask: 'Write the NPCs.',
      schema: npcsSchema,
      check: (raw) => checkNpcs(raw, taken)
    })
    // The place is worth keeping without its NPCs: a failed NPC stage only leaves it empty.
    return { ok: true, draft: { ...placed.value, npcs: npcs.ok ? npcs.value : [] } }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onCancel)
  }
}
