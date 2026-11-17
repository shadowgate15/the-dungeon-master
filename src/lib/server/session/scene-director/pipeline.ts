import type { Pipeline, RunStats } from '../scene-runner.ts'
import { askDirector } from './director.ts'
import { buildMenu, fallbackPick, optionFor, parsePick } from './menu.ts'
import { MENU_OPTIONS } from './options.ts'
import type { MenuContext, MenuOption } from './types.ts'

/** The hard step cap: the most Director steps in one run. The single tunable constant (#212). */
export const STEP_LIMIT = 6
const RECENT_EVENTS = 8

/**
 * The Director pipeline. Each step: code builds the menu from scene state, the Director returns
 * one option, and that option's step runs. An unusable answer is asked for once more, then code
 * picks. Ends on `yield`, or at the step limit, which forces a yield. Streams `step` and `stats`
 * events for the inspector.
 */
export function createDirectorPipeline(options: MenuOption[] = MENU_OPTIONS): Pipeline {
  return async function* (ctx) {
    const stats: RunStats = { steps: 0, directorCalls: 0, retries: 0, fallbacks: 0, capHits: 0 }
    for (let step = 1; step <= STEP_LIMIT; step++) {
      const menu: MenuContext = {
        scene: ctx.sessions.scene(ctx.sessionId),
        events: ctx.sessions.events(ctx.sessionId).slice(-RECENT_EVENTS)
      }
      const entries = buildMenu(options, menu)
      yield { type: 'thinking', role: 'director' }
      const raw: string[] = []
      let pick: string | undefined
      let retried = false
      let fallback = false
      for (let attempt = 0; attempt < 2 && pick === undefined; attempt++) {
        if (attempt > 0) {
          retried = true
          stats.retries++
        }
        stats.directorCalls++
        const answer = await askDirector(ctx, menu, entries, attempt > 0)
        if (ctx.signal.aborted) return
        if (answer === undefined) {
          yield { type: 'done', reason: 'error', message: 'The Director could not choose' }
          return
        }
        raw.push(answer)
        pick = parsePick(answer, entries)
      }
      if (pick === undefined) {
        fallback = true
        stats.fallbacks++
        pick = fallbackPick(entries, menu.events)
      }
      stats.steps++
      yield {
        type: 'step',
        step,
        role: 'director',
        menu: entries.map((e) => e.id),
        pick,
        retried,
        fallback,
        raw
      }
      yield { type: 'stats', stats: { ...stats } }
      const option = optionFor(options, pick)
      if (!option) return
      const outcome = yield* option.run(ctx, pick, menu)
      if (ctx.signal.aborted) return
      if (outcome.type === 'done') {
        yield { type: 'done', reason: outcome.reason }
        return
      }
    }
    stats.capHits++
    yield { type: 'stats', stats: { ...stats } }
    yield { type: 'done', reason: 'cap' }
  }
}
