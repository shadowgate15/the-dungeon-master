import { z } from 'zod'
import skills from '#lib/rules/data/skills.json'
import { ABILITY_KEYS } from '#lib/rules/registry.ts'
import type { RollRequest } from '#lib/session/enums.ts'
import type { ChatTool } from '../ai/port.ts'

/**
 * The `request_roll` server tool: how the DM asks for an ability or skill check. The tool never
 * executes; it needs approval, so the run pauses on a valid call and the player's click is the
 * approval (see the turn-runner). Invalid input never reaches that pause: TanStack AI validates
 * it against this schema and sends the error back to the model.
 */

export const ROLL_TOOL_NAME = 'request_roll'
export const DC_MIN = 5
export const DC_MAX = 30
/** Invalid calls sent back to the model in one run before the run fails. */
export const MAX_ROLL_REJECTIONS = 2

const SKILL_KEYS = skills.map((s) => s.slug)
const KEYS = [...ABILITY_KEYS, ...SKILL_KEYS] as [string, ...string[]]

const rollInput = z.object({
  check: z.enum(['ability', 'skill']).describe('"ability" for a raw ability check, else "skill"'),
  key: z
    .enum(KEYS)
    .describe('An ability (str, dex, con, int, wis, cha) or a skill (e.g. stealth, athletics)'),
  dc: z.number().int().min(DC_MIN).max(DC_MAX).describe('The difficulty class, 5 (easy) to 30'),
  reason: z.string().trim().min(1).max(300).describe('Why the check is needed, shown to the player')
})

/** The request in the shape stored on a DM turn, or undefined when the input is not valid. */
export function parseRollRequest(input: unknown): RollRequest | undefined {
  const parsed = rollInput.safeParse(input)
  if (!parsed.success) return undefined
  const { key, dc, reason } = parsed.data
  // The key decides the kind, so a model that mislabels it cannot ask for a nonsense check.
  const check = (ABILITY_KEYS as readonly string[]).includes(key) ? 'ability' : 'skill'
  return { check, key, dc, reason }
}

export const rollTool: ChatTool = {
  name: ROLL_TOOL_NAME,
  description:
    'Ask the player to make an ability or skill check when an action has an uncertain outcome. ' +
    'The player rolls; you receive the result next turn. Call it at most once, after any narration ' +
    'that sets up the check, and do not narrate the outcome yet.',
  inputSchema: z.toJSONSchema(rollInput) as Record<string, unknown>,
  needsApproval: true,
  execute: () => undefined
}
