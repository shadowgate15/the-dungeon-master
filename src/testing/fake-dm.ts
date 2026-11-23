import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { ServerCapabilities, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

/** The committed bridge bundle, spawned with plain Node like Claude Code does. */
export const BRIDGE_BUNDLE = path.resolve(import.meta.dirname, '../../plugin/bin/dm-bridge.mjs')

/** A channel event as the session receives it. */
export type ChannelEvent = { content: string; meta: Record<string, string> }

/**
 * One step of a fake DM script: the next channel event must have `meta.kind === on`. `run` may
 * assert on it (throwing fails the test) and call tools in answer.
 */
export type Step = { on: string; run?: (event: ChannelEvent) => void | Promise<void> }

/** A tool call's outcome: the parsed JSON payload, and whether it was a refusal. */
export type CallOutcome = { isError: boolean; payload: Record<string, unknown> }

const ChannelNotification = z.object({
  method: z.literal('notifications/claude/channel'),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()) })
})

type Options = {
  /** The folder Claude Code would run in: the bridge's cwd. */
  folder: string
  /** The user-level state directory holding the server's runtime file. */
  home: string
  bridge?: string
}

/**
 * A scripted stand-in for Claude Code acting as the DM. It spawns the real bridge in a folder,
 * does the MCP handshake, calls tools, and answers channel events with a strict, ordered script:
 * an unexpected event, a failed step or an unfinished script fails the test.
 */
export async function startFakeDm({ folder, home, bridge = BRIDGE_BUNDLE }: Options) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bridge],
    cwd: folder,
    env: { ...(process.env as Record<string, string>), DUNGEON_MASTER_HOME: home },
    stderr: 'pipe'
  })
  let stderr = ''
  transport.stderr?.on('data', (chunk) => (stderr += chunk))

  // The SDK keeps the negotiated revision to itself; read it off the initialize answer.
  let protocolVersion = ''
  const start = transport.start.bind(transport)
  transport.start = async () => {
    const receive = transport.onmessage
    transport.onmessage = (message) => {
      if (!protocolVersion && 'result' in message) {
        const answered = message.result.protocolVersion
        if (typeof answered === 'string') protocolVersion = answered
      }
      receive?.(message)
    }
    return start()
  }

  const client = new Client(
    { name: 'fake-dm', version: '0.0.0' },
    { capabilities: { experimental: { 'claude/channel': {} } } }
  )

  const steps: Step[] = []
  const failures: Error[] = []
  let running = Promise.resolve()
  let wake = () => {}

  function fail(error: Error) {
    failures.push(error)
    wake()
  }

  client.fallbackNotificationHandler = async (notification) => {
    const parsed = ChannelNotification.safeParse(notification)
    if (!parsed.success) return
    const event = parsed.data.params
    const step = steps.shift()
    if (!step) return fail(new Error(`Unexpected channel event: ${describe(event)}`))
    if (step.on !== event.meta.kind) {
      return fail(new Error(`Expected a ${step.on} event, got ${describe(event)}`))
    }
    running = running.then(async () => {
      try {
        await step.run?.(event)
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)))
      }
      wake()
    })
  }

  await client.connect(transport)

  function check() {
    if (failures.length > 0) {
      const detail = stderr ? `\nbridge stderr:\n${stderr}` : ''
      throw new Error(failures.map((f) => f.message).join('\n') + detail, { cause: failures[0] })
    }
  }

  const dm = {
    protocolVersion,
    capabilities: client.getServerCapabilities() as ServerCapabilities,

    async listTools(): Promise<Tool[]> {
      return (await client.listTools()).tools
    },

    async call(name: string, args: Record<string, unknown> = {}): Promise<CallOutcome> {
      const result = await client.callTool({ name, arguments: args })
      const [first] = result.content as { type: string; text: string }[]
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(first.text)
      } catch {
        payload = { text: first.text }
      }
      return { isError: result.isError === true, payload }
    },

    /** Appends steps; each must match the next channel event in order. */
    script(...more: Step[]) {
      steps.push(...more)
    },

    /** Resolves once every scripted step has run; rejects on the first failure or a timeout. */
    async settled(timeout = 5000) {
      const deadline = Date.now() + timeout
      for (;;) {
        await running
        check()
        if (steps.length === 0) return
        const left = deadline - Date.now()
        if (left <= 0) throw new Error(`Timed out waiting for ${describeSteps(steps)}`)
        await new Promise<void>((resolve) => {
          wake = resolve
          setTimeout(resolve, Math.min(left, 100))
        })
      }
    },

    /**
     * Ends the session; throws on any failure or an unfinished script. It first waits `drain` ms
     * so an unexpected event arriving late still fails the test.
     */
    async close(drain = 150) {
      await new Promise((r) => setTimeout(r, drain))
      await running
      await client.close()
      check()
      if (steps.length > 0) throw new Error(`Unfinished script: ${describeSteps(steps)}`)
    },

    /** Ends the session without checking the script (cleanup after a failure). */
    async kill() {
      steps.length = 0
      await client.close()
    }
  }
  return dm
}

export type FakeDm = Awaited<ReturnType<typeof startFakeDm>>

function describe(event: ChannelEvent): string {
  return `${event.meta.kind ?? '(no kind)'} event "${event.content}"`
}

function describeSteps(steps: Step[]): string {
  return `still expecting ${steps.map((s) => s.on).join(', ')} event(s)`
}
