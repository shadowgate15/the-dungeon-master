import fs from 'node:fs'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type JSONRPCMessage
} from '@modelcontextprotocol/sdk/types.js'
import { campaignDatabasePath, userStateDir } from '../lib/server/campaign/paths'
import { readRuntimeFile } from '../lib/server/runtime'

/**
 * The newest MCP protocol revision channels register on. A client asking for anything newer is
 * answered with this one.
 */
export const CHANNEL_PROTOCOL_VERSION = '2025-06-18'

const API = '/api/bridge'

const NOT_RUNNING: CallToolResult = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        code: 'server_not_running',
        message: 'game server not running',
        next: 'Tell the Player to start it by running dm in the Campaign folder, then call again'
      })
    }
  ],
  isError: true
}

class ServerDown extends Error {}

type Env = Record<string, string | undefined>

/** The Campaign folder Claude Code started in, or undefined outside a Campaign folder. */
function campaignFolder(env: Env, cwd: string): string | undefined {
  const folder = path.resolve(env.CLAUDE_PROJECT_DIR || cwd)
  return fs.existsSync(campaignDatabasePath(folder)) ? folder : undefined
}

/**
 * The stateless stdio MCP and channel server Claude Code spawns. It owns nothing: it finds its
 * Campaign by folder, fetches the tool list from the game server, proxies tool calls, and relays
 * the server's channel events into the session. Outside a Campaign folder it exposes nothing.
 */
export async function startBridge({ env = process.env, cwd = process.cwd() } = {}) {
  const folder = campaignFolder(env, cwd)
  const home = userStateDir(env)
  const log = (...parts: unknown[]) => process.stderr.write(`[dm-bridge] ${parts.join(' ')}\n`)

  async function api(route: string, init?: RequestInit): Promise<Response> {
    const runtime = readRuntimeFile(home)
    if (!runtime) throw new ServerDown()
    try {
      return await fetch(`http://localhost:${runtime.port}${API}/${route}`, {
        ...init,
        headers: { authorization: `Bearer ${runtime.token}`, 'content-type': 'application/json' }
      })
    } catch {
      throw new ServerDown()
    }
  }

  const server = new Server(
    { name: 'the-dungeon-master', version: '0.0.1' },
    {
      capabilities: folder
        ? {
            tools: { listChanged: true },
            experimental: { 'claude/channel': {}, 'claude/channel/permission': {} }
          }
        : { tools: {} }
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!folder) return { tools: [] }
    try {
      const res = await api('tools')
      if (!res.ok) throw new ServerDown()
      return (await res.json()) as { tools: [] }
    } catch {
      return { tools: [] }
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    if (!folder) {
      return {
        content: [{ type: 'text', text: 'Not a Campaign folder: the game has no tools here.' }],
        isError: true
      }
    }
    try {
      const res = await api('call', {
        method: 'POST',
        body: JSON.stringify({
          campaign: folder,
          name: request.params.name,
          arguments: request.params.arguments ?? {}
        })
      })
      if (!res.ok) throw new ServerDown()
      return (await res.json()) as CallToolResult
    } catch (e) {
      if (e instanceof ServerDown) return NOT_RUNNING
      throw e
    }
  })

  /** Relays the Campaign's channel events, reconnecting while the server is away. */
  async function relayChannel(campaign: string) {
    for (;;) {
      try {
        const res = await api(`events?campaign=${encodeURIComponent(campaign)}`)
        if (!res.ok || !res.body) throw new ServerDown()
        const decoder = new TextDecoder()
        let buffer = ''
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true })
          let end: number
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const data = /^data: (.*)$/m.exec(block)?.[1]
            if (/^event: channel$/m.test(block) && data) {
              await server.notification({
                method: 'notifications/claude/channel',
                params: JSON.parse(data)
              })
            }
          }
        }
      } catch (e) {
        if (!(e instanceof ServerDown)) log('channel stream:', e)
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  if (folder) server.oninitialized = () => void relayChannel(folder)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Pin the protocol revision: channels only register on CHANNEL_PROTOCOL_VERSION or older.
  const receive = transport.onmessage
  transport.onmessage = (message: JSONRPCMessage) => {
    if ('method' in message && message.method === 'initialize' && message.params) {
      const asked = String(message.params.protocolVersion)
      if (asked > CHANNEL_PROTOCOL_VERSION)
        message.params.protocolVersion = CHANNEL_PROTOCOL_VERSION
    }
    receive?.(message)
  }

  process.stdin.on('end', () => process.exit(0))
}
