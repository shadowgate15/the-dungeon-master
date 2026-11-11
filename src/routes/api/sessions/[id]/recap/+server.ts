import { json } from '@sveltejs/kit'
import { recap, turnRunner } from '#lib/server/session/index.ts'
import type { RequestHandler } from './$types'

/**
 * The resume recap: `{ recap: string | null }`. A stateless side call, never saved and not a
 * Turn. It declines while the DM is generating, and a closed or aborted request cancels the
 * model call. Failure is silent: it reads as `null`.
 */
export const GET: RequestHandler = async ({ request, params }) => {
  if (turnRunner.isGenerating(params.id)) return json({ recap: null })
  const text = await recap.get(params.id, request.signal)
  return json({ recap: text ?? null })
}
