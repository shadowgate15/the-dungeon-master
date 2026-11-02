import { json } from '@sveltejs/kit'
import { getAiStatus } from '#lib/server/ai/index.ts'
import type { RequestHandler } from './$types'

/** The browser never talks to LM Studio; it asks the server, which probes on every call. */
export const GET: RequestHandler = async () => json(await getAiStatus())
