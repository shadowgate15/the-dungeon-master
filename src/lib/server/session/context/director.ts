/**
 * The Director's context: its Scene-derived menu, the compact Arc line and a few recent events.
 * No World memory and no summary. The menu, Arc line and Scene lines are never trimmed; over the
 * cap the oldest events go, down to the trim floor.
 */
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { ContextReport } from '#lib/session/pipeline-events.ts'
import { estimateTokens } from '../../ai/tokens.ts'
import { eventLine } from '../scene-director/prompt.ts'
import type { MenuEntry } from '../scene-director/types.ts'
import { DEFAULT_BUDGETS, type ContextBudgets } from './budgets.ts'

export const DIRECTOR_SYSTEM = [
  'You direct a tabletop role-playing game.',
  'Reply with ONLY the id of one option from the list, nothing else.',
  'Prefer yield once the player has something to respond to.'
].join(' ')

export interface DirectorContextInput {
  scene: SceneState
  entries: MenuEntry[]
  /** Recent Event log entries, oldest first. */
  events: SessionEvent[]
  /** The compact Arc line, when the Campaign has an Arc. */
  arcLine?: string
  /** The last answer was not an option id: ask once more. */
  retry?: boolean
  budgets?: ContextBudgets
}

export function buildDirectorContext(input: DirectorContextInput): {
  system: string
  prompt: string
  report: ContextReport
} {
  const budgets = input.budgets ?? DEFAULT_BUDGETS
  let shown = input.events.slice(-budgets.verbatimFloor)
  const prompt = () =>
    [
      `Location: ${input.scene.location.name}`,
      ...(input.arcLine ? [input.arcLine] : []),
      `Mode: ${input.scene.mode}`,
      `Recent events:\n${shown.map(eventLine).join('\n')}`,
      `Options:\n${input.entries.map((e) => `${e.id}: ${e.hint}`).join('\n')}`,
      ...(input.retry
        ? [
            `Your last answer was not one of the option ids. Reply with exactly one of: ${input.entries.map((e) => e.id).join(', ')}`
          ]
        : [])
    ].join('\n\n')
  const used = () => estimateTokens(`${DIRECTOR_SYSTEM}\n${prompt()}`)

  let dropped = 0
  while (used() > budgets.director && shown.length > budgets.trimFloor) {
    shown = shown.slice(1)
    dropped++
  }
  return {
    system: DIRECTOR_SYSTEM,
    prompt: prompt(),
    report: {
      role: 'director',
      used: used(),
      cap: budgets.director,
      memoryUsed: 0,
      memoryBudget: 0,
      verbatim: shown.length,
      summarised: 0,
      trims: { memory: 0, events: dropped, summary: 0, uncovered: 0 }
    }
  }
}
