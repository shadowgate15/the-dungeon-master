/**
 * The NPC voice's context. Isolation is structural: the builder takes ONE resolved NPC as its only
 * memory input, so there is no place, other NPC, summary, World fact or other note for it to
 * include, and nothing is filtered on the way out. The conversation is the player's Declarations and
 * this NPC's own earlier lines. Over the cap the oldest conversation lines go, down to the trim
 * floor.
 */
import type { SceneNpc, SessionEvent } from '#lib/session/enums.ts'
import type { ContextReport } from '#lib/session/exchange-events.ts'
import { estimateTokens } from '../../ai/tokens.ts'
import { DEFAULT_BUDGETS, type ContextBudgets } from './budgets.ts'

export const NPC_SYSTEM = [
  'You voice one non-player character in a tabletop role-playing game.',
  'Reply with only the words this character says aloud, one to three sentences, in first person.',
  'Do not narrate, do not describe actions, do not speak for anyone else, and do not invent numbers or game state.',
  'Stay true to the personality and attitude below, and say only what this character knows.'
].join(' ')

export interface NpcContextInput {
  /** The only memory input: the NPC being voiced, as resolved live from World memory. */
  npc: SceneNpc
  /** The Event log (recent part); only the player's Declarations and this NPC's own lines are used. */
  events: SessionEvent[]
  /** What this Exchange settled, stated as facts for the Reply (never trimmed). */
  facts?: string
  budgets?: ContextBudgets
}

export function buildNpcContext(input: NpcContextInput): {
  system: string
  content: string
  report: ContextReport
} {
  const { npc } = input
  const budgets = input.budgets ?? DEFAULT_BUDGETS
  let lines = input.events.flatMap((e) => {
    if (e.kind === 'declaration') return [`Player: ${e.text}`]
    if (e.kind === 'npc-line' && e.npcId === npc.id) return [`${npc.name}: ${e.text ?? ''}`]
    return []
  })
  const system = [
    NPC_SYSTEM,
    `Character: ${npc.name}`,
    `Attitude toward the player: ${npc.attitude}`,
    `What ${npc.name} knows: ${npc.knowledge}`
  ].join('\n')
  const content = () => [lines.join('\n'), ...(input.facts ? [input.facts] : [])].join('\n\n')
  const used = () => estimateTokens(`${system}\n${content()}`)

  let dropped = 0
  while (used() > budgets.npc && lines.length > budgets.trimFloor) {
    lines = lines.slice(1)
    dropped++
  }
  return {
    system,
    content: content(),
    report: {
      role: 'npc',
      used: used(),
      cap: budgets.npc,
      memoryUsed: 0,
      memoryBudget: 0,
      verbatim: lines.length,
      summarised: 0,
      trims: { memory: 0, events: dropped, summary: 0, uncovered: 0 }
    }
  }
}
