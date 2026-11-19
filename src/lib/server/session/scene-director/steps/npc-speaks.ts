import { buildNpcContext } from '../../context/npc.ts'
import { makeOptionId, parseOptionId } from '../option-id.ts'
import type { MenuOption } from '../types.ts'
import { streamLine } from './stream-line.ts'

const VERB = 'npc-speaks'
const NPC_MAX_TOKENS = 200

/**
 * NPC voice: one NPC present speaks a line, streamed as an attributed `npc-line` event. Offered once
 * per NPC present (`npc-speaks:<id>`), so the Director cannot summon one from nowhere. The voice
 * call sees only the chosen NPC's own data, never another NPC's knowledge.
 */
export const npcSpeaksOption: MenuOption = {
  verb: VERB,
  offer: ({ scene }) =>
    scene.npcs.map((npc) => ({
      id: makeOptionId(VERB, npc.key),
      hint: `${npc.name} (${npc.attitude}) says something to the player.`
    })),
  async *run(ctx, optionId, menu) {
    const key = parseOptionId(optionId).arg
    const npc = menu.scene.npcs.find((n) => n.key === key)
    if (!npc) throw new Error(`No NPC ${key} is present`)
    const built = buildNpcContext({ npc, events: ctx.sessions.events(ctx.sessionId) })
    ctx.report?.(built.report)
    const line = yield* streamLine(ctx, {
      system: built.system,
      content: built.content,
      maxTokens: NPC_MAX_TOKENS,
      role: 'npc',
      kind: 'npc-line',
      npcId: npc.id,
      emptyMessage: `${npc.name} said nothing`
    })
    if (line === undefined) return { type: 'continue' }
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'npc',
      kind: 'npc-line',
      npcId: npc.id,
      text: line
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
