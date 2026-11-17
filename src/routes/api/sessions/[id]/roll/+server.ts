import { json } from '@sveltejs/kit'
import { sceneRunner } from '#lib/server/session/index.ts'
import type { ResolveRefusal } from '#lib/server/session/scene-runner.ts'
import type { RequestHandler } from './$types'

const STATUS: Record<ResolveRefusal, number> = {
  'not-found': 404,
  ended: 409,
  'in-flight': 409,
  'no-pending-roll': 409
}

/**
 * Resolves the Session's pending roll: code rolls the d20, then the pipeline continues so the
 * outcome is narrated. Streams like the action route: newline-delimited JSON pipeline events.
 */
export const POST: RequestHandler = ({ params }) => {
  const controller = new AbortController()
  const result = sceneRunner.resolveRoll(params.id, controller.signal)
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
    cancel: () => controller.abort()
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } })
}
