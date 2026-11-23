import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { campaign } from '../db/schema'
import { ToolError, readTool, writeTool, type ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { seedTools } from './seed-tools'

let library: CampaignLibrary
let host: ToolHost
let folder: string

/** Test-only tools, for contract behaviour no real tool exercises yet. */
const fixtureTools = [
  readTool({
    name: 'peek',
    description: 'Opens a handle.',
    input: z.object({ handle: z.string() }),
    run: (_ctx, { handle }) => {
      throw ToolError.unknownHandle(handle)
    }
  }),
  writeTool({
    name: 'enter_combat',
    description: 'Enters a situation.',
    input: z.object({}),
    run: () => ({
      result: { round: 1 },
      skill: 'combat',
      event: { kind: 'combat_started', summary: 'Combat starts' }
    })
  }),
  writeTool({
    name: 'half_write',
    description: 'Writes, logs, then fails.',
    input: z.object({ name: z.string() }),
    run: (ctx, { name }) => {
      ctx.db.update(campaign).set({ name }).run()
      throw new ToolError('broken', 'It broke halfway', 'Try again')
    }
  })
]

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-tools-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  library.create({ name: 'Ember Road', folder })
  host = createToolHost({ library, tools: [...seedTools, ...fixtureTools] })
})

afterEach(() => library.close())

/** The parsed JSON payload of a tool result. */
function payload(result: ToolResult) {
  expect(result.content).toHaveLength(1)
  return JSON.parse(result.content[0].text)
}

function ok(result: ToolResult) {
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return payload(result)
}

function refused(result: ToolResult) {
  expect(result.isError).toBe(true)
  return payload(result)
}

describe('game tool host', () => {
  it('lists every tool with a snake_case name, a description and a JSON input schema', () => {
    const seed = host.list().find((t) => t.name === 'set_seed')
    expect(seed).toMatchObject({
      name: 'set_seed',
      description: expect.any(String),
      inputSchema: { type: 'object', properties: { version: { type: 'integer' } } }
    })
    for (const tool of host.list()) expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('reads return the version every write must pass', () => {
    const seed = ok(host.call(folder, 'seed', {}))
    expect(seed).toMatchObject({ handle: 'campaign', version: 1, name: 'Ember Road' })

    const saved = ok(host.call(folder, 'set_seed', { version: 1, premise: 'Escort a relic.' }))
    expect(saved).toMatchObject({ version: 2, premise: 'Escort a relic.' })
    expect(ok(host.call(folder, 'seed', {}))).toMatchObject({
      version: 2,
      premise: 'Escort a relic.'
    })
  })

  it('refuses a stale write, naming the read to do', () => {
    ok(host.call(folder, 'set_seed', { version: 1, tone: 'tense' }))

    expect(refused(host.call(folder, 'set_seed', { version: 1, tone: 'grim' }))).toEqual({
      code: 'stale_version',
      message: expect.stringContaining('campaign'),
      next: 'seed'
    })
    expect(ok(host.call(folder, 'seed', {}))).toMatchObject({ version: 2, tone: 'tense' })
  })

  it('refuses an unknown handle', () => {
    expect(refused(host.call(folder, 'peek', { handle: 'npc:nobody' }))).toEqual({
      code: 'unknown_handle',
      message: expect.stringContaining('npc:nobody'),
      next: expect.any(String)
    })
  })

  it('refuses input that fails validation, without changing anything', () => {
    const missing = refused(host.call(folder, 'set_seed', { tone: 'tense' }))
    expect(missing).toEqual({
      code: 'invalid_input',
      message: expect.stringContaining('version'),
      next: expect.stringContaining('set_seed')
    })

    const badValue = refused(host.call(folder, 'set_seed', { version: 1, tone: 'whimsical' }))
    expect(badValue).toMatchObject({
      code: 'invalid_input',
      message: expect.stringContaining('whimsical')
    })

    expect(ok(host.call(folder, 'seed', {}))).toMatchObject({ version: 1, tone: null })
    expect(host.events(folder)).toEqual([])
  })

  it('refuses an unknown tool', () => {
    expect(refused(host.call(folder, 'fireball', {}))).toMatchObject({ code: 'unknown_tool' })
  })

  it('refuses a folder that is not a registered Campaign', () => {
    expect(refused(host.call(path.join(folder, 'elsewhere'), 'seed', {}))).toMatchObject({
      code: 'not_a_campaign'
    })
  })

  it('logs exactly one event per mutating call, stamped by code', () => {
    ok(host.call(folder, 'seed', {}))
    expect(host.events(folder)).toEqual([])

    ok(host.call(folder, 'set_seed', { version: 1, premise: 'Escort a relic.', tone: 'tense' }))
    ok(host.call(folder, 'set_seed', { version: 2, length: 'short' }))

    expect(host.events(folder)).toEqual([
      expect.objectContaining({ tool: 'set_seed', kind: 'seed_changed', session: null, minute: 0 }),
      expect.objectContaining({ tool: 'set_seed', kind: 'seed_changed', session: null, minute: 0 })
    ])
  })

  it('rolls back the whole call when a write fails partway', () => {
    expect(refused(host.call(folder, 'half_write', { name: 'Ash Road' }))).toEqual({
      code: 'broken',
      message: 'It broke halfway',
      next: 'Try again'
    })
    expect(ok(host.call(folder, 'seed', {}))).toMatchObject({ name: 'Ember Road', version: 1 })
    expect(host.events(folder)).toEqual([])
  })

  it('points to the plugin skill a tool enters', () => {
    expect(ok(host.call(folder, 'enter_combat', {}))).toEqual({
      round: 1,
      skill: 'the-dungeon-master:combat',
      next: 'Load skill the-dungeon-master:combat before continuing.'
    })
  })
})
