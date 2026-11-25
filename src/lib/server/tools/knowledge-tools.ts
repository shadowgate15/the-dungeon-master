import { z } from 'zod'
import { createKnowledge, type RevealTarget } from '../knowledge/knowledge'
import { readTool, writeTool } from './contract'

const handle = z.string().min(1)

/** What a Reveal teaches: `of` a Fact, Entity or field, or a lie or rumour's own claim. */
export const revealTargetFields = {
  of: z
    .union([z.int(), handle])
    .optional()
    .describe('A Fact id, an Entity handle (its existence), or handle.field (its value now)'),
  claim: z.string().trim().min(1).optional().describe('A lie or rumour, never a Fact'),
  about: handle.optional().describe('The Entity the claim is about')
}

type TargetInput = { of?: number | string; claim?: string; about?: string }

const oneTarget = (i: TargetInput) =>
  i.of !== undefined ? i.claim === undefined : i.claim !== undefined && i.about !== undefined

/** The refinement a Reveal target needs: exactly one of `of`, or `claim` with `about`. */
export const revealTargetRule = [
  oneTarget,
  { message: 'Pass either of, or claim with about' }
] as const

/** The parsed target as the Knowledge layer takes it. */
export const revealTarget = (i: TargetInput): RevealTarget =>
  i.of !== undefined ? { of: i.of } : { claim: i.claim!, about: i.about! }

/** The Knowledge layer: who believes what (ADR 0007). */
export const knowledgeTools = [
  writeTool({
    name: 'reveal',
    description:
      "Make Holders learn something: pass `of` (a Fact id, an Entity handle, or handle.field) or a lie or rumour as `claim` + `about`. Holders default to the Characters in the Scene; name Characters (char:…) or NPCs to narrow or widen. A new Belief on the same Fact chain or field replaces the Holder's older one; name `replaces` for lies (or to re-point a rumour made true at its Fact). No version: it writes Beliefs, not the Entity. Returns the Beliefs created and the Holders skipped because they already believed it.",
    input: z
      .object({
        ...revealTargetFields,
        holders: z.array(handle).optional(),
        source: z.string().trim().min(1).optional().describe('Who or what they learned it from'),
        replaces: z.array(z.int()).default([])
      })
      .refine(...revealTargetRule),
    run: (ctx, { holders, source, replaces, ...rest }) => {
      const result = createKnowledge(ctx).reveal({
        ...revealTarget(rest),
        holders,
        source,
        replaces
      })
      return {
        result,
        event: {
          kind: 'beliefs_revealed',
          summary: `Revealed to ${result.beliefs.map((b) => b.holder).join(', ') || 'nobody new'}`,
          data: { beliefs: result.beliefs.map((b) => b.id), skipped: result.skipped },
          dmOnly: true
        }
      }
    }
  }),

  readTool({
    name: 'beliefs_of',
    description:
      "A Holder's Beliefs (a Character char:… or an NPC), optionally only those about one Entity: each claim, source and when it was learned, and `outdated` with the current truth beside it, so you voice a mistake on purpose. `history` adds replaced and retired Beliefs.",
    input: z.object({
      holder: handle,
      about: handle.optional(),
      history: z.boolean().default(false)
    }),
    run: (ctx, { holder, about, history }) => createKnowledge(ctx).beliefsOf(holder, about, history)
  })
]
