import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatPort, ChatRequest, TextEvent } from '../ai/port.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createMemoryRepository, type MemoryRepository } from '../memory/repository'
import {
  EXTRACTION_MARKER,
  MAX_FACT_CREATES,
  MAX_NPC_ITEMS,
  MEMORY_MAX_FAILURES
} from '../memory/extraction'
import { createSessionService, type SessionService } from './service'
import { createTurnRunner, type BeginResult, type TurnRunner } from './turn-runner.ts'

/** Post-turn extraction through the turn-runner, with in-memory SQLite and a scripted port. */

const HERO = {
  name: 'Brenna',
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: [
    { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
    { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
    { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
    { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' },
    { choiceKey: 'background/acolyte/equipment-0', item: 'amulet' }
  ]
} as Parameters<ReturnType<typeof createCharacterService>['create']>[0]

type Script = (request: ChatRequest) => AsyncGenerator<unknown>
let scripts: Script[]
let requests: ChatRequest[]
let sessions: SessionService
let runner: TurnRunner
let memory: MemoryRepository
let sessionId: string
let campaignId: string
let characterId: string
let logs: { kind: string; reason: string; seq: number }[]

const delta = (text: string) => ({ type: 'TEXT_MESSAGE_CONTENT', delta: text })
const finished = { type: 'RUN_FINISHED' }
const says = (...parts: string[]): Script =>
  async function* () {
    for (const p of parts) yield delta(p)
    yield finished
  }
const fails: Script = async function* () {
  yield delta('Half a sent')
  yield { type: 'RUN_ERROR', message: 'model fell over' }
}
/** A scripted extraction answer: the structured object the model returns. */
const extracts = (object: unknown): Script =>
  async function* () {
    yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object } }
    yield finished
  }
const errors: Script = async function* () {
  yield { type: 'RUN_ERROR', message: 'down' }
}

const port: ChatPort = (request) => {
  requests.push(request)
  const script = scripts.shift()
  if (!script) throw new Error('no script left')
  return script(request)
}

async function drain(result: BeginResult) {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  const events: TextEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}
const controller = () => new AbortController()
const prompt = (call: ChatRequest) => call.messages.map((m) => m.content).join('\n')

/** One DM turn (with the player's action, or the DM opening), then its extraction. */
async function play(action: string | undefined, reply: Script, extraction?: Script) {
  scripts.push(reply)
  if (extraction) scripts.push(extraction)
  const events = await drain(runner.begin(sessionId, action ? { action } : {}, controller().signal))
  await runner.memoryIdle()
  return events
}

const GROM = { name: 'Grom', description: 'A scarred gate warden.', role: 'warden' }
const grom = (extra: object = {}) => ({ ...GROM, status: 'alive', ...extra })

beforeEach(() => {
  scripts = []
  requests = []
  logs = []
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const w = createWorldService(db).create({ name: 'Eldoria' })
  campaignId = createCampaignService(db).create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  const hero = createCharacterService(db).create(HERO)
  characterId = hero.id
  const linking = createSessionService(db)
  linking.linkCharacter(campaignId, hero.id)
  sessionId = linking.start(campaignId).id
  sessions = createSessionService(db)
  memory = createMemoryRepository(db)
  runner = createTurnRunner({
    sessions,
    port,
    contextLimit: 4096,
    replyReserve: 512,
    rollD20: () => 10,
    rollModifier: () => 0,
    loadContext: () => ({
      campaign: { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
      worlds: [],
      sheet: 'Brenna, a fighter.'
    }),
    memory,
    log: (entry) => logs.push(entry)
  })
})

describe('post-turn memory extraction', () => {
  it('saves a new NPC with disposition and knowledge, plus a new fact', async () => {
    await play(
      undefined,
      says('Grom the warden eyes you.'),
      extracts({
        npcs: [
          grom({ stance: 'wary', note: 'Distrusts strangers', knows: ['The gate is cursed'] })
        ],
        facts: [
          { title: 'The gate is cursed', detail: 'It bleeds at night.', worldChanging: false }
        ]
      })
    )

    const [found] = memory.npcs(campaignId)
    expect(found).toMatchObject({
      name: 'Grom',
      role: 'warden',
      status: 'alive',
      campaignId,
      createdSessionId: sessionId,
      createdSeq: 1,
      changedSeq: 1
    })
    expect(memory.dispositions(found.id)).toMatchObject([
      { characterId, stance: 'wary', note: 'Distrusts strangers' }
    ])
    expect(memory.knownFacts(found.id).map((f) => f.title)).toEqual(['The gate is cursed'])
    expect(memory.facts(campaignId)).toHaveLength(1)
  })

  it('is a separate stateless call, sent the unextracted Turns and existing records with ids', async () => {
    await play(
      undefined,
      says('Grom the warden eyes you.'),
      extracts({ npcs: [grom()], facts: [] })
    )
    const call = requests[1]
    expect(call.threadId).not.toBe(sessionId)
    expect(call.tools).toBeUndefined()
    expect(call.outputSchema).toBeDefined()
    expect(prompt(call)).toContain('Grom the warden eyes you.')

    await play('I greet him.', says('He grunts.'), extracts({ npcs: [], facts: [] }))
    const second = prompt(requests.at(-1)!)
    expect(second).toContain(memory.npcs(campaignId)[0].id)
    expect(second).toContain('I greet him.')
    expect(second).not.toContain('Grom the warden eyes you.')
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(3)
  })

  it('updates an NPC by id and moves its disposition', async () => {
    await play(undefined, says('Grom.'), extracts({ npcs: [grom({ stance: 'wary' })], facts: [] }))
    const id = memory.npcs(campaignId)[0].id

    await play(
      'I give him ale.',
      says('He smiles.'),
      extracts({ npcs: [{ id, stance: 'friendly', description: 'A warmer warden.' }], facts: [] })
    )

    expect(memory.npcs(campaignId)[0]).toMatchObject({
      description: 'A warmer warden.',
      createdSeq: 1,
      changedSeq: 3
    })
    expect(memory.dispositions(id)).toMatchObject([{ stance: 'friendly' }])
  })

  it('is not run for a failed DM turn; Retry is extracted once', async () => {
    await play(undefined, says('Open.'), extracts({ npcs: [], facts: [] }))
    const calls = requests.length
    await play('I push.', fails)
    expect(requests).toHaveLength(calls + 1)

    await play(undefined, says('It opens. Grom waits.'), extracts({ npcs: [grom()], facts: [] }))
    expect(memory.npcs(campaignId)).toHaveLength(1)
    expect(requests).toHaveLength(calls + 3)
  })

  it('is not run for a stopped DM turn', async () => {
    const stop = controller()
    scripts.push(async function* (request) {
      yield delta('Grom ste')
      if (request.signal.aborted) return
      await new Promise<void>((resolve) =>
        request.signal.addEventListener('abort', () => resolve())
      )
    })
    const result = runner.begin(sessionId, {}, stop.signal)
    if (!result.ok) throw new Error('refused')
    for await (const event of result.events) {
      expect(event.type).toBe('delta')
      stop.abort()
    }
    await runner.memoryIdle()

    expect(requests).toHaveLength(1)
    expect(memory.npcs(campaignId)).toEqual([])
  })

  it('runs for a turn that ends in a pending Roll request', async () => {
    scripts.push(async function* () {
      yield delta('Grom blocks you.')
      yield {
        type: 'TOOL_CALL_END',
        toolCallId: 'c1',
        input: { check: 'skill', key: 'stealth', dc: 12, reason: 'Slip past' },
        metadata: { tanstack: { toolCallName: 'request_roll' } }
      }
      yield {
        type: 'RUN_FINISHED',
        outcome: { type: 'interrupt', interrupts: [{ toolCallId: 'c1' }] }
      }
    })
    scripts.push(extracts({ npcs: [grom()], facts: [] }))
    await drain(runner.begin(sessionId, {}, controller().signal))
    await runner.memoryIdle()
    expect(memory.npcs(campaignId).map((n) => n.name)).toEqual(['Grom'])
  })

  it('drops invalid items individually with a log, and keeps the valid ones', async () => {
    await play(undefined, says('Scene.'), extracts({ npcs: [grom()], facts: [] }))
    const id = memory.npcs(campaignId)[0].id

    await play(
      'I act.',
      says('More.'),
      extracts({
        npcs: [
          { name: 'Ok', description: 'Fine.', role: 'x', status: 'alive' },
          { name: ' GROM ', description: 'Dup.', role: 'x', status: 'alive' },
          { name: 'Bad', description: 'Enum.', role: 'x', status: 'zombie' },
          { name: 'Long', description: 'x'.repeat(5000), role: 'x', status: 'alive' },
          { id: 'nope', description: 'Unknown id.' },
          { id, stance: 'adoring' }
        ],
        facts: [{ title: 'Ok fact' }, { title: '' }]
      })
    )

    expect(memory.npcs(campaignId).map((n) => n.name)).toEqual(['Grom', 'Ok'])
    expect(memory.facts(campaignId).map((f) => f.title)).toEqual(['Ok fact'])
    expect(logs).toHaveLength(6)
    expect(logs.map((l) => l.kind).sort()).toEqual(['fact', 'npc', 'npc', 'npc', 'npc', 'npc'])
    expect(logs.every((l) => l.seq === 3)).toBe(true)
    expect(logs.every((l) => l.reason.length > 0)).toBe(true)
    // Rejections are not failures: the watermark moved and extraction keeps running.
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(3)
  })

  it('keeps a dead NPC dead', async () => {
    await play(undefined, says('Scene.'), extracts({ npcs: [grom({ status: 'dead' })], facts: [] }))
    const id = memory.npcs(campaignId)[0].id

    await play(
      'I act.',
      says('More.'),
      extracts({
        npcs: [
          { id, status: 'alive' },
          { id, role: 'ghost' }
        ],
        facts: []
      })
    )

    expect(memory.npcs(campaignId)[0]).toMatchObject({ status: 'dead', role: 'ghost' })
    expect(logs).toHaveLength(1)
  })

  it('drops items beyond the per-call caps', async () => {
    await play(
      undefined,
      says('Crowd.'),
      extracts({
        npcs: Array.from({ length: MAX_NPC_ITEMS + 2 }, (_, i) =>
          grom({ name: `N${i}`, description: 'd', role: 'r' })
        ),
        facts: Array.from({ length: MAX_FACT_CREATES + 2 }, (_, i) => ({ title: `F${i}` }))
      })
    )

    expect(memory.npcs(campaignId)).toHaveLength(MAX_NPC_ITEMS)
    expect(memory.facts(campaignId)).toHaveLength(MAX_FACT_CREATES)
    expect(logs).toHaveLength(4)
  })

  it('drops a knowledge link to a fact that does not exist', async () => {
    await play(
      undefined,
      says('Scene.'),
      extracts({ npcs: [grom({ knows: ['no such fact'] })], facts: [] })
    )
    expect(memory.knownFacts(memory.npcs(campaignId)[0].id)).toEqual([])
    expect(logs).toHaveLength(1)
  })

  it('keeps the watermark on a failure, so the next success covers every Turn since', async () => {
    await play(undefined, says('First.'), errors)
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(0)

    await play('I act.', says('Second.'), extracts({ npcs: [grom()], facts: [] }))

    const input = prompt(requests.at(-1)!)
    expect(input).toContain('First.')
    expect(input).toContain('Second.')
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(3)
  })

  it.each([
    ['not an object', extracts('nonsense')],
    ['the wrong shape', extracts({ npcs: 'x' })],
    ['nothing at all', extracts(undefined)]
  ])('drops unparseable output (%s) whole and counts a failure', async (_name, bad) => {
    const events = await play(undefined, says('First.'), bad)

    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(memory.npcs(campaignId)).toEqual([])
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(0)
  })

  it('stops after repeated consecutive failures, silently', async () => {
    await play(undefined, says('Open.'), errors)
    for (let i = 1; i < MEMORY_MAX_FAILURES; i++) await play(`Act ${i}.`, says('More.'), errors)
    const calls = requests.length

    const events = await play('Again.', says('Going.'), extracts({ npcs: [grom()], facts: [] }))

    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(requests).toHaveLength(calls + 1)
    expect(memory.npcs(campaignId)).toEqual([])
  })

  it('never makes the next DM turn wait on extraction', async () => {
    scripts.push(says('Open.'))
    let release!: () => void
    scripts.push(async function* () {
      await new Promise<void>((r) => (release = r))
      yield {
        type: 'CUSTOM',
        name: 'structured-output.complete',
        value: { object: { npcs: [grom()], facts: [] } }
      }
      yield finished
    })
    await drain(runner.begin(sessionId, {}, controller().signal))

    scripts.push(says('Reply while extraction hangs.'))
    const events = await drain(runner.begin(sessionId, { action: 'I wave.' }, controller().signal))
    expect(events.at(-1)).toMatchObject({ type: 'done' })
    // One extraction in flight at a time: the second DM turn did not start another.
    expect(requests).toHaveLength(3)

    scripts.push(extracts({ npcs: [], facts: [] }))
    release()
    await runner.memoryIdle()
    // The turn saved meanwhile is covered by a follow-up extraction.
    expect(memory.npcs(campaignId)).toHaveLength(1)
    expect(sessions.get(sessionId)?.memoryThroughSeq).toBe(3)
  })
})

describe('World memory in the DM context', () => {
  const dmRequests = () =>
    requests.filter((r) => !r.systemPrompts.join().includes(EXTRACTION_MARKER))
  const system = (call: ChatRequest) => call.systemPrompts.join('\n')

  it('sends an NPC introduced in one DM turn in the next DM turn, and nothing before any memory', async () => {
    await play(
      undefined,
      says('Grom the warden eyes you.'),
      extracts({ npcs: [grom({ stance: 'friendly' })], facts: [] })
    )
    await play('I wave.', says('Grom nods.'), extracts({ npcs: [], facts: [] }))

    const [first, second] = dmRequests()
    expect(system(first)).not.toContain('World memory')
    expect(system(second)).toContain('Grom (alive, friendly toward you), warden')
  })

  it('opens a new Session with memory matched against the previous Session last Turns', async () => {
    await play(
      undefined,
      says('You meet Grom the warden.'),
      extracts({ npcs: [grom({ stance: 'neutral' })], facts: [] })
    )
    sessions.end(sessionId)
    sessionId = sessions.start(campaignId).id
    scripts.push(says('Welcome back.'), extracts({ npcs: [], facts: [] }))
    await drain(runner.begin(sessionId, {}, controller().signal))
    await runner.memoryIdle()
    expect(system(dmRequests().at(-1)!)).toContain('Grom (alive, neutral toward you), warden')
  })
})
