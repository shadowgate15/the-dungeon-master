import { timingSafeEqual } from 'node:crypto'
import type { ToolHost } from '../tools/host'
import type { Channels } from './channels'

/** Where the bridge API lives on the game server. */
export const BRIDGE_API = '/api/bridge'

type Options = { host: ToolHost; channels: Channels; token: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function authorized(request: Request, token: string): boolean {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${token}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const encoder = new TextEncoder()

/** A Campaign's channel events as Server-Sent Events, until the bridge hangs up. */
function eventStream(channels: Channels, folder: string): Response {
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
      }
    },
    cancel: () => stop()
  })
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
  })
}

/**
 * The game server's interface for the bridge, gated by the runtime token:
 * - `GET  tools`: the tool list, so tools change without republishing the plugin.
 * - `POST call` with `{campaign, name, arguments}`: one tool call for the Campaign folder.
 * - `GET  events?campaign=<folder>`: the Campaign's channel events as SSE.
 */
export function createBridgeApi({ host, channels, token }: Options) {
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
      return json(host.call(campaign, name, args))
    }

    if (route === 'events' && request.method === 'GET') {
      const campaign = url.searchParams.get('campaign')
      if (!campaign) return json({ error: 'campaign is required' }, 400)
      return eventStream(channels, campaign)
    }

    return json({ error: 'not found' }, 404)
  }
}

export type BridgeApi = ReturnType<typeof createBridgeApi>
