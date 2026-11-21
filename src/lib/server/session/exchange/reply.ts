/**
 * Reply: the one streamed answer that ends an Exchange. The NPC in dialogue voices it; otherwise
 * the Narrator does. It is told what the Exchange settled as facts, and never changes state.
 * Only a finished stream is saved; a stop discards the in-flight text and saves nothing.
 */
import type { ExchangeEvent } from '#lib/session/exchange-events.ts'
import { buildNarratorContext } from '../context/narrator.ts'
import { buildNpcContext } from '../context/npc.ts'
import type { ExchangeContext } from './context.ts'
import { streamLine } from './stream-line.ts'

const NARRATOR_MAX_TOKENS = 400
const NPC_MAX_TOKENS = 200

/**
 * Streams the Reply and saves it. Returns false when the player stopped it (nothing saved). A
 * model failure or an empty Reply throws.
 */
export async function* reply(
  ctx: ExchangeContext,
  outcome: string
): AsyncGenerator<ExchangeEvent, boolean> {
  const { sessions, sessionId } = ctx
  const scene = sessions.scene(sessionId)
  const events = sessions.events(sessionId)
  const partner =
    scene.mode === 'dialogue' ? scene.npcs.find((n) => n.id === scene.dialogueNpcId) : undefined

  if (partner) {
    const built = buildNpcContext({ npc: partner, events, outcome })
    ctx.report?.(built.report)
    const line = yield* streamLine(ctx, {
      system: built.system,
      content: built.content,
      maxTokens: NPC_MAX_TOKENS,
      role: 'npc',
      kind: 'npc-line',
      npcId: partner.id,
      emptyMessage: `${partner.name} said nothing`
    })
    if (line === undefined) return false
    const event = sessions.appendEvent(sessionId, {
      role: 'npc',
      kind: 'npc-line',
      npcId: partner.id,
      text: line
    })
    yield { type: 'event', event }
    return true
  }

  const built = buildNarratorContext({
    scene,
    events,
    summary: ctx.context?.summary(sessionId) ?? { text: null, throughSeq: 0 },
    world: ctx.context?.world(sessionId) ?? null,
    fixed: ctx.context?.fixed?.(sessionId),
    arcBlock: ctx.steering?.()?.arcBlock,
    outcome
  })
  ctx.report?.(built.report)
  const prose = yield* streamLine(ctx, {
    system: built.system,
    content: built.content,
    maxTokens: NARRATOR_MAX_TOKENS,
    role: 'narrator',
    kind: 'narration',
    emptyMessage: 'The narrator produced no text'
  })
  if (prose === undefined) return false
  const event = sessions.appendEvent(sessionId, {
    role: 'narrator',
    kind: 'narration',
    text: prose
  })
  yield { type: 'event', event }
  return true
}
