import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tempDir } from '../testing/temp-dir'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

// Each test spawns real bridge processes; give them room when the whole suite is running.
vi.setConfig({ testTimeout: 20_000 })

let tmp: string
let home: string
let server: TestGameServer
let folder: string
const servers: TestGameServer[] = []
const dms: FakeDm[] = []

beforeEach(async () => {
  tmp = tempDir('session')
  home = path.join(tmp, 'home')
  server = await startServer()
  folder = path.join(tmp, 'ember-road')
  server.library.create({ name: 'Ember Road', folder })
})

afterEach(async () => {
  for (const dm of dms.splice(0)) await dm.kill()
  for (const s of servers.splice(0)) await s.stop()
})

async function startServer() {
  const started = await startTestGameServer({ home })
  servers.push(started)
  return started
}

async function dmIn(cwd: string) {
  const dm = await startFakeDm({ folder: cwd, home })
  dms.push(dm)
  return dm
}

/** What the launcher sees: registers the folder and reads whether a session is attached. */
async function register(on: TestGameServer, campaign: string) {
  const res = await fetch(`${on.url}/api/bridge/register`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ folder: campaign })
  })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

/** Polls `check` until it passes, so a test can wait on a bridge connecting or hanging up. */
async function eventually(check: () => Promise<void>, timeout = 5000) {
  const deadline = Date.now() + timeout
  for (;;) {
    try {
      return await check()
    } catch (e) {
      if (Date.now() > deadline) throw e
      await new Promise((r) => setTimeout(r, 50))
    }
  }
}

describe('session attached', () => {
  it('is reported by register while a DM is attached, and not after it leaves', async () => {
    expect(await register(server, folder)).toEqual({
      status: 200,
      body: { id: expect.any(String), name: 'Ember Road', attached: false }
    })

    const dm = await dmIn(folder)
    await eventually(async () =>
      expect((await register(server, folder)).body).toMatchObject({ attached: true })
    )

    await dm.close()
    await eventually(async () =>
      expect((await register(server, folder)).body).toMatchObject({ attached: false })
    )
  })
})

describe('one live session per Campaign', () => {
  it('refuses a second bridge for the same Campaign, and says why', async () => {
    const first = await dmIn(folder)
    await server.whenListening(folder)

    const second = await dmIn(folder)
    await eventually(async () =>
      expect(await second.call('seed')).toEqual({
        isError: true,
        payload: {
          code: 'session_live',
          message: expect.stringMatching(/already has a live session/),
          next: expect.any(String)
        }
      })
    )

    // The first session keeps the table.
    expect(await first.call('seed')).toMatchObject({ isError: false })
    expect((await register(server, folder)).body).toMatchObject({ attached: true })
    await second.close()
    await first.close()
  })

  it('keeps a refused bridge refused after the first session leaves', async () => {
    const first = await dmIn(folder)
    await server.whenListening(folder)
    const second = await dmIn(folder)
    await eventually(async () =>
      expect(await second.call('seed')).toMatchObject({ payload: { code: 'session_live' } })
    )

    await first.close()
    await eventually(async () =>
      expect((await register(server, folder)).body).toMatchObject({ attached: false })
    )
    // Outlasts the bridge's 1s reconnect delay, so a refused bridge that kept retrying would show.
    await new Promise((r) => setTimeout(r, 1500))
    expect((await register(server, folder)).body).toMatchObject({ attached: false })
    expect(await second.call('seed')).toMatchObject({ payload: { code: 'session_live' } })
    await second.close()
  })

  it('lets different Campaigns be live at once', async () => {
    const other = path.join(tmp, 'salt-marsh')
    server.library.create({ name: 'Salt Marsh', folder: other })

    const a = await dmIn(folder)
    const b = await dmIn(other)
    await eventually(async () => {
      expect((await register(server, folder)).body).toMatchObject({ attached: true })
      expect((await register(server, other)).body).toMatchObject({ attached: true })
    })
    expect(await b.call('seed')).toMatchObject({ isError: false })
    await a.close()
    await b.close()
  })
})

describe('a server restart', () => {
  it('leaves the bridge reconnected to its Campaign, with the session attached again', async () => {
    const dm = await dmIn(folder)
    await server.whenListening(folder)

    await server.stop()
    const restarted = await startServer()
    await restarted.whenListening(folder)

    expect((await register(restarted, folder)).body).toMatchObject({ attached: true })
    // Each connect tells Claude Code to fetch the (possibly new) server's tool list.
    await eventually(async () => expect(dm.toolListChanges).toBeGreaterThanOrEqual(2))
    expect(await dm.call('seed')).toMatchObject({
      isError: false,
      payload: expect.objectContaining({ name: 'Ember Road' })
    })
    await dm.close()
  })
})

describe('a server restart with a refused bridge', () => {
  it('gives the table back to the first session, never the refused one', async () => {
    const first = await dmIn(folder)
    await server.whenListening(folder)
    const second = await dmIn(folder)
    await eventually(async () =>
      expect(await second.call('seed')).toMatchObject({ payload: { code: 'session_live' } })
    )

    await server.stop()
    const restarted = await startServer()
    await restarted.whenListening(folder)
    // Outlasts the bridge's 1s reconnect delay, so a refused bridge that kept retrying would show.
    await new Promise((r) => setTimeout(r, 1500))

    expect(await first.call('seed')).toMatchObject({ isError: false })
    expect(await second.call('seed')).toMatchObject({ payload: { code: 'session_live' } })
    await second.close()
    await first.close()
  })
})

describe('the browser stream', () => {
  /** Opens the browser's SSE stream and collects its messages. */
  async function browserStream(on: TestGameServer) {
    const res = await fetch(`${on.url}/api/events`)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    const messages: unknown[] = []
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
    void (async () => {
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: '', done: true }))
        if (done) return
        buffer += value
        let end: number
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const data = /^data: (.*)$/m.exec(buffer.slice(0, end))?.[1]
          buffer = buffer.slice(end + 2)
          if (data) messages.push(JSON.parse(data))
        }
      }
    })()
    return { messages, close: () => reader.cancel() }
  }

  it('pushes the session attached state as a DM attaches and leaves', async () => {
    const { id } = (await register(server, folder)).body
    const stream = await browserStream(server)

    const dm = await dmIn(folder)
    await eventually(async () =>
      expect(stream.messages).toEqual([{ type: 'session', campaign: id, attached: true }])
    )
    await dm.close()
    await eventually(async () =>
      expect(stream.messages).toEqual([
        { type: 'session', campaign: id, attached: true },
        { type: 'session', campaign: id, attached: false }
      ])
    )
    await stream.close()
  })
})
