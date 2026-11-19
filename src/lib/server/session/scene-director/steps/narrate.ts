import { recentLines } from '../prompt.ts'
import type { MenuOption } from '../types.ts'
import { streamLine } from './stream-line.ts'

const NARRATOR_MAX_TOKENS = 400

const NARRATOR_SYSTEM = [
  'You are the narrator of a tabletop role-playing game. Describe what happens next in 2 to 4 sentences of second-person prose.',
  'Do not speak for non-player characters, do not invent numbers, dice results or game state, and do not ask what the player does.'
].join(' ')

/**
 * The Narrator: streams scene prose as a `narration` event. Offered unless the last event is
 * already narration. Only a finished stream is saved; a stop or a model failure discards the
 * in-flight event and leaves the log unchanged.
 */
export const narrateOption: MenuOption = {
  verb: 'narrate',
  offer: ({ events }) =>
    events.at(-1)?.kind === 'narration'
      ? []
      : [{ id: 'narrate', hint: "Describe what happens as a result of the player's action." }],
  async *run(ctx, _id, menu) {
    const { scene } = menu
    const arc = ctx.steering?.()?.arcBlock
    const system = [
      NARRATOR_SYSTEM,
      `Location: ${scene.location.name}. ${scene.location.description}`,
      ...(arc ? [arc] : [])
    ].join('\n')
    const prose = yield* streamLine(ctx, {
      system,
      content: recentLines(menu.events),
      maxTokens: NARRATOR_MAX_TOKENS,
      role: 'narrator',
      kind: 'narration',
      emptyMessage: 'The narrator produced no text'
    })
    // A stop ends the run quietly: the runner reports it as `stopped`.
    if (prose === undefined) return { type: 'continue' }
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'narrator',
      kind: 'narration',
      text: prose
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
