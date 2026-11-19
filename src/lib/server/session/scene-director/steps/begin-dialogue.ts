import { makeOptionId, parseOptionId } from '../option-id.ts'
import type { MenuOption } from '../types.ts'

const VERB = 'begin-dialogue'

/**
 * Begin dialogue: offered once per NPC present (`begin-dialogue:<id>`), and only in exploration.
 * Code applies the change: it saves the scene in dialogue mode with that NPC and logs a
 * `mode-changed` event. The Director only picks; it never edits the scene.
 */
export const beginDialogueOption: MenuOption = {
  verb: VERB,
  offer: ({ scene }) =>
    scene.mode === 'exploration'
      ? scene.npcs.map((npc) => ({
          id: makeOptionId(VERB, npc.key),
          hint: `Start a conversation with ${npc.name} (${npc.attitude}).`
        }))
      : [],
  async *run(ctx, optionId, menu) {
    const key = parseOptionId(optionId).arg
    const npc = menu.scene.npcs.find((n) => n.key === key)
    if (menu.scene.mode !== 'exploration' || !npc) {
      throw new Error(`Cannot begin dialogue with ${key}`)
    }
    ctx.sessions.saveScene(ctx.sessionId, {
      ...menu.scene,
      mode: 'dialogue',
      dialogueNpcId: npc.id
    })
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'code',
      kind: 'mode-changed',
      npcId: npc.id,
      text: `Dialogue with ${npc.name}`,
      data: { mode: 'dialogue', npcId: npc.id }
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
