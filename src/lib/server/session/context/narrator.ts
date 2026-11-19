/**
 * The Narrator's context: the fullest of the three roles. Scene, Arc block, Seed and Character are
 * never trimmed. History is the Rolling summary plus every event after its watermark verbatim,
 * with the last `verbatimFloor` events verbatim even when covered. World memory is selected into
 * its sub-budget. Over the cap, trim in order: World memory (lowest score first), then the oldest
 * events down to the trim floor, then the summary's tail. A run never fails over memory: if every
 * trim is spent and the context is still over, it goes out as it is.
 */
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { ContextReport, TrimCounts } from '#lib/session/pipeline-events.ts'
import { estimateTokens } from '../../ai/tokens.ts'
import { eventLine } from '../scene-director/prompt.ts'
import { DEFAULT_BUDGETS, type ContextBudgets } from './budgets.ts'
import {
  degradeWorldMemory,
  renderWorldMemory,
  selectWorldMemory,
  worldMemoryTokens,
  type WorldRecords
} from './world-selection.ts'

export const NARRATOR_SYSTEM = [
  'You are the narrator of a tabletop role-playing game. Describe what happens next in 2 to 4 sentences of second-person prose.',
  'Do not speak for non-player characters, do not invent numbers, dice results or game state, and do not ask what the player does.'
].join(' ')

export interface NarratorContextInput {
  scene: SceneState
  /** The Session's whole Event log, oldest first. */
  events: SessionEvent[]
  /** The Rolling summary and the last event seq it covers. */
  summary: { text: string | null; throughSeq: number }
  /** World memory records; null when there is none to read. */
  world: WorldRecords | null
  /** The full Arc block when the Campaign has an Arc. */
  arcBlock?: string
  /** Never-trimmed Campaign Seed and Character sheet text, when the caller has them. */
  fixed?: { seed?: string; character?: string }
  budgets?: ContextBudgets
  /** Where the dropped-uncovered-events line goes. Defaults to the console. */
  log?: (message: string) => void
}

export interface BuiltContext {
  system: string
  content: string
  report: ContextReport
}

function sceneBlock(scene: SceneState): string {
  const lines = [`Location: ${scene.location.name}. ${scene.location.description}`]
  if (scene.exits.length) lines.push(`Exits: ${scene.exits.map((e) => e.name).join(', ')}`)
  if (scene.objects.length) lines.push(`Objects: ${scene.objects.join(', ')}`)
  lines.push(`Mode: ${scene.mode}`)
  if (scene.npcs.length) {
    lines.push(`Present: ${scene.npcs.map((n) => `${n.name} (${n.attitude})`).join(', ')}`)
  }
  return lines.join('\n')
}

/** Cuts the last sentence; empty once nothing is left. */
function cutTail(text: string): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+/)
  return sentences.slice(0, -1).join(' ')
}

export function buildNarratorContext(input: NarratorContextInput): BuiltContext {
  const budgets = input.budgets ?? DEFAULT_BUDGETS
  const log = input.log ?? ((message: string) => console.warn(message))
  const { scene, summary } = input
  const log_ = input.events.filter((e) => !!e.text)

  const throughSeq = summary.text ? summary.throughSeq : 0
  const floorFrom = log_.length - budgets.verbatimFloor
  let shown = log_.filter((e, i) => e.seq > throughSeq || i >= floorFrom)
  let summaryText = summary.text?.trim() ?? ''
  const covered = log_.filter((e) => e.seq <= throughSeq).length

  const historyText = () => shown.map(eventLine).join('\n')
  let selection = input.world
    ? selectWorldMemory({
        records: input.world,
        sceneNpcIds: scene.npcs.map((n) => n.id),
        // Names in the summary count as mentioned too.
        history: `${summaryText}\n${historyText()}`,
        budget: budgets.memory
      })
    : null

  const system = () =>
    [
      NARRATOR_SYSTEM,
      ...(input.fixed?.seed ? [input.fixed.seed] : []),
      ...(input.fixed?.character ? [input.fixed.character] : []),
      sceneBlock(scene),
      ...(input.arcBlock ? [input.arcBlock] : []),
      ...(selection ? [renderWorldMemory(selection)].filter(Boolean) : [])
    ].join('\n')
  const content = () =>
    [
      ...(summaryText ? [`Story so far: ${summaryText}`] : []),
      ...(shown.length ? [`Recent events:\n${historyText()}`] : [])
    ].join('\n\n')
  const used = () => estimateTokens(`${system()}\n${content()}`)

  const trims: TrimCounts = { memory: 0, events: 0, summary: 0, uncovered: 0 }
  while (selection && used() > budgets.narrator) {
    const next = degradeWorldMemory(selection)
    if (!next) break
    selection = next
    trims.memory++
  }
  while (used() > budgets.narrator && shown.length > budgets.trimFloor) {
    const [oldest, ...rest] = shown
    if (oldest.seq > throughSeq) trims.uncovered++
    shown = rest
    trims.events++
  }
  while (used() > budgets.narrator && summaryText) {
    summaryText = cutTail(summaryText)
    trims.summary++
  }

  if (trims.uncovered > 0) {
    log(
      `Narrator context dropped ${trims.uncovered} uncovered event(s) to fit its budget; the summary is behind. The Event log is unchanged.`
    )
  }
  const total = used()
  if (total > budgets.narratorCeiling) {
    log(`Narrator context is ${total} tokens, over its ${budgets.narratorCeiling} ceiling.`)
  }

  return {
    system: system(),
    content: content(),
    report: {
      role: 'narrator',
      used: total,
      cap: budgets.narrator,
      memoryUsed: selection ? worldMemoryTokens(selection) : 0,
      memoryBudget: budgets.memory,
      verbatim: shown.length,
      summarised: covered - shown.filter((e) => e.seq <= throughSeq).length,
      trims
    }
  }
}
