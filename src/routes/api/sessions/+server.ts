import { json } from '@sveltejs/kit'
import { sessions } from '#lib/server/campaign/index.ts'
import type { RequestHandler } from './$types'

/** The ids of the Campaigns with a DM at the table. */
export const GET: RequestHandler = () => json({ attached: sessions.list() })
