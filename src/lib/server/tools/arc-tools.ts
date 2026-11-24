import { z } from 'zod'
import {
  CurrentArcError,
  createArc,
  currentArc,
  pastArcs,
  resolveBeat,
  retireArc
} from '../story/arc'
import { readTool, ToolError, writeTool } from './contract'

const words = z.string().trim().min(1)
const version = z.number().int().positive()

/** Arc changes point the DM at the replanning procedure. */
const ARC_REVIEW = 'arc-review'

/** The Arc: the DM's hidden plan. Every Arc event is DM-only and never reaches the Player. */
export const arcTools = [
  readTool({
    name: 'arc',
    description:
      'Read the current Arc in full: its Acts, their Beats with descriptions, states and reasons, and the version every Arc write must pass. With history, also the concluded and retired Arcs (their resolutions and abandoned Beats are dangling threads). Never reaches the Player.',
    input: z.object({ history: z.boolean().optional() }),
    activity: null,
    run: (ctx, { history }) => ({
      current: currentArc(ctx.db),
      ...(history ? { history: pastArcs(ctx.db) } : {})
    })
  }),
  writeTool({
    name: 'resolve_beat',
    description:
      'Settle a pending Beat: reached when play clearly established its outcome, abandoned when the story made it impossible or irrelevant, with a one-line reason. Call it before narrate when play settles a Beat. Reaching a Beat in a later Act abandons the pending Beats of earlier Acts; the result lists them. When no Beat is left pending the Arc concludes and you must load arc-review. Never reaches the Player.',
    input: z.object({
      beat: words,
      version,
      to: z.enum(['reached', 'abandoned']),
      reason: words
    }),
    activity: null,
    run: (ctx, input) => {
      const result = resolveBeat(ctx, input)
      const concluded = result.arc.state === 'concluded'
      return {
        result,
        ...(concluded ? { skill: ARC_REVIEW } : {}),
        event: {
          kind: 'beat_resolved',
          summary: `${input.beat} ${input.to}: ${input.reason}${concluded ? ' (Arc concluded)' : ''}`,
          data: {
            beat: input.beat,
            to: input.to,
            abandoned: result.abandoned.map((b) => b.handle),
            concluded
          },
          dmOnly: true
        }
      }
    }
  }),
  writeTool({
    name: 'retire_arc',
    description:
      'Retire the current Arc when its premise or stakes no longer fit (otherwise revise it): every pending Beat is abandoned with the reason and returned. Then load arc-review. Never reaches the Player.',
    input: z.object({ version, reason: words }),
    activity: null,
    run: (ctx, input) => {
      const result = retireArc(ctx, input)
      return {
        result,
        skill: ARC_REVIEW,
        event: {
          kind: 'arc_retired',
          summary: `Arc retired: ${result.title}: ${input.reason}`,
          data: { abandoned: result.abandoned.map((b) => b.handle) },
          dmOnly: true
        }
      }
    }
  }),
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
