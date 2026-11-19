import { callText, type TextCall } from '../../ai/port.ts'
import type { PipelineContext } from '../scene-runner.ts'
import { buildDirectorContext } from '../context/director.ts'
import type { MenuContext, MenuEntry } from './types.ts'

const DIRECTOR_MAX_TOKENS = 48

/**
 * Asks the Director to pick one menu option: a non-streaming call that returns a short enum value.
 * Not ok when the call fails or is stopped; the failure says why when the model reported one.
 */
export function askDirector(
  ctx: PipelineContext,
  menu: MenuContext,
  entries: MenuEntry[],
  retry = false
): Promise<TextCall> {
  const built = buildDirectorContext({
    scene: menu.scene,
    entries,
    events: menu.events,
    arcLine: ctx.steering?.()?.directorLine,
    retry
  })
  ctx.report?.(built.report)
  return callText(ctx.port, {
    systemPrompts: [built.system],
    messages: [{ role: 'user', content: built.prompt }],
    maxTokens: DIRECTOR_MAX_TOKENS,
    threadId: ctx.sessionId,
    signal: ctx.signal
  })
}
