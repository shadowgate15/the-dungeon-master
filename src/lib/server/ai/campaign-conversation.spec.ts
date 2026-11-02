import { beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { createWorldService, type WorldService } from '../world/service'
import {
  compactCampaignConversation,
  runCampaignTurn,
  type CampaignTurnInput
} from './campaign-conversation.ts'
import { campaignTurnRequestSchema } from './request.ts'
import type { ChatPort, ChatRequest } from './conversation-engine.ts'

const complete = (object: unknown) => [
  { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
  { type: 'CUSTOM', name: 'structured-output.complete', value: { object } },
  { type: 'RUN_FINISHED', threadId: 't', runId: 'r' }
]

/** Replays the n-th script for turn calls and for summary calls, independently. */
function fakePort(scripts: { turn?: object[][]; summary?: object[][] } = {}) {
  const requests: ChatRequest[] = []
  const counts = { turn: 0, summary: 0 }
  const isSummary = (r: ChatRequest) => 'summary' in (r.outputSchema as { shape: object }).shape
  const port: ChatPort = async function* (request) {
    requests.push(request)
    const kind = isSummary(request) ? 'summary' : 'turn'
    const list = scripts[kind] ?? [complete({ reply: 'ok', proposals: {} })]
    counts[kind]++
    for (const event of list[Math.min(counts[kind], list.length) - 1]) yield event
  }
  return {
    port,
    requests,
    turns: () => requests.filter((r) => !isSummary(r)),
    summaries: () => requests.filter(isSummary)
  }
}

let db: Database
let worlds: WorldService
beforeEach(() => {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  worlds = createWorldService(db)
})

const worldSeed = (name: string, premise: string) => ({
  name,
  premise,
  genreFlavor: null,
  scale: null,
  magicLevel: null,
  techLevel: null
})
const makeWorld = (name: string, premise = `${name} premise text`) =>
  worlds.create(worldSeed(name, premise))

const input = (over: Partial<CampaignTurnInput> = {}): CampaignTurnInput => ({
  seed: { name: '', premise: '', tone: '', length: '' },
  history: [],
  dismissed: [],
  message: 'Draft me a campaign',
  worldIds: [],
  ...over
})

const systemText = (r: ChatRequest) => r.systemPrompts.join('\n')

const tenMessages = Array.from({ length: 10 }, (_, i) => ({
  role: i % 2 ? ('assistant' as const) : ('user' as const),
  content: `m${i}`
}))

describe('runCampaignTurn', () => {
  it('returns proposals for name, premise, tone and length', async () => {
    const { port } = fakePort({
      turn: [
        complete({
          reply: 'Here.',
          proposals: { name: 'Crown', premise: 'Hook', tone: 'dark', length: 'short' }
        })
      ]
    })
    const result = await runCampaignTurn(port, db, input())
    expect(result).toEqual({
      ok: true,
      reply: 'Here.',
      proposals: { name: 'Crown', premise: 'Hook', tone: 'dark', length: 'short' }
    })
  })

  it('does not offer Worlds in the output schema', async () => {
    const { port, requests } = fakePort()
    await runCampaignTurn(port, db, input())
    const shape = (requests[0].outputSchema as unknown as { shape: Record<string, unknown> }).shape
    const proposals = (shape.proposals as { shape: object }).shape
    expect(Object.keys(proposals).sort()).toEqual(['length', 'name', 'premise', 'tone'])
  })

  it('retries once silently on an out-of-enum value, then fails with invalid-output', async () => {
    const bad = complete({ reply: 'x', proposals: { tone: 'grimdark' } })
    const { port, turns } = fakePort({ turn: [bad] })
    const result = await runCampaignTurn(port, db, input())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid-output' } })
    expect(turns()).toHaveLength(2)
  })

  it('recovers when the retry is valid', async () => {
    const bad = complete({ reply: 'x', proposals: { length: 'epic' } })
    const good = complete({ reply: 'y', proposals: { length: 'long' } })
    const { port, turns } = fakePort({ turn: [bad, good] })
    const result = await runCampaignTurn(port, db, input())
    expect(result).toEqual({ ok: true, reply: 'y', proposals: { length: 'long' } })
    expect(turns()).toHaveLength(2)
  })

  it('puts the selected Worlds Seeds in the system prompt, not the transcript', async () => {
    const a = makeWorld('Aldoria', 'A realm of glass towers')
    const b = makeWorld('Brine', 'A drowned archipelago')
    const { port, turns } = fakePort()
    await runCampaignTurn(port, db, input({ worldIds: [a.id, b.id] }))
    const request = turns()[0]
    expect(systemText(request)).toContain('Worlds this Campaign is set in')
    expect(systemText(request)).toContain('A realm of glass towers')
    expect(systemText(request)).toContain('A drowned archipelago')
    expect(request.messages.map((m) => m.content).join('\n')).not.toContain('glass towers')
  })

  it('reloads the Worlds from the database every turn', async () => {
    const a = makeWorld('Aldoria', 'First premise')
    const { port, turns } = fakePort()
    await runCampaignTurn(port, db, input({ worldIds: [a.id] }))
    worlds.update(a.id, worldSeed('Aldoria', 'Second premise'))
    await runCampaignTurn(port, db, input({ worldIds: [a.id] }))
    expect(systemText(turns()[1])).toContain('Second premise')
    expect(systemText(turns()[1])).not.toContain('First premise')
  })

  it('fails with worlds-changed and no model call when a World is archived', async () => {
    const a = makeWorld('Aldoria')
    const b = makeWorld('Brine')
    worlds.archive(b.id)
    const { port, requests } = fakePort()
    const result = await runCampaignTurn(port, db, input({ worldIds: [a.id, b.id] }))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'worlds-changed' } })
    expect(requests).toHaveLength(0)
  })

  it('fails with worlds-changed and no model call when a World is missing', async () => {
    const { port, requests } = fakePort()
    const result = await runCampaignTurn(port, db, input({ worldIds: ['nope'] }))
    expect(result).toMatchObject({ ok: false, failure: { kind: 'worlds-changed' } })
    expect(requests).toHaveLength(0)
  })

  it('counts the Worlds toward the compaction threshold', async () => {
    const big = makeWorld('Big', 'x'.repeat(1500))
    const limit = 1000
    const without = fakePort({ summary: [complete({ summary: 'S' })] })
    await runCampaignTurn(without.port, db, input({ history: tenMessages, context: { limit } }))
    expect(without.summaries()).toHaveLength(0)

    const withWorld = fakePort({ summary: [complete({ summary: 'S' })] })
    const result = await runCampaignTurn(
      withWorld.port,
      db,
      input({ history: tenMessages, worldIds: [big.id], context: { limit } })
    )
    expect(withWorld.summaries()).toHaveLength(1)
    expect(result).toMatchObject({ ok: true, compaction: { summary: 'S', summarizedCount: 4 } })
  })

  it('keeps the Worlds out of the summary and still in context after compaction', async () => {
    const big = makeWorld('Big', 'UNIQUE-WORLD-TEXT ' + 'x'.repeat(1500))
    const { port, summaries, turns } = fakePort({ summary: [complete({ summary: 'S' })] })
    await runCampaignTurn(
      port,
      db,
      input({ history: tenMessages, worldIds: [big.id], context: { limit: 1000 } })
    )
    const s = summaries()[0]
    expect(s.systemPrompts.join('\n')).toContain('Campaign creation conversation')
    expect(JSON.stringify(s)).not.toContain('UNIQUE-WORLD-TEXT')
    expect(systemText(turns()[0])).toContain('UNIQUE-WORLD-TEXT')
  })
})

describe('compactCampaignConversation', () => {
  it('summarizes older messages, keeping the last 6, with the Campaign summary prompt', async () => {
    const { port, summaries } = fakePort({ summary: [complete({ summary: 'Short' })] })
    const result = await compactCampaignConversation(port, input({ history: tenMessages }))
    expect(result).toEqual({ ok: true, summary: 'Short', summarizedCount: 4 })
    expect(summaries()[0].systemPrompts.join('\n')).toContain('Campaign creation conversation')
  })
})

describe('campaign request schema', () => {
  const body = {
    seed: { name: '', premise: '', tone: '', length: '' },
    history: [],
    dismissed: [],
    message: 'hi',
    worldIds: ['a']
  }
  it('accepts a campaign turn and rejects World seed fields', () => {
    expect(campaignTurnRequestSchema.safeParse(body).success).toBe(true)
    expect(
      campaignTurnRequestSchema.safeParse({ ...body, dismissed: [{ field: 'scale', value: 'x' }] })
        .success
    ).toBe(false)
  })
})
