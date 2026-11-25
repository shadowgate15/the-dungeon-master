import { z } from 'zod'
import { lintWorld } from '../world/lint'
import { writeTool } from './contract'

/**
 * Lint: the DM tidies its own World. Its only effect is one DM-only `lint_ran` event, which marks
 * when lint last ran; it changes no World or Knowledge state, and its findings never reach the
 * Player (no activity line).
 */
export const lintTools = [
  writeTool({
    name: 'lint',
    description:
      'Check the World for what code can detect: near-duplicate names, broken [[links]], Facts restating a typed field, Beliefs pointing at retired Facts and Pages linking to retired Entities. Also returns the Pages of Entities changed since the last lint, for you to check each Page against its fields. Changes nothing: fix each finding with the ordinary tools. Run it when ending a Session.',
    input: z.object({}),
    run: (ctx) => {
      const result = lintWorld(ctx)
      return {
        result,
        skill: 'lint-review',
        event: {
          kind: 'lint_ran',
          summary: `Lint found ${result.findings.length} finding(s)`,
          data: { findings: result.findings.length },
          dmOnly: true
        }
      }
    }
  })
]
