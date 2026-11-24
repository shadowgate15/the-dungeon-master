import { z } from 'zod'
import { createRulesRepository } from '../rules/repository'
import { readTool, ToolError } from './contract'

/** SRD rules content: never secret, never World content, so kept apart from `search`. */
export const rulesTools = [
  readTool({
    name: 'lookup',
    description:
      'Read SRD rules data (spells, monsters, conditions, magic items, rules sections): by handle (spell:fireball, monster:goblin, condition:prone, magic-item:…, rule:…) or by a free-text query. Separate from the World search.',
    input: z
      .object({
        handle: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('A rules handle, such as spell:fireball'),
        query: z.string().trim().min(1).optional().describe('Words to search the rules for'),
        limit: z.number().int().min(1).max(25).optional()
      })
      .refine((i) => (i.handle === undefined) !== (i.query === undefined), {
        message: 'Pass exactly one of handle or query'
      }),
    activity: 'DM checks the rules',
    run: ({ db }, { handle, query, limit }) => {
      const rules = createRulesRepository(db)
      if (query !== undefined) return { results: rules.search(query, { limit }) }
      const found = rules.entry(handle!)
      if (!found) {
        throw new ToolError(
          'unknown_rules_entry',
          `No rules entry has the handle ${handle}`,
          'Find the handle with lookup({query}) and call again'
        )
      }
      return found
    }
  })
]
