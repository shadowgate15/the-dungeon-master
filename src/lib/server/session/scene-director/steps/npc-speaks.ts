import { streamText } from '../../../ai/port.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import type { MenuOption } from '../types.ts'

const VERB = 'npc-speaks'
const NPC_MAX_TOKENS = 200

const NPC_SYSTEM = [
  'You voice one non-player character in a tabletop role-playing game.',
  'Reply with only the words this character says aloud, one to three sentences, in first person.',
  'Do not narrate, do not describe actions, do not speak for anyone else, and do not invent numbers or game state.',
  'Stay true to the personality and attitude below, and say only what this character knows.'
].join(' ')

/** The conversation as this NPC heard it: its own lines under its name, anyone else's as "Someone". */
function conversation(events: SessionEvent[], npcId: string, name: string): string {
  return events
    .map((e) => {
      if (e.kind === 'player-action') return `Player: ${e.text}`
      if (e.kind === 'npc-line') return `${e.npcId === npcId ? name : 'Someone'}: ${e.text ?? ''}`
      if (e.kind === 'narration') return `Narrator: ${e.text ?? ''}`
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
      id: `${VERB}:${npc.id}`,
      hint: `${npc.name} (${npc.attitude}) says something to the player.`
    })),
  async *run(ctx, optionId, menu) {
    const npcId = optionId.slice(VERB.length + 1)
    const npc = menu.scene.npcs.find((n) => n.id === npcId)
    if (!npc) throw new Error(`No NPC ${npcId} is present`)
    const system = [
      NPC_SYSTEM,
      `Character: ${npc.name}`,
      `Attitude toward the player: ${npc.attitude}`,
      `What ${npc.name} knows: ${npc.knowledge}`
    ].join('\n')
    let text = ''
    let failure: string | undefined
    let finished = false
    for await (const step of streamText(ctx.port, {
      systemPrompts: [system],
      messages: [{ role: 'user', content: conversation(menu.events, npc.id, npc.name) }],
      maxTokens: NPC_MAX_TOKENS,
      threadId: ctx.sessionId,
      signal: ctx.signal
    })) {
      if (step.type === 'delta') {
        text += step.text
        yield { type: 'delta', role: 'npc', kind: 'npc-line', npcId: npc.id, text: step.text }
      } else if (step.type === 'error') failure = step.failure.message
      else if (step.type === 'done') finished = true
    }
    const line = text.trim()
    if (ctx.signal.aborted || failure || !finished || !line) {
      yield { type: 'discard' }
      if (ctx.signal.aborted) return { type: 'continue' }
      throw new Error(failure ?? `${npc.name} said nothing`)
    }
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
