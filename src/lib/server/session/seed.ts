import type { SceneState } from '#lib/session/enums.ts'

/** A World location a first Scene can be seeded from. */
export interface SeedLocation {
  name: string
  description: string
}

/** The generic starting tavern, used when the Campaign's Worlds have no location. */
const TAVERN: SceneState = {
  location: {
    name: 'The Sleeping Griffin',
    description:
      'A low-beamed tavern warm with hearth smoke. Rain taps the shutters and a few travellers nurse their drinks.'
  },
  exits: [
    { id: 'front-door', name: 'The front door, out to the muddy road' },
    { id: 'cellar-stairs', name: 'The cellar stairs behind the bar' }
  ],
  objects: ['The hearth', 'A notice board by the door', 'A corner table with a half-finished game'],
  npcs: [
    {
      id: 'marta',
      name: 'Marta',
      attitude: 'friendly',
      knowledge: 'Runs the inn. Knows the local gossip and who has been asking after travellers.'
    },
    {
      id: 'old-tobb',
      name: 'Old Tobb',
      attitude: 'wary',
      knowledge: 'A farmer who saw lights on the north road last night.'
    }
  ],
  mode: 'exploration',
  dialogueNpcId: null,
  pendingRoll: null
}

/**
 * The first Scene of a Session. Seeded from the Campaign's first World location when there is one,
 * else the generic starting tavern. The data model has no World locations yet, so callers pass
 * none today; the seam is here for when it does.
 */
export function seedScene(firstLocation?: SeedLocation): SceneState {
  const scene = structuredClone(TAVERN)
  if (firstLocation) scene.location = { ...firstLocation }
  return scene
}
