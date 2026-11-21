/**
 * One structured request for a ruling step, validated in code. An answer that fails validation is
 * asked again once; if the retry fails too, the step's safe default stands in, so one bad answer
 * never stalls an Exchange. A model or transport error is not retried: it throws.
 */
import { callModel, type ChatRequest } from '../../ai/port.ts'
import type { ExchangeContext } from './context.ts'

/** How many times an invalid answer is asked again before the default applies. */
const RETRIES = 1

type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

export async function askValidated<T>(
  ctx: ExchangeContext,
  request: ChatRequest,
  validate: (answer: unknown) => Validation<T>,
  fallback: T
): Promise<{ value: T; defaulted: boolean }> {
  for (let attempt = 0; ; attempt++) {
    const call = await callModel(ctx.port, request)
    if (!call.ok) throw new Error(call.failure.message)
    const valid = validate(call.object)
    if (valid.ok) return { value: valid.value, defaulted: false }
    if (attempt === RETRIES) {
      ctx.tally?.('default')
      return { value: fallback, defaulted: true }
    }
    ctx.tally?.('retry')
  }
}
