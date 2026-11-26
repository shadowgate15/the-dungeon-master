import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { tempDir } from '../testing/temp-dir'
import type { LiveMessage } from '../lib/live/messages'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

// Each test spawns a real bridge process; give it room when the whole suite is running.
vi.setConfig({ testTimeout: 20_000 })

let server: TestGameServer
let home: string
let folder: string
let campaignId: string
let dm: FakeDm | undefined
let stopLive = () => {}

beforeEach(async () => {
  const tmp = tempDir('permission')
  home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  campaignId = server.library.create({ name: 'Ember Road', folder }).id
})

afterEach(async () => {
  stopLive()
  await dm?.kill()
  await server.stop()
})

/** Follows the browser's live updates stream, collecting its messages. */
async function followLive(): Promise<LiveMessage[]> {
  const messages: LiveMessage[] = []
  const controller = new AbortController()
  stopLive = () => controller.abort()
  const res = await fetch(`${server.url}/api/events`, { signal: controller.signal })
  void (async () => {
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for await (const chunk of res.body!) {
        buffer += decoder.decode(chunk, { stream: true })
        for (const [, data] of buffer.matchAll(/^data: (.*)$/gm)) messages.push(JSON.parse(data))
        buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2)
      }
    } catch {
      // aborted
    }
  })()
  return messages
}

async function eventually(check: () => void, timeout = 5000) {
  const deadline = Date.now() + timeout
  for (;;) {
    try {
      return check()
    } catch (e) {
      if (Date.now() > deadline) throw e
      await new Promise((r) => setTimeout(r, 25))
    }
  }
}

const request = {
  request_id: 'abcde',
  tool_name: 'Bash',
  description: 'List the Campaign folder',
  input_preview: 'ls -la'
}

it('relays a permission request to the browser and the Player’s verdict back to the session', async () => {
  const live = await followLive()
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  await dm.requestPermission(request)
  await eventually(() =>
    expect(server.permissions.pending(campaignId)).toEqual({
      requestId: 'abcde',
      toolName: 'Bash',
      description: 'List the Campaign folder',
      inputPreview: 'ls -la'
    })
  )
  await eventually(() => expect(live).toContainEqual({ type: 'permission', campaign: campaignId }))

  const verdict = dm.permissionVerdict('abcde')
  expect(server.permissions.answer(campaignId, 'abcde', 'allow')).toBe(true)
  expect(await verdict).toBe('allow')
  expect(server.permissions.pending(campaignId)).toBeNull()
  await dm.close()
})

it('relays a deny, and refuses a second answer to the same request', async () => {
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  await dm.requestPermission(request)
  await eventually(() => expect(server.permissions.pending(campaignId)).not.toBeNull())
  const verdict = dm.permissionVerdict('abcde')
  expect(server.permissions.answer(campaignId, 'abcde', 'deny')).toBe(true)
  expect(await verdict).toBe('deny')
  expect(server.permissions.answer(campaignId, 'abcde', 'allow')).toBe(false)
  await dm.close()
})

it('clears the card once the session moves on: the terminal answered first', async () => {
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  await dm.requestPermission(request)
  await eventually(() => expect(server.permissions.pending(campaignId)).not.toBeNull())
  await dm.call('seed')
  expect(server.permissions.pending(campaignId)).toBeNull()
  expect(server.permissions.answer(campaignId, 'abcde', 'allow')).toBe(false)
  await dm.close()
})

it('clears the card when the session leaves', async () => {
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  await dm.requestPermission(request)
  await eventually(() => expect(server.permissions.pending(campaignId)).not.toBeNull())
  await dm.close()
  dm = undefined
  await eventually(() => expect(server.permissions.pending(campaignId)).toBeNull())
})

it('shows only the newest request: a new one replaces the one before', async () => {
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  await dm.requestPermission(request)
  await dm.requestPermission({ ...request, request_id: 'fghij', tool_name: 'Write' })
  await eventually(() =>
    expect(server.permissions.pending(campaignId)).toMatchObject({ requestId: 'fghij' })
  )
  expect(server.permissions.answer(campaignId, 'abcde', 'allow')).toBe(false)
  await dm.close()
})
