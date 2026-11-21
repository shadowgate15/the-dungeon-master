/**
 * One structured request for a ruling step (Adjudication or Effect), validated in code. The step's
 * context is built from the Scene, the recent events and the Declaration, and reported for the
 * stats. An answer that fails validation is asked again once; if the retry fails too, the step's
 * safe default stands in, so one bad answer never stalls an Exchange. A model or transport error
 * is not retried: it throws.
 */
import type { Clarification } from '#lib/session/call.ts'
import type { SceneState, SessionEvent } from '#lib/session/enums.ts'
import { callModel, type ChatRequest } from '../../ai/port.ts'
import { buildRulingContext, type RulingContextInput } from '../context/ruling.ts'
import { characterOf, eventsBefore, type ExchangeContext } from './context.ts'

/** How many times an invalid answer is asked again before the default applies. */
const RETRIES = 1

type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

export interface RulingRequest<T> {
  role: RulingContextInput['role']
  system: string
  scene: SceneState
  declaration: SessionEvent
  clarifying: Clarification[]
  maxTokens: number
  outputSchema: NonNullable<ChatRequest['outputSchema']>
  validate: (answer: unknown) => Validation<T>
  /** The safe default once the retry is also invalid. */
  fallback: T
}

/** Asks one ruling step. `defaulted` says the fallback stood in for two invalid answers. */
export async function askRuling<T>(
  ctx: ExchangeContext,
  request: RulingRequest<T>
): Promise<{ value: T; defaulted: boolean }> {
  const built = buildRulingContext({
    role: request.role,
    system: request.system,
    scene: request.scene,
    events: eventsBefore(ctx, request.declaration),
    character: characterOf(ctx),
    declaration: request.declaration.text ?? '',
    clarifying: request.clarifying
  })
  ctx.report?.(built.report)
  const chat: ChatRequest = {
    systemPrompts: [request.system],
    messages: [{ role: 'user', content: built.content }],
    maxTokens: request.maxTokens,
    outputSchema: request.outputSchema,
    threadId: ctx.sessionId,
    signal: ctx.signal
  }
  for (let attempt = 0; ; attempt++) {
    const call = await callModel(ctx.port, chat)
    if (!call.ok) throw new Error(call.failure.message)
    const valid = request.validate(call.object)
    if (valid.ok) return { value: valid.value, defaulted: false }
    if (attempt === RETRIES) {
      ctx.tally?.('default')
      return { value: request.fallback, defaulted: true }
    }
    ctx.tally?.('retry')
  }
}
