/**
 * Code is the only roller. `createDice(seed)` is deterministic for tests; without a seed it
 * uses `Math.random`. `dice` is the process-wide roller: seeded from the `DICE_SEED` environment
 * variable when set (e2e runs), random otherwise. `random` has the shape of `Math.random`, so
 * helpers such as `rollAbilityScores` can take it.
 */
export interface Dice {
  /** A float in [0, 1), like `Math.random`. */
  random(): number
  /** One roll of a die with `sides` faces: an integer from 1 to `sides`. */
  roll(sides: number): number
  d20(): number
  /** Rolls an `NdM+K` expression such as `2d6+3`, `1d20-1` or `4d6`; throws on anything else. */
  rollExpression(expression: string): ExpressionRoll
}

/** A parsed `NdM+K` expression. */
export interface DiceExpression {
  count: number
  sides: number
  modifier: number
}

/** The outcome of an expression: every die rolled, the flat modifier and the total. */
export interface ExpressionRoll extends DiceExpression {
  expression: string
  dice: number[]
  total: number
}

const MAX_COUNT = 100
const MAX_SIDES = 1000
const EXPRESSION = /^(\d*)d(\d+)(?:([+-])(\d+))?$/

/** Parses `NdM+K` (count optional, modifier optional); throws on an invalid expression. */
export function parseDiceExpression(expression: string): DiceExpression {
  const match = EXPRESSION.exec(expression.replace(/\s+/g, '').toLowerCase())
  const count = match ? (match[1] === '' ? 1 : Number(match[1])) : 0
  const sides = match ? Number(match[2]) : 0
  if (!match || count < 1 || count > MAX_COUNT || sides < 1 || sides > MAX_SIDES) {
    throw new Error(`Invalid dice expression: ${JSON.stringify(expression)}`)
  }
  const modifier = match[4] === undefined ? 0 : Number(match[4]) * (match[3] === '-' ? -1 : 1)
  return { count, sides, modifier }
}

/** mulberry32: a small, fast, seedable generator; plenty for dice. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDice(seed?: number): Dice {
  const random = seed === undefined ? Math.random : mulberry32(seed)
  const roll = (sides: number) => 1 + Math.floor(random() * sides)
  const rollExpression = (expression: string): ExpressionRoll => {
    const parsed = parseDiceExpression(expression)
    const dice = Array.from({ length: parsed.count }, () => roll(parsed.sides))
    const total = dice.reduce((sum, die) => sum + die, parsed.modifier)
    return { expression, ...parsed, dice, total }
  }
  return { random, roll, d20: () => roll(20), rollExpression }
}

const envSeed = process.env.DICE_SEED

/** The process-wide roller; seeded by `DICE_SEED` when it is a number. */
export const dice: Dice = createDice(
  envSeed !== undefined && envSeed !== '' && Number.isFinite(Number(envSeed))
    ? Number(envSeed)
    : undefined
)
