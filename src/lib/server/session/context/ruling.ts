/**
 * The context of the two ruling steps, Adjudication and Effect: the compact Scene, a few recent
 * events and the Declaration, as the contract's `sceneContext` renders them. No World memory, no
 * summary and no NPC knowledge, so a ruling never sees a secret. The Scene and the Declaration are
 * never trimmed; over the cap the oldest events go, down to the trim floor.
 */
import type { Clarification } from '#lib/session/call.ts'
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { ContextReport } from '#lib/session/exchange-events.ts'
import { estimateTokens } from '../../ai/tokens.ts'
import {
  sceneContext,
  type CharacterLine,
  type EffectScene,
  type ExchangeScene
} from '../exchange/contract.ts'
import { DEFAULT_BUDGETS, type ContextBudgets } from './budgets.ts'
import { eventLine } from './event-line.ts'

export interface RulingContextInput {
  role: 'adjudication' | 'effect'
  /** The system prompt the step sends, counted against the cap. */
  system: string
  scene: SceneState
  /** Recent Event log entries, oldest first. */
  events: SessionEvent[]
  character: CharacterLine
  declaration: string
  /** The Clarifications so far, while the Declaration is being clarified. */
  clarifying?: Clarification[]
  budgets?: ContextBudgets
}

/** The Scene as the ruling steps see it: NPCs by id, name and attitude only. */
export function exchangeScene(scene: SceneState, events: string[] = []): ExchangeScene {
  return {
    location: scene.location,
    exits: scene.exits,
    objects: scene.objects,
    npcs: scene.npcs.map((n) => ({ id: n.id, name: n.name, note: n.attitude })),
    mode: scene.mode,
    dialogueNpcId: scene.dialogueNpcId,
    events
  }
}

/** The part of the Scene the Effect options are built from. */
export const effectScene = (scene: SceneState): EffectScene => exchangeScene(scene)

export function buildRulingContext(input: RulingContextInput): {
  content: string
  report: ContextReport
} {
  const budgets = input.budgets ?? DEFAULT_BUDGETS
  let shown = input.events.slice(-budgets.verbatimFloor)
  const content = () =>
    sceneContext(
      exchangeScene(input.scene, shown.map(eventLine)),
      input.character,
      input.declaration,
      input.clarifying
    )
  const used = () => estimateTokens(`${input.system}\n${content()}`)

  let dropped = 0
  while (used() > budgets.ruling && shown.length > budgets.trimFloor) {
    shown = shown.slice(1)
    dropped++
  }
  return {
    content: content(),
    report: {
      role: input.role,
      used: used(),
      cap: budgets.ruling,
      memoryUsed: 0,
      memoryBudget: 0,
      verbatim: shown.length,
      summarised: 0,
      trims: { memory: 0, events: dropped, summary: 0, uncovered: 0 }
    }
  }
}
