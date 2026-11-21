/**
 * Adjudication: one non-streaming structured request that rules how the Declaration resolves.
 * Code validates the answer before anything changes state.
 */
import type { SessionEvent } from '#lib/session/enums.ts'
import { callModel } from '../../ai/port.ts'
import { buildRulingContext } from '../context/ruling.ts'
import { characterOf, eventsBefore, type ExchangeContext } from './context.ts'
import {
  ADJUDICATION_SYSTEM,
  adjudicationSchema,
  validateAdjudication,
  type Adjudication
} from './contract.ts'

/** Room for the flat answer, as the eval sent it. */
const ADJUDICATION_MAX_TOKENS = 200

/**
 * Asks the model to rule on the Declaration and returns the validated Adjudication. Throws on a
 * model error or an answer that fails validation.
 */
export async function adjudicate(
  ctx: ExchangeContext,
  declaration: SessionEvent
): Promise<Adjudication> {
  const built = buildRulingContext({
    role: 'adjudication',
    system: ADJUDICATION_SYSTEM,
    scene: ctx.sessions.scene(ctx.sessionId),
    events: eventsBefore(ctx, declaration),
    character: characterOf(ctx),
    declaration: declaration.text ?? ''
  })
  ctx.report?.(built.report)
  const call = await callModel(ctx.port, {
    systemPrompts: [ADJUDICATION_SYSTEM],
    messages: [{ role: 'user', content: built.content }],
    maxTokens: ADJUDICATION_MAX_TOKENS,
    outputSchema: adjudicationSchema,
    threadId: ctx.sessionId,
    signal: ctx.signal
  })
  if (!call.ok) throw new Error(call.failure.message)
  // #275 retries an invalid answer once, then defaults to happens.
  const valid = validateAdjudication(call.object)
  if (!valid.ok) throw new Error(`The Adjudication answer was invalid: ${valid.error}`)
  return valid.adjudication
}
