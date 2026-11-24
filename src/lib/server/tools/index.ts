import type { GameTool } from './contract'
import { creationTools } from './creation-tools'
import { narrationTools } from './narration-tools'
import { seedTools } from './seed-tools'
import { worldTools } from './world-tools'

/** Every game tool the server exposes to the DM. */
export const gameTools: GameTool[] = [
  ...seedTools,
  ...creationTools,
  ...worldTools,
  ...narrationTools
]
