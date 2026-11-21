/**
 * Per-role context budgets, in estimated tokens (see `estimateTokens`). Named, tunable constants:
 * the values were confirmed by the replay test on `qwen/qwen3-4b-2507` (map #216, spec #235) and
 * are unproven beyond it. Revisit with real summaries and long play, and re-run the manual
 * model harnesses (docs/context-harnesses.md) when one changes or the target model does.
 *
 * The summary threshold (`SUMMARY_THRESHOLD_TOKENS`) and size (`SUMMARY_SIZE_TOKENS`) live with
 * the Rolling summary in `memory/summary.ts`.
 */

/** The cap for Adjudication and Effect: the compact Scene, a few recent events and the Declaration. */
export const RULING_BUDGET = 1200
/** The Narrator's cap, over which trimming starts. */
export const NARRATOR_BUDGET = 2600
/** The most the Narrator's context may reach: only never-trimmed parts can take it past the cap. */
export const NARRATOR_CEILING = 4000
/** The Narrator's World memory sub-budget: what selection may fill beyond the always-on core. */
export const MEMORY_BUDGET = 800
/** The NPC voice's cap: its own record and its conversation. */
export const NPC_BUDGET = 1300
/** The last events always shown verbatim to the Narrator and the ruling steps, even when summarised. */
export const VERBATIM_FLOOR = 8
/** The fewest events over-cap trimming leaves in a context. */
export const TRIM_FLOOR = 4

export interface ContextBudgets {
  ruling: number
  narrator: number
  narratorCeiling: number
  memory: number
  npc: number
  verbatimFloor: number
  trimFloor: number
}

export const DEFAULT_BUDGETS: ContextBudgets = {
  ruling: RULING_BUDGET,
  narrator: NARRATOR_BUDGET,
  narratorCeiling: NARRATOR_CEILING,
  memory: MEMORY_BUDGET,
  npc: NPC_BUDGET,
  verbatimFloor: VERBATIM_FLOOR,
  trimFloor: TRIM_FLOOR
}
