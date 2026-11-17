import { error, json } from '@sveltejs/kit'
import { sceneRunner } from '#lib/server/session/index.ts'
import type { BeginRefusal } from '#lib/server/session/scene-runner.ts'
import type { RequestHandler } from './$types'

const STATUS: Record<BeginRefusal, number> = {
  'not-found': 404,
  ended: 409,
  'in-flight': 409,
  'roll-pending': 409,
  'empty-action': 400
}

/**
 * Plays one player action. Streams the pipeline events as newline-delimited JSON, one object per
 * line: `{type:'event', event}` for each saved event, then one `{type:'done', reason}`.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  if (!body || typeof body.text !== 'string') error(400, 'An action is required')

  const controller = new AbortController()
  const result = sceneRunner.begin(params.id, body.text, controller.signal)
  if (!result.ok) return json({ reason: result.reason }, { status: STATUS[result.reason] })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      try {
        for await (const step of result.events) {
          out.enqueue(encoder.encode(JSON.stringify(step) + '\n'))
        }
      } finally {
        out.close()
      }
    },
    // The client went away or pressed Stop: abort the run.
    cancel: () => controller.abort()
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } })
}
