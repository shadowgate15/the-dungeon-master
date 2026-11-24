import { z } from 'zod'
import { CurrentArcError, createArc } from '../story/arc'
import { ToolError, writeTool } from './contract'

const words = z.string().trim().min(1)

/** The Arc: the DM's hidden plan. Every Arc event is DM-only and never reaches the Player. */
export const arcTools = [
  writeTool({
    name: 'create_arc',
    description:
      'Create the current Arc (builder calls it at Begin and for each later Arc): a title, premise, stakes, the Acts in order (each a name, a purpose and its Beats in order, each a title and a description) and the intended resolution. Refused while a current Arc exists. Returns the Arc with its Beat handles and version. Never reaches the Player.',
    input: z.object({
      title: words,
      premise: words,
      stakes: words,
      acts: z
        .array(
          z.object({
            name: words,
            purpose: words,
            beats: z.array(z.object({ title: words, description: words })).min(1)
          })
        )
        .min(1),
      resolution: words
    }),
    activity: null,
    run: (ctx, input) => {
      let created
      try {
        created = createArc(ctx.db, input, ctx.now)
      } catch (e) {
        if (!(e instanceof CurrentArcError)) throw e
        throw new ToolError(
          'current_arc',
          e.message,
          'Read the current Arc; conclude or retire it before creating another'
        )
      }
      return {
        result: created,
        event: {
          kind: 'arc_created',
          summary: `Arc created: ${created.title}`,
          data: { title: created.title },
          dmOnly: true
        }
      }
    }
  })
]
