import type { MenuOption } from '../types.ts'

/**
 * End dialogue: offered only while in dialogue. Code returns the scene to exploration, clears the
 * NPC being talked to, and logs a `mode-changed` event.
 */
export const endDialogueOption: MenuOption = {
  verb: 'end-dialogue',
  offer: ({ scene }) =>
    scene.mode === 'dialogue'
      ? [{ id: 'end-dialogue', hint: 'End the conversation and return to exploring.' }]
      : [],
  async *run(ctx, _optionId, menu) {
    if (menu.scene.mode !== 'dialogue') throw new Error('No dialogue to end')
    ctx.sessions.saveScene(ctx.sessionId, {
      ...menu.scene,
      mode: 'exploration',
      dialogueNpcId: null
    })
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'code',
      kind: 'mode-changed',
      npcId: menu.scene.dialogueNpcId,
      text: 'Dialogue ends',
      data: { mode: 'exploration', npcId: null }
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
