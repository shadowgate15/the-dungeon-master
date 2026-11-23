import type { GameTool } from './contract'
import { seedTools } from './seed-tools'

/** Every game tool the server exposes to the DM. */
export const gameTools: GameTool[] = [...seedTools]
