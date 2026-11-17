// PROTOTYPE (throwaway): streams one pipeline run as NDJSON.
import { json } from '@sveltejs/kit'
import { isBusy, runPipeline } from '#lib/server/prototype/engine.ts'
import type { StepRequest } from '#lib/prototype/types.ts'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const body = ((await request.json().catch(() => null)) ?? {}) as StepRequest
  if (isBusy()) return json({ error: 'in-flight' }, { status: 409 })
  const abort = new AbortController()
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const msg of runPipeline(body, abort.signal)) {
          controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'))
        }
      } catch {
        // the client went away; the run already discarded its in-flight event
      }
      try {
        controller.close()
      } catch {
        // already closed by a cancel
      }
    },
    cancel() {
      abort.abort()
    }
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } })
}
