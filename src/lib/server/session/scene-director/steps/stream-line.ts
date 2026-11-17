import type { EventKind, Role } from '#lib/session/enums.ts'
import { streamText } from '../../../ai/port.ts'
import type { PipelineContext, PipelineEvent } from '../../scene-runner.ts'

interface StreamLineRequest {
  system: string
  /** The one user message the model answers. */
  content: string
  maxTokens: number
  /** What the in-flight deltas are attributed to. */
  role: Role
  kind: EventKind
  npcId?: string
  /** The failure message when the model finishes without any text. */
  emptyMessage: string
}

/**
 * One streamed model call that produces a line of the story: yields a `delta` per token and
 * returns the finished, trimmed text. Only a finished stream returns text; the caller saves it.
 * A stop yields `discard` and returns `undefined`; a model failure or an empty answer yields
 * `discard` and throws, so the log never gets an in-flight event.
 */
export async function* streamLine(
  ctx: PipelineContext,
  request: StreamLineRequest
): AsyncGenerator<PipelineEvent, string | undefined> {
  let text = ''
  let failure: string | undefined
  let finished = false
  for await (const step of streamText(ctx.port, {
    systemPrompts: [request.system],
    messages: [{ role: 'user', content: request.content }],
    maxTokens: request.maxTokens,
    threadId: ctx.sessionId,
    signal: ctx.signal
  })) {
    if (step.type === 'delta') {
      text += step.text
      yield {
        type: 'delta',
        role: request.role,
        kind: request.kind,
        text: step.text,
        ...(request.npcId !== undefined && { npcId: request.npcId })
      }
    } else if (step.type === 'error') failure = step.failure.message
    else if (step.type === 'done') finished = true
  }
  const line = text.trim()
  if (ctx.signal.aborted || failure || !finished || !line) {
    yield { type: 'discard' }
    if (ctx.signal.aborted) return undefined
    throw new Error(failure ?? request.emptyMessage)
  }
  return line
}
