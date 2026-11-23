/**
 * Code is the only roller. `createDice(seed)` is deterministic for tests; without a seed it
 * uses `Math.random`. `campaignDice.for(campaignId)` is a Campaign's own roller, and `dice` the
 * process-wide one; both are seeded from the `DICE_SEED` environment variable when set (e2e runs),
 * random otherwise. `random` has the shape of `Math.random`, so helpers such as
 * `rollAbilityScores` can take it.
 */
export interface Dice {
  /** A float in [0, 1), like `Math.random`. */
  random(): number
  /** One roll of a die with `sides` faces: an integer from 1 to `sides`. */
  roll(sides: number): number
  d20(): number
  /**
   * Rolls an `NdM+K` expression such as `2d6+3`, `1d20-1` or `4d6`; throws on anything else.
   * With `crit`, the dice are rolled twice and the modifier added once (SRD critical hit damage).
   */
  rollExpression(expression: string, options?: { crit?: boolean }): ExpressionRoll
  /** A d20 roll; advantage and disadvantage roll two and keep the higher or lower. */
  rollD20(options?: D20Options): D20Roll
}

export type D20Mode = 'normal' | 'advantage' | 'disadvantage'

/** Advantage or disadvantage and why the roll has it (shown to the Player); omit for a normal roll. */
export interface D20Options {
  mode: 'advantage' | 'disadvantage'
  reason: string
}

/** Both d20s on advantage or disadvantage (one on a normal roll), the one kept and the reason. */
export type D20Roll =
  | { mode: 'normal'; dice: [number]; kept: number }
  | { mode: 'advantage' | 'disadvantage'; reason: string; dice: [number, number]; kept: number }

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
  /** Whether the dice were doubled for a critical hit. */
  crit: boolean
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

/** A seed, or a `Math.random`-shaped source (for loaded dice in tests). */
export type DiceSource = number | { random: () => number }

export function createDice(source?: DiceSource): Dice {
  const random =
    source === undefined
      ? Math.random
      : typeof source === 'number'
        ? mulberry32(source)
        : source.random
  const roll = (sides: number) => 1 + Math.floor(random() * sides)
  const rollExpression = (expression: string, { crit = false } = {}): ExpressionRoll => {
    const parsed = parseDiceExpression(expression)
    const count = crit ? parsed.count * 2 : parsed.count
    const dice = Array.from({ length: count }, () => roll(parsed.sides))
    const total = dice.reduce((sum, die) => sum + die, parsed.modifier)
    return { expression, ...parsed, dice, total, crit }
  }
  const rollD20 = (options?: D20Options): D20Roll => {
    if (!options) {
      const die = roll(20)
      return { mode: 'normal', dice: [die], kept: die }
    }
    const dice: [number, number] = [roll(20), roll(20)]
    const kept = options.mode === 'advantage' ? Math.max(...dice) : Math.min(...dice)
    return { mode: options.mode, reason: options.reason, dice, kept }
  }
  return { random, roll, d20: () => roll(20), rollExpression, rollD20 }
}

/** FNV-1a over the Campaign id, mixed with the base seed: one independent seed per Campaign. */
function campaignSeed(seed: number, campaignId: string): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < campaignId.length; i++) {
    hash = Math.imul(hash ^ campaignId.charCodeAt(i), 0x01000193) >>> 0
  }
  return hash
}

/** One roller per Campaign, so parallel Campaigns (and tests) never consume each other's rolls. */
export interface CampaignDice {
  /** The Campaign's roller; the same instance on every call, so its sequence carries on. */
  for(campaignId: string): Dice
}

/** With a seed, each Campaign's roller is seeded from it and the Campaign id; random otherwise. */
export function createCampaignDice(seed?: number): CampaignDice {
  const rollers = new Map<string, Dice>()
  return {
    for(campaignId) {
      let roller = rollers.get(campaignId)
      if (!roller) {
        roller = createDice(seed === undefined ? undefined : campaignSeed(seed, campaignId))
        rollers.set(campaignId, roller)
      }
      return roller
    }
  }
}

const envSeed = process.env.DICE_SEED
const seed =
  envSeed !== undefined && envSeed !== '' && Number.isFinite(Number(envSeed))
    ? Number(envSeed)
    : undefined

/** The process-wide roller; seeded by `DICE_SEED` when it is a number. */
export const dice: Dice = createDice(seed)

/** The process-wide per-Campaign rollers; seeded by `DICE_SEED` when it is a number. */
export const campaignDice: CampaignDice = createCampaignDice(seed)
