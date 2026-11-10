import { ABILITY_KEYS, type AbilityKey } from '#lib/rules/registry.ts'
import type { CharacterDraft } from './draft.ts'
import type { StepContext, StepValidation } from './steps.ts'

/**
 * The Ability Score Methods (#95): app-defined rules the SRD leaves out. Pure and shared by the
 * wizard step and the abilities Field AI control, which may arrange values but never invent numbers
 * or rolls. The values mirror `rules/data/abilityScoreMethods.json` (a spec
 * checks they agree) and the Character service's validation.
 *
 * The draft names the third method `rolling`; the service and rules data name it `roll`.
 */
export type DraftAbilityMethod = NonNullable<CharacterDraft['abilityMethod']>

export { ABILITY_KEYS }
export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}
/** Draft method to the service / rules data slug. */
export const SERVICE_METHOD: Record<DraftAbilityMethod, 'standard-array' | 'point-buy' | 'roll'> = {
  'standard-array': 'standard-array',
  'point-buy': 'point-buy',
  rolling: 'roll'
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const
export const POINT_BUY = {
  budget: 27,
  min: 8,
  max: 15,
  costs: { '8': 0, '9': 1, '10': 2, '11': 3, '12': 4, '13': 5, '14': 7, '15': 9 } as Record<
    string,
    number
  >
}
export const ROLL = { count: 6, dice: 4, sides: 6, dropLowest: 1 } as const

type Scores = Record<AbilityKey, number | null>
export type AbilityValidation = {
  state: 'incomplete' | 'attention' | 'valid'
  issues: string[]
}

/**
 * Rolls a full set: six rolls of four d6, every die recorded (the dropped one included). Code is
 * the only roller; `random` is injectable for tests. Rows are in roll order.
 */
export function rollAbilityScores(random: () => number = Math.random): number[][] {
  return Array.from({ length: ROLL.count }, () =>
    Array.from({ length: ROLL.dice }, () => 1 + Math.floor(random() * ROLL.sides))
  )
}

/**
 * The draft patch for choosing a method: base scores are specific to a method (point buy starts
 * at 8s), the rolled set is kept (#95).
 */
export function methodPatch(next: DraftAbilityMethod): Partial<CharacterDraft> {
  return {
    abilityMethod: next,
    baseScores:
      next === 'point-buy'
        ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
        : { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  }
}

/** One roll's score: the dice sum without the lowest die. */
export function rollTotal(dice: readonly number[]): number {
  return [...dice]
    .sort((a, b) => a - b)
    .slice(ROLL.dropLowest)
    .reduce((a, b) => a + b, 0)
}

export const rollTotals = (rolls: readonly (readonly number[])[]): number[] => rolls.map(rollTotal)

/** Point buy cost of one base score; undefined outside 8 to 15. */
export const pointCost = (score: number): number | undefined => POINT_BUY.costs[String(score)]

/** Points spent by the assigned scores (unassigned count as 8). */
export function pointsSpent(scores: Scores): number {
  return ABILITY_KEYS.reduce((sum, k) => sum + (pointCost(scores[k] ?? POINT_BUY.min) ?? 0), 0)
}

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b).join()

/**
 * The pool values not yet taken by another ability (duplicates counted), for the assignment
 * selects. `except` is the ability being edited: its own value stays available.
 */
export function availableValues(
  pool: readonly number[],
  scores: Scores,
  except: AbilityKey
): number[] {
  const left = [...pool]
  for (const k of ABILITY_KEYS) {
    const v = scores[k]
    if (k === except || v === null) continue
    const i = left.indexOf(v)
    if (i >= 0) left.splice(i, 1)
  }
  return left.sort((a, b) => b - a)
}

/**
 * Why an AI-proposed arrangement is not legal, or null when it is: a permutation of the standard
 * array (or of the rolled `pool` of totals), or a point buy spend within the budget. Pure code
 * decides legality; the model only ever sees totals.
 */
export function arrangementProblem(
  method: CharacterDraft['abilityMethod'],
  scores: Scores,
  pool: readonly number[]
): string | null {
  const values = ABILITY_KEYS.map((k) => scores[k] as number)
  if (values.some((v) => !Number.isInteger(v))) return 'every ability needs a whole-number score'
  if (method === 'standard-array' || method === 'rolling') {
    const allowed = method === 'standard-array' ? STANDARD_ARRAY : pool
    return sorted(values) === sorted(allowed)
      ? null
      : `use each of ${allowed.join(', ')} exactly once`
  }
  if (method === 'point-buy') {
    if (values.some((v) => pointCost(v) === undefined)) {
      return `base scores must be between ${POINT_BUY.min} and ${POINT_BUY.max}`
    }
    const spent = pointsSpent(scores)
    return spent > POINT_BUY.budget
      ? `${spent} points is over the ${POINT_BUY.budget} budget`
      : null
  }
  return 'no ability score method is chosen'
}

/** Checks the method, the six base scores and (for rolling) the rolled set. */
export function validateAbilityScores(
  method: CharacterDraft['abilityMethod'],
  scores: Scores,
  rolls: readonly (readonly number[])[] | null
): AbilityValidation {
  if (!method) return { state: 'incomplete', issues: ['Choose how to set your ability scores.'] }

  const issues: string[] = []
  if (method === 'rolling' && !rolls?.length) {
    return { state: 'incomplete', issues: ['Roll your ability scores.'] }
  }
  if (ABILITY_KEYS.some((k) => scores[k] === null)) {
    return { state: 'incomplete', issues: ['Assign a score to every ability.'] }
  }
  const values = ABILITY_KEYS.map((k) => scores[k] as number)

  if (method === 'standard-array') {
    if (sorted(values) !== sorted(STANDARD_ARRAY)) {
      issues.push(`Use each of ${STANDARD_ARRAY.join(', ')} exactly once.`)
    }
  } else if (method === 'point-buy') {
    if (values.some((v) => pointCost(v) === undefined)) {
      issues.push(`Base scores must be between ${POINT_BUY.min} and ${POINT_BUY.max}.`)
    } else if (pointsSpent(scores) > POINT_BUY.budget) {
      issues.push(`You have spent ${pointsSpent(scores)} of ${POINT_BUY.budget} points.`)
    }
  } else {
    const valid =
      rolls!.length === ROLL.count &&
      rolls!.every(
        (r) =>
          r.length === ROLL.dice && r.every((d) => Number.isInteger(d) && d >= 1 && d <= ROLL.sides)
      )
    if (!valid) issues.push('The rolled set is not valid; roll again.')
    else if (sorted(values) !== sorted(rollTotals(rolls!))) {
      issues.push('Assign each rolled total to exactly one ability.')
    }
  }
  return { state: issues.length ? 'attention' : 'valid', issues }
}

/**
 * The Ability scores step's validity (#110): the method's rules, plus the race's "choose abilities"
 * bonus groups (Half-Elf's two +1 picks), which live in `draft.picks`.
 */
export function validateAbilitiesStep({ draft, resolved }: StepContext): StepValidation {
  const base = validateAbilityScores(draft.abilityMethod, draft.baseScores, draft.abilityRolls)
  const issues = [...base.issues]
  let state = base.state
  for (const g of resolved.groups.filter((g) => g.kind === 'abilityBonus')) {
    if (g.status === 'valid') continue
    if (g.status === 'attention') {
      issues.push('A racial ability bonus choice is not allowed; change it.')
      state = 'attention'
    } else {
      issues.push(`Choose ${g.choose} abilities for your racial bonus.`)
      if (state === 'valid') state = 'incomplete'
    }
  }
  return { state, issues }
}
