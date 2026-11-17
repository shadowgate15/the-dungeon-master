import { streamText } from '../../../ai/port.ts'
import { recentLines } from '../prompt.ts'
import type { MenuOption } from '../types.ts'

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
    const system = `${NARRATOR_SYSTEM}\nLocation: ${scene.location.name}. ${scene.location.description}`
    let text = ''
    let failure: string | undefined
    let finished = false
    for await (const step of streamText(ctx.port, {
      systemPrompts: [system],
      messages: [{ role: 'user', content: recentLines(menu.events) }],
      maxTokens: NARRATOR_MAX_TOKENS,
      threadId: ctx.sessionId,
      signal: ctx.signal
    })) {
      if (step.type === 'delta') {
        text += step.text
        yield { type: 'delta', role: 'narrator', kind: 'narration', text: step.text }
      } else if (step.type === 'error') failure = step.failure.message
      else if (step.type === 'done') finished = true
    }
    const prose = text.trim()
    if (ctx.signal.aborted || failure || !finished || !prose) {
      yield { type: 'discard' }
      // A stop ends the run quietly: the runner reports it as `stopped`.
      if (ctx.signal.aborted) return { type: 'continue' }
      throw new Error(failure ?? 'The narrator produced no text')
    }
    const event = ctx.sessions.appendEvent(ctx.sessionId, {
      role: 'narrator',
      kind: 'narration',
      text: prose
    })
    yield { type: 'event', event }
    return { type: 'continue' }
  }
}
