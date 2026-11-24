import type { HpState } from './hp-state'

/** A Character as the rail shows them. */
export type SceneCharacter = { id: string; name: string }

/**
 * The Scene as the Player sees it: the clock, the spotlight's Place and the Party, split into who
 * is present and who is elsewhere (with where they are). Only Characters' own surroundings: no
 * NPCs, no handles.
 */
export type SceneView = {
  clock: { minute: number; day: number; time: string }
  /** Null before the DM first sets the Scene. */
  place: { name: string } | null
  present: SceneCharacter[]
  elsewhere: (SceneCharacter & { whereabouts: string | null })[]
  /** The live Combat, or null (left out where no Combat could be live). */
  combat?: CombatView | null
}

/** One combatant in the initiative list. */
export type CombatEntry = {
  key: string
  name: string
  kind: 'character' | 'npc' | 'creature'
  /** The Character's id, for a Character; null for an NPC or Creature. */
  characterId: string | null
  initiative: number
  /** Whose turn it is. */
  current: boolean
  /** An NPC or Creature's HP as a state, never a number; null for a Character. */
  state: HpState | null
}

/**
 * The live Combat as the Player's rail shows it: the round (0 until every initiative is in), the
 * initiative order with the current turn marked, and who has still to roll. No handles, no enemy
 * HP numbers.
 */
export type CombatView = {
  round: number
  order: CombatEntry[]
  waiting: string[]
}
