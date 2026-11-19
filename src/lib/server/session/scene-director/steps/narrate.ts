import { buildNarratorContext } from '../../context/narrator.ts'
import type { MenuOption } from '../types.ts'
import { streamLine } from './stream-line.ts'

const NARRATOR_MAX_TOKENS = 400

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
    const built = buildNarratorContext({
      scene: menu.scene,
      events: ctx.sessions.events(ctx.sessionId),
      summary: ctx.context?.summary(ctx.sessionId) ?? { text: null, throughSeq: 0 },
      world: ctx.context?.world(ctx.sessionId) ?? null,
      arcBlock: ctx.steering?.()?.arcBlock
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
