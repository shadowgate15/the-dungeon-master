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
  /** Unarmored AC until equipped armor is tracked; null while it can't be derived. */
  ac: { value: number; note: string } | null
  conditions: string[]
  /** The spell being concentrated on. */
  concentration: string | null
  /** Death save tallies while alive at 0 HP; null otherwise. */
  deathSaves: { successes: number; failures: number; stable: boolean } | null
  abilities: { key: AbilityKey; score: number; modifier: number }[]
  attacks: { name: string; attackBonus: number; damage: string | null }[]
  /** Only the slot levels the Character has. */
  spellSlots: { level: number; max: number; spent: number }[]
  /** Features, with spent uses where play has spent any. */
  features: { slug: string; name: string; spent: number }[]
  inventory: { name: string; quantity: number }[]
}
