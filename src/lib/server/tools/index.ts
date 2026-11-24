import type { GameTool } from './contract'
import { knowledgeTools } from './knowledge-tools'
import { narrationTools } from './narration-tools'
import { seedTools } from './seed-tools'
import { worldTools } from './world-tools'

/** Every game tool the server exposes to the DM. */
export const gameTools: GameTool[] = [
  ...seedTools,
  ...worldTools,
  ...knowledgeTools,
  ...narrationTools
]
