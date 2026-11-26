import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { BRIDGE_API, createBridgeApi } from '../lib/server/bridge/api'
import { createPermissions } from '../lib/server/bridge/permissions'
import { createSessions } from '../lib/server/bridge/sessions'
import { createLiveUpdates, LIVE_STREAM } from '../lib/server/live'
import { writeRuntimeFile } from '../lib/server/runtime'
import { gameTools } from '../lib/server/tools'
import { createToolHost } from '../lib/server/tools/host'
import { createDmChannels } from '../lib/server/play/notices'
import { createPlay, openSessionsOnAttach } from '../lib/server/play/play'
import { testLibrary } from './library'

/**
 * A game server for Vitest: the real Campaign library, tool host, bridge API and the browser's
 * live updates stream over plain node:http on a free port, with its runtime file in a temporary user-level directory.
 */
export async function startTestGameServer({ home }: { home: string }) {
  const sessions = createSessions()
  const library = testLibrary({ home, live: (id) => sessions.attached(id) })
  const channels = createDmChannels(library)
  const live = createLiveUpdates({ sessions })
  const host = createToolHost({ library, tools: gameTools, publish: live.publish })
  const play = createPlay({ library, channels, publish: live.publish })
  openSessionsOnAttach(sessions, play)
  const permissions = createPermissions({ channels, sessions, publish: live.publish })
  const token = 'test-token'
  const api = createBridgeApi({ library, host, channels, sessions, permissions, play, token })
  const seen: string[] = []

  const server = http.createServer(async (req, res) => {
    const url = `http://${req.headers.host}${req.url}`
    seen.push(`${req.method} ${new URL(url).pathname}`)
    const pathname = new URL(url).pathname
    const handle =
      pathname === LIVE_STREAM ? () => live.stream() : pathname.startsWith(BRIDGE_API) ? api : null
    if (!handle) return res.writeHead(404).end()
    const body = req.method === 'GET' ? undefined : (Readable.toWeb(req) as ReadableStream)
    const response = await handle(
      new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body,
        duplex: 'half'
      } as RequestInit)
    )
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (!response.body) return res.end()
    const stream = Readable.fromWeb(response.body as never)
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  writeRuntimeFile(home, { port, token, pid: process.pid })

  let stopped = false
  return {
    url: `http://127.0.0.1:${port}`,
    library,
    channels,
    sessions,
    host,
    play,
    permissions,

    /** Requests the server has received, as `METHOD /path`. */
    requests: () => [...seen],

    /** Resolves once a bridge is listening for the Campaign's channel events. */
    async whenListening(folder: string, timeout = 5000) {
      const start = Date.now()
      while (!channels.listening(folder)) {
        if (Date.now() - start > timeout) throw new Error(`No bridge listening for ${folder}`)
        await new Promise((r) => setTimeout(r, 20))
      }
    },

    async stop() {
      if (stopped) return
      stopped = true
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      library.close()
    }
  }
}

export type TestGameServer = Awaited<ReturnType<typeof startTestGameServer>>
