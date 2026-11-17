import type { SceneExit } from '#lib/session/enums.ts'
import { makeOptionId, parseOptionId } from '../option-id.ts'
import { placeBeyond } from '../places.ts'
import type { MenuOption } from '../types.ts'

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Whether the player's action names the exit, by its id words ("front door") or the first part of
 * its name ("the front door, out to ..."). A plain code-side match; it only flags the exit for the
 * Director, which still has to pick the move.
 */
function named(action: string, exit: SceneExit): boolean {
  const text = ` ${normalise(action)} `
  const short = normalise(exit.name.split(',')[0].replace(/^the\s+/i, ''))
  return [normalise(exit.id), short].some((phrase) => phrase && text.includes(` ${phrase} `))
}

/**
 * Movement: the Director proposes `move:<exit id>`; code checks the exit exists in the current
 * Scene, replaces the Scene with the destination and logs a `scene-changed` event. Offered in
 * exploration, right after a player action. An exit that is not on the menu is an invalid pick.
 */
export const moveOption: MenuOption = {
  verb: 'move',
  offer: ({ scene, events }) => {
    const last = events.at(-1)
    if (last?.kind !== 'player-action' || scene.mode !== 'exploration' || scene.pendingRoll)
      return []
    return scene.exits.map((exit) => ({
      id: makeOptionId('move', exit.id),
      hint: `The player travels to: ${exit.name}.${
        named(last.text ?? '', exit) ? " The player's action names this exit." : ''
      }`
    }))
  },
  async *run(ctx, optionId) {
    const exitId = parseOptionId(optionId).arg
    const scene = ctx.sessions.scene(ctx.sessionId)
    const exit = scene.exits.find((e) => e.id === exitId)
    // Unreachable through the pipeline: an exit the Scene lacks is never on the menu, so
    // `parsePick` already counted it as an invalid pick (retry, then fallback). A throw, not a
    // silent continue, keeps a broken caller from looking like a successful move.
    if (!exit) throw new Error(`No exit ${exitId} in this Scene`)
    const place = placeBeyond(exit, scene.location.name)
    ctx.sessions.saveScene(ctx.sessionId, {
      ...place,
      mode: 'exploration',
      dialogueNpcId: null,
      pendingRoll: null
    })
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'code',
      kind: 'scene-changed',
      text: `You go through: ${exit.name}. You are now at ${place.location.name}.`,
      data: { exitId: exit.id, from: scene.location.name, to: place.location.name }
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
