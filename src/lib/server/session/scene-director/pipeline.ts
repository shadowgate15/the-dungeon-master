import type { Pipeline } from '../scene-runner.ts'
import { askDirector } from './director.ts'
import { buildMenu, optionFor, parsePick } from './menu.ts'
import { MENU_OPTIONS } from './options.ts'
import type { MenuContext, MenuOption } from './types.ts'

/** A backstop until the step cap is tuned and validated (#205): steps per run. */
export const STEP_LIMIT = 6
const RECENT_EVENTS = 8

/**
 * The Director pipeline. Each step: code builds the menu from scene state, the Director returns
 * one option, and that option's step runs. Ends on `yield`, or at the step limit.
 */
export function createDirectorPipeline(options: MenuOption[] = MENU_OPTIONS): Pipeline {
  return async function* (ctx) {
    for (let step = 0; step < STEP_LIMIT; step++) {
      const menu: MenuContext = {
        scene: ctx.sessions.scene(ctx.sessionId),
        events: ctx.sessions.events(ctx.sessionId).slice(-RECENT_EVENTS)
      }
      const entries = buildMenu(options, menu)
      yield { type: 'thinking', role: 'director' }
      const answer = await askDirector(ctx, menu, entries)
      if (ctx.signal.aborted) return
      if (answer === undefined) {
        yield { type: 'done', reason: 'error', message: 'The Director could not choose' }
        return
      }
      // An unusable answer hands control back; #205 adds the retry and a code-chosen fallback.
      const pick = parsePick(answer, entries) ?? 'yield'
      const option = optionFor(options, pick)
      if (!option) return
      const outcome = yield* option.run(ctx, pick, menu)
      if (ctx.signal.aborted) return
      if (outcome.type === 'done') {
        yield { type: 'done', reason: outcome.reason }
        return
      }
    }
    yield { type: 'done', reason: 'cap' }
  }
}
