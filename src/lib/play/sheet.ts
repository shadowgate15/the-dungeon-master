import type { AbilityKey } from '#lib/rules/derive-stats.ts'

/**
 * One Character's play sheet, as the console's left column shows it: plain data the server builds
 * from the Character's play state and `deriveStats`. Every number is code's; nothing is computed
 * in the view.
 */
export interface PlaySheet {
  id: string
  name: string
  /** "Human Fighter 1". */
  headline: string
  /** Whether this Character can be the acting Character (see `canAct`). */
  canAct: boolean
  /** Where the Character is, when set. */
  whereabouts: string | null
  hp: { current: number; max: number | null; temp: number }
  /** Hit Dice: the die size, how many the Character has (its level) and how many are spent. */
  hitDice: { die: number; total: number; spent: number } | null
  /** AC from equipped armor and shield (`note` names them, or "unarmored"); null while underivable. */
  ac: { value: number; note: string } | null
  conditions: string[]
  /** The spell being concentrated on. */
  concentration: string | null
  abilities: { key: AbilityKey; score: number; modifier: number }[]
  attacks: { name: string; attackBonus: number; damage: string | null }[]
  /** Only the slot levels the Character has. */
  spellSlots: { level: number; max: number; spent: number }[]
  /** Features, with spent uses where play has spent any. */
  features: { slug: string; name: string; spent: number }[]
  inventory: { name: string; quantity: number; equipped: boolean }[]
  coin: { cp: number; sp: number; ep: number; gp: number; pp: number }
}
