import { json } from '@sveltejs/kit'
import { permissions } from '#lib/server/bridge/index.ts'
import { library } from '#lib/server/campaign/index.ts'
import type { PermissionBehavior } from '#lib/play/permission.ts'
import type { RequestHandler } from './$types'

/** The permission prompt the Campaign's session is waiting on: `{ request }`, null when none. */
export const GET: RequestHandler = ({ params }) => {
  if (!library.get(params.id)) return json({ error: 'Campaign not found' }, { status: 404 })
  return json({ request: permissions.pending(params.id) })
}

/**
 * The Player answers the prompt with `{ request_id, behavior: 'allow' | 'deny' }`. 409 `{ error }`
 * when it is no longer waiting (answered in the terminal first); 400 on a bad body.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  if (!library.get(params.id)) return json({ error: 'Campaign not found' }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as {
    request_id?: unknown
    behavior?: unknown
  }
  const behavior = body.behavior as PermissionBehavior
  if (typeof body.request_id !== 'string' || (behavior !== 'allow' && behavior !== 'deny')) {
    return json(
      { error: "request_id and behavior ('allow' or 'deny') are required" },
      { status: 400 }
    )
  }
  if (!permissions.answer(params.id, body.request_id, behavior)) {
    return json({ error: 'That permission request was already answered' }, { status: 409 })
  }
  return json({ answered: true })
}
