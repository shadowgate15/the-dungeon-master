import { timingSafeEqual } from 'node:crypto'
import { NotACampaignFolderError, type CampaignLibrary } from '../campaign/library'
import type { ToolHost } from '../tools/host'
import type { Play } from '../play/play'
import type { Channels } from './channels'
import type { Permissions } from './permissions'
import { SESSION_LIVE_MESSAGE, type Sessions } from './sessions'

/** Where the bridge API lives on the game server. */
export const BRIDGE_API = '/api/bridge'

/** The header naming the bridge's session: one random id per bridge process. */
export const SESSION_HEADER = 'x-dm-session'

type Options = {
  library: CampaignLibrary
  host: ToolHost
  channels: Channels
  sessions: Sessions
  play: Play
  permissions: Permissions
  token: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function authorized(request: Request, token: string): boolean {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${token}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const encoder = new TextEncoder()

/**
 * A Campaign's channel events (`event: channel`) and permission verdicts (`event: permission`)
 * as Server-Sent Events, until the bridge hangs up. While the stream
 * is open, the bridge's session is attached to the Campaign.
 */
function eventStream(channels: Channels, folder: string, detach: () => void): Response {
  let stop = () => {}
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text))
      write(': open\n\n')
      const unlisten = channels.listen(folder, (event) =>
        write(`event: channel\ndata: ${JSON.stringify(event)}\n\n`)
      )
      const unlistenVerdicts = channels.listenVerdicts(folder, (verdict) =>
        write(`event: permission\ndata: ${JSON.stringify(verdict)}\n\n`)
      )
      const keepAlive = setInterval(() => write(': ka\n\n'), 15_000)
      stop = () => {
        unlisten()
        unlistenVerdicts()
        clearInterval(keepAlive)
        detach()
      }
    },
    cancel: () => stop()
  })
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
  })
}

/** The refusal a second session gets, as `{code, message, next}`. */
const SESSION_LIVE = {
  code: 'session_live',
  message: SESSION_LIVE_MESSAGE,
  next: 'Tell the Player this table already has a DM: end the other session before using this one'
}

/**
 * The game server's interface for the bridge, gated by the runtime token:
 * - `GET  tools`: the tool list, so tools change without republishing the plugin.
 * - `POST call` with `{campaign, name, arguments}`: one tool call for the Campaign folder.
 * - `GET  events?campaign=<folder>`: the Campaign's channel events as SSE; holding it open
 *   attaches the bridge's session (`x-dm-session`). A second session is refused (409).
 * - `POST register` with `{folder}`: registers a Campaign folder (the launcher), answering
 *   `{id, name, attached}`.
 * - `POST stop-check` with `{campaign, again}`: whether the Stop hook refuses to end the DM's turn,
 *   as `{block, reason}`.
 * - `GET  core-block?campaign=<folder>`: the DM's core block, as `{text}`, for SessionStart.
 * - `POST permission_request` with `{campaign, request_id, tool_name, description, input_preview}`:
 *   the session's permission prompt, shown to the Player; the verdict comes back on `events`.
 */
export function createBridgeApi({
  library,
  host,
  channels,
  sessions,
  permissions,
  play,
  token
}: Options) {
  return async function handle(request: Request): Promise<Response> {
    if (!authorized(request, token)) return json({ error: 'bad token' }, 401)
    const url = new URL(request.url)
    const route = url.pathname.slice(BRIDGE_API.length + 1)

    if (route === 'tools' && request.method === 'GET') return json({ tools: host.list() })

    if (route === 'call' && request.method === 'POST') {
      const {
        campaign,
        name,
        arguments: args
      } = (await request.json()) as {
        campaign?: string
        name?: string
        arguments?: unknown
      }
      if (!campaign || !name) return json({ error: 'campaign and name are required' }, 400)
      const entry = library.entryAt(campaign)
      const session = request.headers.get(SESSION_HEADER) ?? ''
      if (entry && sessions.heldByOther(entry.id, session)) {
        return json({
          content: [{ type: 'text', text: JSON.stringify(SESSION_LIVE) }],
          isError: true
        })
      }
      // A tool call means the session moved on: any permission prompt was answered.
      if (entry) permissions.movedOn(entry.id)
      return json(host.call(campaign, name, args))
    }

    if (route === 'events' && request.method === 'GET') {
      const campaign = url.searchParams.get('campaign')
      if (!campaign) return json({ error: 'campaign is required' }, 400)
      const entry = library.entryAt(campaign)
      if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404)
      const session = request.headers.get(SESSION_HEADER) ?? crypto.randomUUID()
      if (!sessions.attach(entry.id, session)) return json(SESSION_LIVE, 409)
      return eventStream(channels, campaign, () => sessions.detach(entry.id, session))
    }

    if (route === 'stop-check' && request.method === 'POST') {
      const { campaign, again } = (await request.json()) as { campaign?: string; again?: boolean }
      const entry = campaign && library.entryAt(campaign)
      if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404)
      return json(play.stopCheck(entry.id, again === true))
    }

    if (route === 'core-block' && request.method === 'GET') {
      const campaign = url.searchParams.get('campaign')
      const entry = campaign && library.entryAt(campaign)
      if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404)
      return json({ text: play.coreBlock(entry.id) })
    }

    if (route === 'permission_request' && request.method === 'POST') {
      const body = (await request.json()) as Partial<Record<string, string>>
      const { campaign, request_id, tool_name } = body
      if (!campaign || !request_id || !tool_name) {
        return json({ error: 'campaign, request_id and tool_name are required' }, 400)
      }
      const entry = library.entryAt(campaign)
      if (!entry) return json({ error: `${campaign} is not a registered Campaign folder` }, 404)
      const session = request.headers.get(SESSION_HEADER) ?? ''
      if (sessions.heldByOther(entry.id, session)) return json(SESSION_LIVE, 409)
      permissions.request(entry.id, campaign, {
        requestId: request_id,
        toolName: tool_name,
        description: body.description ?? '',
        inputPreview: body.input_preview ?? ''
      })
      return json({ ok: true })
    }

    if (route === 'register' && request.method === 'POST') {
      const { folder } = (await request.json()) as { folder?: string }
      if (!folder) return json({ error: 'folder is required' }, 400)
      try {
        const { id, name } = library.register(folder)
        return json({ id, name, attached: sessions.attached(id) })
      } catch (e) {
        if (e instanceof NotACampaignFolderError) return json({ error: e.message }, 404)
        throw e
      }
    }

    return json({ error: 'not found' }, 404)
  }
}

export type BridgeApi = ReturnType<typeof createBridgeApi>
