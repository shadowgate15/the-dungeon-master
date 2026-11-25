/**
 * How an NPC or Creature's HP reads to the Player: never a number, only a state.
 *
 * - `down`: 0 HP.
 * - `near death`: at or below a quarter of its maximum.
 * - `bloodied`: at or below half.
 * - `unhurt`: above half (a scratch doesn't show).
 */
export type HpState = 'unhurt' | 'bloodied' | 'near death' | 'down'

export function hpState(hp: number, max: number): HpState {
  if (hp <= 0) return 'down'
  if (hp * 4 <= max) return 'near death'
  if (hp * 2 <= max) return 'bloodied'
  return 'unhurt'
}
