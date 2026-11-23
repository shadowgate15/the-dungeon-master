import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

// Each test spawns a real bridge process; give it room when the whole suite is running.
vi.setConfig({ testTimeout: 20_000 })

let tmp: string
let home: string
let server: TestGameServer
let folder: string
const dms: FakeDm[] = []

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-bridge-'))
  home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  server.library.create({ name: 'Ember Road', folder })
})

afterEach(async () => {
  for (const dm of dms.splice(0)) await dm.kill()
  await server.stop()
})

async function dmIn(cwd: string) {
  const dm = await startFakeDm({ folder: cwd, home })
  dms.push(dm)
  return dm
}

describe('the bridge', () => {
  it('answers the older protocol revision and declares the channel capabilities', async () => {
    const dm = await dmIn(folder)
    expect(dm.protocolVersion).toBe('2025-06-18')
    expect(dm.capabilities.experimental).toEqual({
      'claude/channel': {},
      'claude/channel/permission': {}
    })
    await dm.close()
  })

  it('lists the tools fetched from the server and proxies a call', async () => {
    const dm = await dmIn(folder)
    const names = (await dm.listTools()).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['seed', 'set_seed']))

    expect(await dm.call('seed')).toEqual({
      isError: false,
      payload: expect.objectContaining({ handle: 'campaign', version: 1, name: 'Ember Road' })
    })
    await dm.close()
  })

  it('passes refusals through as {code, message, next}', async () => {
    const dm = await dmIn(folder)
    expect(await dm.call('set_seed', { version: 7, tone: 'tense' })).toEqual({
      isError: true,
      payload: { code: 'stale_version', message: expect.any(String), next: 'seed' }
    })
    await dm.close()
  })

  it('relays channel events from the server into the session', async () => {
    const dm = await dmIn(folder)
    const seen: string[] = []
    dm.script({
      on: 'begin',
      run: async (event) => {
        seen.push(event.content)
        const { payload } = await dm.call('seed')
        expect(payload).toMatchObject({ name: 'Ember Road' })
      }
    })
    await server.whenListening(folder)
    server.channels.send(folder, { content: 'The Player pressed Begin', meta: { kind: 'begin' } })
    await dm.settled()
    expect(seen).toEqual(['The Player pressed Begin'])
    await dm.close()
  })

  it('says the game server is not running when it is down', async () => {
    const dm = await dmIn(folder)
    await server.stop()
    expect(await dm.call('seed')).toEqual({
      isError: true,
      payload: {
        code: 'server_not_running',
        message: 'game server not running',
        next: expect.stringContaining('dm')
      }
    })
    await dm.close()
  })

  it('stays inert outside a Campaign folder', async () => {
    const elsewhere = path.join(tmp, 'my-code')
    fs.mkdirSync(elsewhere)
    const dm = await dmIn(elsewhere)
    expect(await dm.listTools()).toEqual([])
    expect(dm.capabilities.experimental).toBeUndefined()
    expect(server.requests()).toEqual([])
    await dm.close()
  })
})

describe('the bridge API', () => {
  it('refuses a request without the token', async () => {
    const res = await fetch(`${server.url}/api/bridge/tools`)
    expect(res.status).toBe(401)
  })
})

describe('the fake DM', () => {
  it('fails on an unexpected channel event', async () => {
    const dm = await dmIn(folder)
    await server.whenListening(folder)
    server.channels.send(folder, { content: 'Hello?', meta: { kind: 'conversation' } })
    await expect(dm.close()).rejects.toThrow(/unexpected channel event.*conversation/i)
  })

  it('fails on an event that does not match the next step', async () => {
    const dm = await dmIn(folder)
    dm.script({ on: 'floor' })
    await server.whenListening(folder)
    server.channels.send(folder, { content: 'Begin', meta: { kind: 'begin' } })
    await expect(dm.settled()).rejects.toThrow(/expected a floor event.*begin/i)
    await dm.kill()
  })

  it('fails on an unfinished script', async () => {
    const dm = await dmIn(folder)
    dm.script({ on: 'floor' })
    await expect(dm.close()).rejects.toThrow(/unfinished script.*floor/i)
  })

  it('fails when a step’s own assertion fails', async () => {
    const dm = await dmIn(folder)
    dm.script({
      on: 'begin',
      run: (event) => {
        if (event.content !== 'Begin now') throw new Error(`wrong content: ${event.content}`)
      }
    })
    await server.whenListening(folder)
    server.channels.send(folder, { content: 'Begin later', meta: { kind: 'begin' } })
    await expect(dm.settled()).rejects.toThrow(/wrong content: Begin later/)
    await dm.kill()
  })
})
