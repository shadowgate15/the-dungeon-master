import type { SessionEvent } from '#lib/session/enums.ts'
import { makeOptionId, parseOptionId } from '../option-id.ts'
import type { MenuOption } from '../types.ts'
import { streamLine } from './stream-line.ts'

const VERB = 'npc-speaks'
const NPC_MAX_TOKENS = 200

const NPC_SYSTEM = [
  'You voice one non-player character in a tabletop role-playing game.',
  'Reply with only the words this character says aloud, one to three sentences, in first person.',
  'Do not narrate, do not describe actions, do not speak for anyone else, and do not invent numbers or game state.',
  'Stay true to the personality and attitude below, and say only what this character knows.'
].join(' ')

/**
 * The conversation as this NPC knows it: the player's actions and its own earlier lines, nothing
 * else. Narration and other NPCs' lines stay out, so another character's knowledge cannot leak
 * into this voice.
 */
function conversation(events: SessionEvent[], npcId: string, name: string): string {
  return events
    .map((e) => {
      if (e.kind === 'player-action') return `Player: ${e.text}`
      if (e.kind === 'npc-line' && e.npcId === npcId) return `${name}: ${e.text ?? ''}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * NPC voice: one NPC present speaks a line, streamed as an attributed `npc-line` event. Offered once
 * per NPC present (`npc-speaks:<id>`), so the Director cannot summon one from nowhere. The voice
 * call sees only the chosen NPC's own data, never another NPC's knowledge.
 */
export const npcSpeaksOption: MenuOption = {
  verb: VERB,
  offer: ({ scene }) =>
    scene.npcs.map((npc) => ({
      id: makeOptionId(VERB, npc.id),
      hint: `${npc.name} (${npc.attitude}) says something to the player.`
    })),
  async *run(ctx, optionId, menu) {
    const npcId = parseOptionId(optionId).arg
    const npc = menu.scene.npcs.find((n) => n.id === npcId)
    if (!npc) throw new Error(`No NPC ${npcId} is present`)
    const system = [
      NPC_SYSTEM,
      `Character: ${npc.name}`,
      `Attitude toward the player: ${npc.attitude}`,
      `What ${npc.name} knows: ${npc.knowledge}`
    ].join('\n')
    const line = yield* streamLine(ctx, {
      system,
      content: conversation(menu.events, npc.id, npc.name),
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
