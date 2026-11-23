import { timingSafeEqual } from 'node:crypto'
import { NotACampaignFolderError, type CampaignLibrary } from '../campaign/library'
import type { ToolHost } from '../tools/host'
import type { Channels } from './channels'
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
 * A Campaign's channel events as Server-Sent Events, until the bridge hangs up. While the stream
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
      const keepAlive = setInterval(() => write(': ka\n\n'), 15_000)
      stop = () => {
        unlisten()
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
 */
export function createBridgeApi({ library, host, channels, sessions, token }: Options) {
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
