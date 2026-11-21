/**
 * Adjudication: one non-streaming structured request that rules how the Declaration resolves.
 * Code validates the answer before anything changes state.
 */
import type { Clarification } from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import { askRuling } from './ask.ts'
import type { ExchangeContext } from './context.ts'
import {
  ADJUDICATION_SYSTEM,
  adjudicationSchema,
  validateAdjudication,
  type Adjudication
} from './contract.ts'

/** Room for the flat answer, as the eval sent it. */
const ADJUDICATION_MAX_TOKENS = 200

/**
 * A ruling. `defaulted` marks the stand-in `happens` after two invalid answers: it settles Effect
 * `none`, so no Effect is asked for or applied (not even a clicked one).
 */
export interface Ruled {
  adjudication: Adjudication
  defaulted: boolean
}

/**
 * Asks the model to rule on the Declaration, merged with any Clarifications so far, and returns
 * the validated Adjudication. An invalid answer is retried once, then defaults to `happens` with
 * Effect `none`, so the Reply still runs. Throws on a model error.
 */
export async function adjudicate(
  ctx: ExchangeContext,
  declaration: SessionEvent,
  clarifying: Clarification[] = []
): Promise<Ruled> {
  const asked = await askRuling<Adjudication>(ctx, {
    role: 'adjudication',
    system: ADJUDICATION_SYSTEM,
    scene: ctx.sessions.scene(ctx.sessionId),
    declaration,
    clarifying,
    maxTokens: ADJUDICATION_MAX_TOKENS,
    outputSchema: adjudicationSchema,
    validate: (answer) => {
      const valid = validateAdjudication(answer)
      return valid.ok ? { ok: true, value: valid.adjudication } : valid
    },
    fallback: { outcome: 'happens' }
  })
  return { adjudication: asked.value, defaulted: asked.defaulted }
}
