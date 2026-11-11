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
  return { random, roll, d20: () => roll(20) }
}

const envSeed = process.env.DICE_SEED

/** The process-wide roller; seeded by `DICE_SEED` when it is a number. */
export const dice: Dice = createDice(
  envSeed !== undefined && envSeed !== '' && Number.isFinite(Number(envSeed))
    ? Number(envSeed)
    : undefined
)
