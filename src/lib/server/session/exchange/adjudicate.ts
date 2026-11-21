/**
 * Adjudication: one non-streaming structured request that rules how the Declaration resolves.
 * Code validates the answer before anything changes state.
 */
import type { Clarification } from '#lib/session/call.ts'
import type { SessionEvent } from '#lib/session/enums.ts'
import { buildRulingContext } from '../context/ruling.ts'
import { askValidated } from './ask.ts'
import { characterOf, eventsBefore, type ExchangeContext } from './context.ts'
import {
  ADJUDICATION_SYSTEM,
  adjudicationSchema,
  validateAdjudication,
  type Adjudication,
  type Effect
} from './contract.ts'

/** Room for the flat answer, as the eval sent it. */
const ADJUDICATION_MAX_TOKENS = 200

/** A ruling, and the Effect it already settles (the default's `none`), which skips Effect. */
export interface Ruled {
  adjudication: Adjudication
  effect?: Effect
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
  const built = buildRulingContext({
    role: 'adjudication',
    system: ADJUDICATION_SYSTEM,
    scene: ctx.sessions.scene(ctx.sessionId),
    events: eventsBefore(ctx, declaration),
    character: characterOf(ctx),
    declaration: declaration.text ?? '',
    clarifying
  })
  ctx.report?.(built.report)
  const asked = await askValidated(
    ctx,
    {
      systemPrompts: [ADJUDICATION_SYSTEM],
      messages: [{ role: 'user', content: built.content }],
      maxTokens: ADJUDICATION_MAX_TOKENS,
      outputSchema: adjudicationSchema,
      threadId: ctx.sessionId,
      signal: ctx.signal
    },
    (answer) => {
      const valid = validateAdjudication(answer)
      return valid.ok ? { ok: true, value: valid.adjudication } : valid
    },
    { outcome: 'happens' }
  )
  return asked.defaulted
    ? { adjudication: asked.value, effect: { effect: 'none' } }
    : { adjudication: asked.value }
}
