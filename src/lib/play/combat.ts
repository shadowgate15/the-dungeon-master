import type { CombatEntry, CombatView } from './scene'

/** Whose turn it is in the Combat, or null outside Combat or while it waits on initiative. */
export function turnOf(combat: CombatView | null | undefined): CombatEntry | null {
  return combat?.order.find((e) => e.current) ?? null
}

/**
 * The acting Character. In a running Combat the composer is locked to the Character whose turn it
 * is (none on an NPC's or Creature's turn) and the Player's pick waits; otherwise it is the viewed
 * Character when they can act in the Scene, else the last such pick, else the first who can act.
 */
export function actingCharacter<T extends { id: string }>(
  actors: T[],
  picked: string | null,
  combat: CombatView | null | undefined,
  lastPicked: string | null = null
): T | null {
  const turn = turnOf(combat)
  if (turn) return actors.find((a) => a.id === turn.characterId) ?? null
  return (
    actors.find((a) => a.id === picked) ??
    actors.find((a) => a.id === lastPicked) ??
    actors[0] ??
    null
  )
}
