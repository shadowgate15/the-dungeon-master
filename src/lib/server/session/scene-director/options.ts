import { moveOption } from './steps/move.ts'
import { narrateOption } from './steps/narrate.ts'
import { yieldOption } from './steps/yield.ts'
import type { MenuOption } from './types.ts'

/**
 * The Director's menu registry: one module per option under `steps/`, one line here. Order is the
 * order the Director sees. Later tickets add their options (NPC voice, movement, rolls) here.
 */
export const MENU_OPTIONS: MenuOption[] = [narrateOption, moveOption, yieldOption]
