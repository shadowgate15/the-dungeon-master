import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { PipelineContext, PipelineEvent } from '../scene-runner.ts'

/** What the Director sees when code builds its menu. */
export interface MenuContext {
  scene: SceneState
  /** Recent Event log entries, oldest first. */
  events: SessionEvent[]
}

/** One line of the Director's menu: an id the Director returns, and a hint saying what it does. */
export interface MenuEntry {
  id: string
  hint: string
}

/** What a step reports back to the loop. */
export type StepOutcome = { type: 'continue' } | { type: 'done'; reason: 'yield' | 'roll' | 'cap' }

/**
 * One kind of menu option, in its own module. `verb` is the part of an option id before any
 * `:argument` (`move:<exit>` has verb `move`). `offer` builds the entries for the current scene
 * (none when the option does not apply); `run` carries out a chosen entry, streaming pipeline
 * events and returning what the loop does next.
 */
export interface MenuOption {
  verb: string
  offer(menu: MenuContext): MenuEntry[]
  run(
    ctx: PipelineContext,
    optionId: string,
    menu: MenuContext
  ): AsyncGenerator<PipelineEvent, StepOutcome>
}
