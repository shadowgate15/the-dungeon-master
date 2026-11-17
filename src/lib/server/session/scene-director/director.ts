import { collectText } from '../../ai/port.ts'
import type { PipelineContext } from '../scene-runner.ts'
import { recentLines } from './prompt.ts'
import type { MenuContext, MenuEntry } from './types.ts'

const DIRECTOR_MAX_TOKENS = 48

const DIRECTOR_SYSTEM = [
  'You direct a tabletop role-playing game.',
  'Reply with ONLY the id of one option from the list, nothing else.',
  'Prefer yield once the player has something to respond to.'
].join(' ')

/**
 * Asks the Director to pick one menu option: a non-streaming call that returns a short enum value.
 * `undefined` when the call fails or is stopped.
 */
export function askDirector(
  ctx: PipelineContext,
  menu: MenuContext,
  entries: MenuEntry[]
): Promise<string | undefined> {
  const { scene } = menu
  const prompt = [
    `Location: ${scene.location.name}`,
    `Mode: ${scene.mode}`,
    `Recent events:\n${recentLines(menu.events)}`,
    `Options:\n${entries.map((e) => `${e.id}: ${e.hint}`).join('\n')}`
  ].join('\n\n')
  return collectText(ctx.port, {
    systemPrompts: [DIRECTOR_SYSTEM],
    messages: [{ role: 'user', content: prompt }],
    maxTokens: DIRECTOR_MAX_TOKENS,
    threadId: ctx.sessionId,
    signal: ctx.signal
  })
}
