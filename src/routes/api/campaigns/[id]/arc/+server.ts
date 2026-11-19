import { json } from '@sveltejs/kit'
import { z } from 'zod'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { arcs } from '#lib/server/arc/index.ts'
import type { ArcFailure, ArcStreamLine } from '#lib/arc/arc.ts'
import { generateArc } from '#lib/server/arc/generate.ts'
import { ArcLockedError, ArcValidationError } from '#lib/server/arc/service.ts'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { db } from '#lib/server/db/index.ts'
import type { RequestHandler } from './$types'

const campaigns = createCampaignService(db)

const text = z.string()
const editSchema = z.object({
  title: text,
  premise: text,
  stakes: text,
  resolution: text,
  acts: z.array(
    z.object({
      id: z.string().optional(),
      name: text,
      purpose: text,
      beats: z.array(z.object({ id: z.string().optional(), title: text, description: text }))
    })
  )
})

const bodySchema = z.union([
  z.object({ action: z.literal('generate') }),
  z.object({ action: z.literal('save'), arc: editSchema, accept: z.boolean().optional() })
])

function problem(error: unknown) {
  if (error instanceof ArcLockedError) return json({ error: error.message }, { status: 409 })
  if (error instanceof ArcValidationError) return json({ error: error.message }, { status: 400 })
  throw error
}

/**
 * Runs generation and streams it as newline-delimited JSON (`ArcStreamLine`). request.signal
 * fires when the browser drops the request (Stop), which cancels the model call; nothing is
 * stored then.
 */
function generationStream(
  campaign: NonNullable<ReturnType<typeof campaigns.get>>,
  port: NonNullable<ReturnType<typeof getChatPort>>,
  signal: AbortSignal
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: ArcStreamLine) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
        } catch {
          // The client is gone (Stop); there is no one to tell.
        }
      }
      try {
        const result = await generateArc(
          port,
          {
            name: campaign.name,
            premise: campaign.premise,
            tone: campaign.tone,
            length: campaign.length,
            worlds: campaign.worlds.map((w) => ({ name: w.name, premise: w.premise }))
          },
          { signal, onProgress: (step) => send({ type: 'progress', step }) }
        )
        if (!result.ok) {
          if (result.failure.kind === 'reasoning-model') lockReasoningModel()
          send({ type: 'result', ok: false, failure: result.failure })
        } else {
          arcs.replaceWithDraft(campaign.id, result.arc)
          send({ type: 'result', ok: true })
        }
      } catch (error) {
        // The draft could not be stored. As on the pre-stream path, the player sees the rule's
        // own message; the Arc stays as it was.
        const failure: ArcFailure =
          error instanceof ArcLockedError || error instanceof ArcValidationError
            ? { kind: 'invalid-output', message: error.message }
            : { kind: 'provider-error', message: 'The Arc could not be generated.' }
        send({ type: 'result', ok: false, failure })
      }
      try {
        controller.close()
      } catch {
        // Already closed by the client.
      }
    }
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } })
}

/**
 * The Campaign page's Arc actions. `generate` replaces the whole Arc with a draft on success;
 * on failure or Stop the current Arc is untouched. It answers an NDJSON stream (progress lines,
 * then one result line); rejections before generation starts are plain JSON (`{ error }`, or
 * `{ ok: false, failure, status }` when the AI is unavailable). `save` stores the player's
 * edits, and with `accept` accepts the Arc, answering `{ ok: true }` or `{ error }`.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })
  const campaign = campaigns.get(params.id)
  if (!campaign) return json({ error: 'Campaign not found' }, { status: 404 })
  const body = parsed.data

  try {
    if (body.action === 'save') {
      arcs.save(campaign.id, body.arc, { accept: body.accept })
      return json({ ok: true })
    }

    if (!arcs.availability(campaign.id).canGenerate) {
      return json({ error: 'An Arc cannot be generated for this Campaign' }, { status: 409 })
    }
    const port = getChatPort()
    if (!port) return json({ error: 'AI is not configured' }, { status: 503 })
    if (isReasoningModelLocked()) {
      return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
    }
    const status = await getAiStatus()
    const unavailable = unavailableFailure(status)
    if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

    return generationStream(campaign, port, request.signal)
  } catch (error) {
    return problem(error)
  }
}
