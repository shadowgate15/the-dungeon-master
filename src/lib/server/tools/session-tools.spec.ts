import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChannels } from '../bridge/channels'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createPlay, type Play } from '../play/play'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string
let clock: number
let wren: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-sessions-'))
  clock = Date.UTC(2026, 10, 20, 19, 0)
  const now = () => clock
  library = createCampaignLibrary({ home: path.join(tmp, 'home'), now })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools, now })
  play = createPlay({ library, channels: createChannels(), publish: () => {} })
  wren = addCharacter(library, campaignId, fighterDraft('Wren'))
})

afterEach(() => library.close())

function payload(result: ToolResult) {
  return JSON.parse(result.content[0].text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return payload(result)
}

function refused(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError, result.content[0]?.text).toBe(true)
  return payload(result)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const summary = 'Wren picked the lock of the harbour office and found the ledger.'

describe('close_session', () => {
  it('writes the summary and threads and closes the Session', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'The lock clicks open.' })

    ok('close_session', { summary, threads: ['Who signed the ledger?'] })

    expect(ok('sessions')).toMatchObject({
      sessions: [{ number: 1, closed: true, summary, threads: ['Who signed the ledger?'] }]
    })
    ok('narrate', { text: 'After the close.' })
    expect(host.events(folder).at(-1)?.session).toBeNull()
  })
})

describe('close_session atomicity', () => {
  it('a refused close logs nothing and leaves the Session open', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'The lock clicks open.' })
    const before = host.events(folder).length

    refused('close_session', { summary: 'word '.repeat(400), threads: [] })

    expect(host.events(folder)).toHaveLength(before)
    expect(ok('sessions').current).toBe(1)
  })

  it('logs one Event in the same call that closes the Session', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'The lock clicks open.' })

    ok('close_session', { summary, threads: [] })

    expect(host.events(folder).at(-1)).toMatchObject({ tool: 'close_session' })
    expect(refused('close_session', { summary, threads: [] }).code).toBe('no_open_session')
  })

  it('refuses to rewrite a closed summary', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'The lock clicks open.' })
    ok('close_session', { summary, threads: [] })

    expect(refused('close_session', { summary: 'Rewritten.', threads: [], session: 1 }).code).toBe(
      'session_closed'
    )
  })
})

describe('catch-up close', () => {
  it('a new sitting leaves an unclosed Session for the catch-up, then closes it by number', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'The lock clicks open.' })
    clock += 3_600_000
    play.openSession(campaignId, 'bridge-2')

    expect(ok('sessions')).toMatchObject({ current: 2, unclosed: [1], recap_due: false })
    expect(ok('history', { session: 1 }).events.map((e: { kind: string }) => e.kind)).toEqual([
      'narration'
    ])

    ok('close_session', { summary, threads: ['The ledger'], session: 1 })

    expect(ok('sessions')).toMatchObject({
      current: 2,
      unclosed: [],
      recap_due: true,
      sessions: [{ number: 1, closed: true, summary }]
    })
  })

  it('a reconnect of the same bridge keeps its Session, even after End Session closed it', () => {
    const first = play.openSession(campaignId, 'bridge-1')
    expect(play.openSession(campaignId, 'bridge-1')).toEqual(first)
    ok('narrate', { text: 'The lock clicks open.' })
    ok('close_session', { summary, threads: [] })

    expect(play.openSession(campaignId, 'bridge-1')).toEqual(first)
    expect(ok('sessions').current).toBeNull()
  })
})

describe('Sessions with no Narration', () => {
  it('close with no summary and are left out of the lists', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('seed')

    expect(ok('close_session', { summary, threads: ['x'] })).toMatchObject({
      session: 1,
      summarised: false
    })
    expect(ok('sessions').sessions).toEqual([])
    expect(library.record(campaignId).sessionHistory().sessions).toEqual([])
  })

  it('close on their own when the next sitting opens', () => {
    play.openSession(campaignId, 'bridge-1')
    play.openSession(campaignId, 'bridge-2')

    expect(ok('sessions')).toMatchObject({ current: 2, unclosed: [], sessions: [] })
  })
})

describe('recap', () => {
  it('leaves awaiting Narration set and is not taken for an answer', () => {
    play.openSession(campaignId, 'bridge-1')
    library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
    play.done(campaignId)

    ok('narrate', { text: 'Previously, the harbour office…', recap: true })

    expect(library.record(campaignId).timeline().awaitingSince).not.toBeNull()
    ok('narrate', { text: 'The lock clicks open.' })
    expect(library.record(campaignId).timeline().awaitingSince).toBeNull()
  })

  it('shows as a recap Narration in the timeline and leaves the in-fiction minute alone', () => {
    play.openSession(campaignId, 'bridge-1')
    const before = host.events(folder).at(-1)?.minute ?? 0

    ok('narrate', { text: 'Previously, the harbour office…', recap: true })

    expect(library.record(campaignId).timeline().entries).toEqual([
      expect.objectContaining({ type: 'narration', recap: true })
    ])
    expect(host.events(folder).at(-1)?.minute).toBe(before)
  })

  it('is left out of history and of whether the Session had Narration', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'Previously, the harbour office…', recap: true })

    expect(ok('history', { query: 'harbour' }).events).toEqual([])
    expect(ok('close_session', { summary, threads: [] }).summarised).toBe(false)
  })

  it('is due once per sitting after one with a summary', () => {
    play.openSession(campaignId, 'bridge-1')
    expect(ok('sessions').recap_due).toBe(false)
    ok('narrate', { text: 'The lock clicks open.' })
    ok('close_session', { summary, threads: [] })
    play.openSession(campaignId, 'bridge-2')

    expect(ok('sessions').recap_due).toBe(true)
    ok('narrate', { text: 'Previously…', recap: true })
    expect(ok('sessions').recap_due).toBe(false)
  })
})

describe('history', () => {
  it('lists Events newest first, filtered by query, about and since', () => {
    play.openSession(campaignId, 'bridge-1')
    ok('narrate', { text: 'Rain hammers the harbour.' })
    ok('establish', { type: 'npc', name: 'Mira Voss', page: 'A fence.' })
    ok('narrate', { text: 'Mira waves from the docks.', voice: 'npc:mira-voss' })
    ok('narrate', { text: 'The tide turns.' })

    const all = ok('history', { session: 1 }).events
    expect(all.map((e: { kind: string }) => e.kind)).toEqual([
      'narration',
      'narration',
      'entity_established',
      'narration'
    ])
    expect(all[0].id).toBeGreaterThan(all[1].id)

    expect(
      ok('history', { query: 'harbours' }).events.map((e: { summary: string }) => e.summary)
    ).toEqual(['Rain hammers the harbour.'])
    expect(ok('history', { about: 'npc:mira-voss' }).events).toHaveLength(2)
    expect(ok('history', { since: all[1].id }).events).toHaveLength(1)
    expect(ok('history', { limit: 2 }).events).toHaveLength(2)
  })
})
