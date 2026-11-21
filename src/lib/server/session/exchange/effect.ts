/**
 * Effect: picks the one Effect a Declaration that happened has, from the options code builds from
 * the Scene, then applies it through the Session service, which records it in the Event log.
 */
import type { Clarification } from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import type { ExchangeEvent } from '#lib/session/exchange-events.ts'
import { effectScene } from '../context/ruling.ts'
import { generateDestination } from '../destination.ts'
import { askRuling } from './ask.ts'
import type { ExchangeContext } from './context.ts'
import {
  allowedEffects,
  EFFECT_SYSTEM,
  effectSchema,
  validateEffect,
  type Effect
} from './contract.ts'

/** Room for the small Effect answer, as the eval sent it. */
const EFFECT_MAX_TOKENS = 80

/**
 * Asks the model which Effect the Declaration has and returns it, validated against the Scene's
 * options. Makes no request when the Scene allows nothing but `none`. An invalid answer is retried
 * once, then defaults to `none`. Throws on a model error.
 */
export async function chooseEffect(
  ctx: ExchangeContext,
  declaration: SessionEvent,
  clarifying: Clarification[] = []
): Promise<Effect> {
  const scene = ctx.sessions.scene(ctx.sessionId)
  const options = effectScene(scene)
  if (allowedEffects(options).length === 1) return { effect: 'none' }
  const asked = await askRuling<Effect>(ctx, {
    role: 'effect',
    system: EFFECT_SYSTEM,
    scene,
    declaration,
    clarifying,
    maxTokens: EFFECT_MAX_TOKENS,
    outputSchema: effectSchema(options),
    validate: (answer) => {
      const valid = validateEffect(options, answer)
      return valid.ok ? { ok: true, value: valid.effect } : valid
    },
    fallback: { effect: 'none' }
  })
  return asked.value
}

/**
 * Applies a validated Effect through the Session service, streaming the event it records, and
 * returns what it did as a fact for the Reply (null for `none`). Throws when the Effect no longer
 * fits the Scene, so a broken caller never looks like a successful change.
 */
export async function* applyEffect(
  ctx: ExchangeContext,
  effect: Effect
): AsyncGenerator<ExchangeEvent, string | null> {
  const { sessions, sessionId } = ctx
  const scene = sessions.scene(sessionId)
  switch (effect.effect) {
    case 'none':
      return null
    case 'move': {
      const exit = scene.exits.find((e) => e.id === effect.exitId)
      if (!exit) throw new Error(`No exit ${effect.exitId} in this Scene`)
      // The first move through an exit generates and stores the destination; later moves reuse
      // it. When generation fails the place is a bare one named after the exit, with a way back.
      const destination = await sessions.moveThrough(sessionId, exit.id, async (input) => {
        const result = await generateDestination(ctx.port, input, { signal: ctx.signal })
        return result.ok ? result.draft : null
      })
      const event = sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'scene-changed',
        text: `You go through: ${exit.name}. You are now at ${destination.name}.`,
        data: { exitId: exit.id, from: scene.location.name, to: destination.name }
      })
      yield { type: 'event', event }
      return `The character went through ${exit.name} and is now at ${destination.name}.`
    }
    case 'talk': {
      const npc = scene.npcs.find((n) => n.id === effect.npcId)
      if (!npc) throw new Error(`No NPC ${effect.npcId} is present`)
      sessions.saveScene(sessionId, { ...scene, mode: 'dialogue', dialogueNpcId: npc.id })
      const event = sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'mode-changed',
        npcId: npc.id,
        text: `Dialogue with ${npc.name}`,
        data: { mode: 'dialogue', npcId: npc.id }
      })
      yield { type: 'event', event }
      return `The character starts a conversation with ${npc.name}.`
    }
    case 'end_talk': {
      if (scene.mode !== 'dialogue') throw new Error('No conversation to end')
      sessions.saveScene(sessionId, { ...scene, mode: 'exploration', dialogueNpcId: null })
      const event = sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'mode-changed',
        npcId: scene.dialogueNpcId,
        text: 'Dialogue ends',
        data: { mode: 'exploration', npcId: null }
      })
      yield { type: 'event', event }
      return 'The conversation ends.'
    }
  }
}
