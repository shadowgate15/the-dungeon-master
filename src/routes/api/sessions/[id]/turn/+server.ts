import { json } from '@sveltejs/kit'
import { getContextLimit, lockReasoningModel } from '#lib/server/ai/index.ts'
import type { TextEvent } from '#lib/server/ai/port.ts'
import { turnRunner } from '#lib/server/session/index.ts'
import { turnEventsResponse } from '#lib/server/session/sse.ts'
import type { BeginRefusal } from '#lib/server/session/turn-runner.ts'
import type { RequestHandler } from './$types'

const REFUSAL_STATUS: Record<BeginRefusal, number> = {
  'not-found': 404,
  ended: 409,
  'in-flight': 409,
  'invalid-state': 409,
  'empty-action': 400
}

/** Reads the player's action from the AG-UI body TanStack's `fetchServerSentEvents` posts. */
function readAction(body: unknown): string | undefined {
  const props = (body as { forwardedProps?: { action?: unknown } } | null)?.forwardedProps
  return typeof props?.action === 'string' ? props.action : undefined
}

/** Whether the player clicked Roll: `forwardedProps.roll` is true. */
function readRoll(body: unknown): boolean {
  const props = (body as { forwardedProps?: { roll?: unknown } } | null)?.forwardedProps
  return props?.roll === true
}

/**
 * One streamed DM turn. With `forwardedProps.roll` the player answers a pending Roll request:
 * code rolls and saves the Roll result, then the DM narrates the outcome. With `forwardedProps.action` it saves the player's action first; with
 * none the DM opens the Session or answers an unanswered action (Retry). Answers SSE, or a JSON
 * `{ error }` with 400/404/409 when refused (not found, ended, a call already in flight, wrong
 * state, bad action). One abort controller is shared by the model call and the response, so
 * Stop and a closed tab both cancel the call and discard the partial DM turn.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  const body = await request.json().catch(() => null)
  const abortController = new AbortController()
  const relay = () => abortController.abort()
  if (request.signal.aborted) relay()
  else request.signal.addEventListener('abort', relay, { once: true })

  const begun = turnRunner.begin(
    params.id,
    { action: readAction(body), roll: readRoll(body), contextLimit: await getContextLimit() },
    abortController.signal
  )
  if (!begun.ok) {
    return json({ error: begun.reason }, { status: REFUSAL_STATUS[begun.reason] })
  }

  async function* observed(): AsyncGenerator<TextEvent> {
    for await (const event of begun.ok ? begun.events : []) {
      if (event.type === 'error' && event.failure.kind === 'reasoning-model') lockReasoningModel()
      yield event
    }
  }
  return turnEventsResponse(observed(), abortController, params.id)
}
