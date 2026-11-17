import type { SceneExit, SceneState } from '#lib/session/enums.ts'
import { seedScene } from '../seed.ts'

/** What waits beyond an exit: the next Scene's place, before code adds the mode and roll fields. */
type Place = Pick<SceneState, 'location' | 'exits' | 'objects' | 'npcs'>

const MUDDY_ROAD: Place = {
  location: {
    name: 'The Muddy Road',
    description:
      'A rutted track under a low grey sky. The lit windows of the Sleeping Griffin glow behind you.'
  },
  exits: [{ id: 'inn-door', name: 'The door of the Sleeping Griffin' }],
  objects: ['A leaning signpost', 'Fresh wheel ruts'],
  npcs: []
}

const CELLAR: Place = {
  location: {
    name: 'The Cellar',
    description: 'A cold, damp cellar of stacked barrels and sacks, smelling of earth and hops.'
  },
  exits: [{ id: 'inn-stairs', name: 'The stairs back up to the taproom' }],
  objects: ['Rows of barrels', 'A heap of grain sacks'],
  npcs: []
}

/**
 * Known destinations by exit id. World locations do not exist yet (see seed.ts), so the places
 * reachable from the starting tavern are listed here; the seam is `placeBeyond`.
 */
const KNOWN: Record<string, () => Place> = {
  'front-door': () => MUDDY_ROAD,
  'cellar-stairs': () => CELLAR,
  'inn-door': () => seedScene(),
  'inn-stairs': () => seedScene()
}

/**
 * The place an exit leads to. An exit with no known destination becomes a generic place named
 * after the exit, with a way back, so a move never dead-ends.
 */
export function placeBeyond(exit: SceneExit, fromName: string): Place {
  const known = KNOWN[exit.id]
  if (known) return structuredClone(known())
  return {
    location: { name: exit.name, description: '' },
    exits: [{ id: 'back', name: `Back to ${fromName}` }],
    objects: [],
    npcs: []
  }
}
