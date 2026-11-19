import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { answers, createScriptedPort, fails } from '../../testing/scripted-chat-port'
import type { Database } from '../db/connect'
import { disposition, fact, memoryRun, npc, npcFact, place, session } from '../db/schema'
import {
  addNpc,
  playableCampaign,
  sessionServiceWith,
  type PlayableCampaign
} from '../session/fixture'
import { createSceneRunner, type Pipeline } from '../session/scene-runner.ts'
import type { SessionService } from '../session/service'
import { createMemoryExtraction, type MemoryExtraction } from './extraction.ts'

let fixture: PlayableCampaign
let db: Database
let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>
let log: Mock<(message: string) => void>
let memory: MemoryExtraction

beforeEach(async () => {
  fixture = playableCampaign()
  db = fixture.db
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
  log = vi.fn<(message: string) => void>()
  memory = createMemoryExtraction(db, sessions, { log })
})

/** A recorded Event log: the player acts, the DM narrates a newcomer, who speaks. */
function recordPlay(extra: () => void = () => {}) {
  sessions.appendEvent(sessionId, {
    role: 'player',
    kind: 'player-action',
    text: 'I ask the room who is here.'
  })
  sessions.appendEvent(sessionId, {
    role: 'narrator',
    kind: 'narration',
    text: 'A grey-cloaked stranger named Veyra rises and says the old well is cursed.'
  })
  extra()
}

const empty = { npcs: [], facts: [], dispositions: [], knowledge: [] }
const proposal = (p: Record<string, unknown>) => answers({ ...empty, ...p })
const runs = () => db.select().from(memoryRun).where(eq(memoryRun.sessionId, sessionId)).all()
const npcNamed = (name: string) =>
  db
    .select()
    .from(npc)
    .where(and(eq(npc.campaignId, fixture.campaignId), eq(npc.name, name)))
    .get()

describe('replaying a recorded Event log through extraction', () => {
  it('writes validated NPCs, facts, dispositions and knowledge, then moves the watermark', async () => {
    recordPlay()
    model.enqueue(
      proposal({
        npcs: [
          { name: 'Veyra', description: 'A grey-cloaked stranger.', role: 'Wanderer', seq: 2 }
        ],
        facts: [
          { title: 'The well is cursed', detail: 'Veyra says the old well is cursed.', seq: 2 }
        ],
        dispositions: [{ npc: 'Veyra', stance: 'friendly', note: 'Warns the player.' }],
        knowledge: [{ npc: 'Veyra', fact: 'The well is cursed' }]
      })
    )

    expect(await memory.extract(sessionId, model.port)).toBe('success')

    const veyra = npcNamed('Veyra')!
    expect(veyra).toMatchObject({
      role: 'Wanderer',
      status: 'alive',
      createdSeq: 2,
      createdSessionId: sessionId
    })
    const f = db.select().from(fact).where(eq(fact.campaignId, fixture.campaignId)).get()!
    expect(f).toMatchObject({ title: 'The well is cursed', createdSeq: 2 })
    expect(db.select().from(npcFact).all()).toEqual([{ npcId: veyra.id, factId: f.id }])
    expect(
      db.select().from(disposition).where(eq(disposition.npcId, veyra.id)).get()
    ).toMatchObject({
      stance: 'friendly',
      note: 'Warns the player.',
      characterId: fixture.characterId
    })
    expect(memory.watermark(sessionId)).toBe(2)
    expect(runs()).toEqual([
      expect.objectContaining({
        kind: 'extraction',
        fromSeq: 1,
        toSeq: 2,
        outcome: 'success',
        accepted: 4,
        dropped: 0,
        droppedItems: []
      })
    ])
  })

  it('drops invalid items on their own and records kind and reason, never text', async () => {
    const dead = addNpc(fixture, { name: 'Old Tobb', status: 'dead' })
    const deadHandle =
      db
        .select()
        .from(npc)
        .all()
        .findIndex((n) => n.id === dead) + 1
    recordPlay()
    model.enqueue(
      proposal({
        npcs: [
          { name: 'Veyra', description: 'A stranger.', role: 'Wanderer' },
          { name: 'veyra!', description: 'Same name again.', role: 'Wanderer' },
          { name: 'Captain 7', description: 'Has a digit.', role: 'Guard' },
          { ref: `n${deadHandle}`, status: 'alive' },
          { ref: 'n99', status: 'dead' }
        ],
        facts: [
          { title: 'Late', detail: 'Cites an event that is not here.', seq: 99 },
          { title: 'Nine guards', detail: 'There are 9 guards.' }
        ],
        dispositions: [
          { npc: 'Nobody', stance: 'friendly', note: '' },
          { npc: 'Veyra', stance: 'adoring', note: '' }
        ],
        knowledge: [{ npc: 'Veyra', fact: 'No such fact' }]
      })
    )

    expect(await memory.extract(sessionId, model.port)).toBe('success')

    expect(npcNamed('Veyra')).toBeDefined()
    expect(npcNamed('Captain 7')).toBeUndefined()
    expect(db.select().from(npc).where(eq(npc.id, dead)).get()!.status).toBe('dead')
    expect(db.select().from(fact).all()).toHaveLength(0)
    const [row] = runs()
    expect(row).toMatchObject({ accepted: 1, dropped: 9 })
    expect(row.droppedItems).toEqual([
      { kind: 'npc', reason: 'name is already taken in this Campaign' },
      { kind: 'npc', reason: 'name contains a digit' },
      { kind: 'npc', reason: 'a dead NPC stays dead without a stated revival reason' },
      { kind: 'npc', reason: 'unknown NPC ref' },
      { kind: 'fact', reason: 'cites an event outside the covered range' },
      { kind: 'fact', reason: 'detail contains a digit' },
      { kind: 'disposition', reason: 'unknown NPC' },
      { kind: 'disposition', reason: 'unknown stance' },
      { kind: 'knowledge', reason: 'unknown fact' }
    ])
    expect(JSON.stringify(row.droppedItems)).not.toMatch(/Captain|Nine guards|Late/)
  })

  it('drops items over the per-call cap', async () => {
    recordPlay()
    const many = ['Ann', 'Bea', 'Cal', 'Dov', 'Eli', 'Fay'].map((name) => ({
      name,
      description: 'Someone.',
      role: 'Local'
    }))
    const before = db.select().from(npc).all().length
    model.enqueue(proposal({ npcs: many }))
    await memory.extract(sessionId, model.port)

    expect(db.select().from(npc).all()).toHaveLength(before + 5)
    expect(runs()[0].droppedItems).toEqual([{ kind: 'npc', reason: 'over the per-call cap' }])
  })

  it('only covers events past the watermark on the next call', async () => {
    recordPlay()
    model.enqueue(proposal({}))
    await memory.extract(sessionId, model.port)
    expect(await memory.extract(sessionId, model.port)).toBe('idle')
    expect(model.requests).toHaveLength(1)

    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'I leave.' })
    model.enqueue(proposal({}))
    await memory.extract(sessionId, model.port)
    const prompt = JSON.stringify(model.requests[1])
    expect(prompt).toContain('I leave.')
    expect(prompt).not.toContain('grey-cloaked')
    expect(memory.watermark(sessionId)).toBe(3)
    expect(runs().map((r) => [r.fromSeq, r.toSeq])).toEqual([
      [1, 2],
      [3, 3]
    ])
  })
})

describe('newcomers and the Scene', () => {
  const newcomer = (present: boolean) =>
    proposal({
      npcs: [{ name: 'Veyra', description: 'A stranger.', role: 'Wanderer', present, seq: 2 }]
    })

  it('places a newcomer in the Scene only by the code rule, when narration put them here', async () => {
    recordPlay()
    model.enqueue(newcomer(true))
    await memory.extract(sessionId, model.port)
    const veyra = npcNamed('Veyra')!
    expect(sessions.scene(sessionId).npcs.map((n) => n.id)).toContain(veyra.id)
  })

  it('leaves a newcomer out of the Scene unless narration put them at the current place', async () => {
    recordPlay()
    model.enqueue(newcomer(false))
    await memory.extract(sessionId, model.port)
    expect(sessions.scene(sessionId).npcs.map((n) => n.name)).not.toContain('Veyra')
  })

  it('does not place a newcomer introduced before a move in the same range', async () => {
    recordPlay(() =>
      sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'scene-changed',
        text: 'You go through: the cellar door.',
        data: { from: 'x', to: 'The Cellar' }
      })
    )
    model.enqueue(newcomer(true))
    await memory.extract(sessionId, model.port)
    expect(npcNamed('Veyra')).toBeDefined()
    expect(sessions.scene(sessionId).npcs.map((n) => n.name)).not.toContain('Veyra')
  })

  it('does not place a newcomer who is dead', async () => {
    recordPlay()
    model.enqueue(
      proposal({
        npcs: [
          { name: 'Veyra', description: 'A body.', role: 'Corpse', status: 'dead', present: true }
        ]
      })
    )
    await memory.extract(sessionId, model.port)
    expect(sessions.scene(sessionId).npcs.map((n) => n.name)).not.toContain('Veyra')
  })
})

describe('the place rule on a move', () => {
  it('writes a place when a move lands somewhere World memory does not know', async () => {
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      location: { name: 'The Cellar', description: 'Cold and damp.' },
      exits: [{ id: 'up', name: 'The stairs up' }]
    })
    recordPlay(() =>
      sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'scene-changed',
        text: 'You go through: the cellar door.',
        data: { from: 'The Tavern', to: 'The Cellar' }
      })
    )
    model.enqueue(proposal({}))
    await memory.extract(sessionId, model.port)

    const row = db.select().from(place).where(eq(place.name, 'The Cellar')).get()!
    expect(row).toMatchObject({
      campaignId: fixture.campaignId,
      description: 'Cold and damp.',
      createdSessionId: sessionId,
      createdSeq: 3
    })
  })

  it('does not write a second place for one that memory already holds', async () => {
    recordPlay(() =>
      sessions.appendEvent(sessionId, {
        role: 'code',
        kind: 'scene-changed',
        text: 'moved',
        data: { from: 'a', to: sessions.scene(sessionId).location.name }
      })
    )
    const before = db.select().from(place).all().length
    model.enqueue(proposal({}))
    await memory.extract(sessionId, model.port)
    expect(db.select().from(place).all()).toHaveLength(before)
  })
})

describe('failures', () => {
  it('leaves the watermark on a failed call, records it and covers the events next time', async () => {
    recordPlay()
    model.enqueue(fails)
    expect(await memory.extract(sessionId, model.port)).toBe('failure')
    expect(memory.watermark(sessionId)).toBe(0)
    expect(log).toHaveBeenCalledOnce()
    expect(runs()).toEqual([
      expect.objectContaining({ outcome: 'failure', fromSeq: 1, toSeq: 2, accepted: 0 })
    ])

    model.enqueue(proposal({ facts: [{ title: 'A fact', detail: 'It holds.' }] }))
    expect(await memory.extract(sessionId, model.port)).toBe('success')
    expect(memory.watermark(sessionId)).toBe(2)
    expect(db.select().from(fact).all()).toHaveLength(1)
  })

  it('counts unparseable output as a failure and writes nothing from it', async () => {
    const before = db.select().from(npc).all().length
    recordPlay()
    model.enqueue(answers({ npcs: 'lots' }))
    expect(await memory.extract(sessionId, model.port)).toBe('failure')
    expect(memory.watermark(sessionId)).toBe(0)
    expect(db.select().from(npc).all()).toHaveLength(before)
  })

  it('pauses after three failures in a row, until the Session ends', async () => {
    recordPlay()
    model.enqueue(fails, fails, fails)
    await memory.trigger(sessionId, model.port)
    await memory.trigger(sessionId, model.port)
    expect(memory.paused(sessionId)).toBe(false)
    await memory.trigger(sessionId, model.port)
    expect(memory.paused(sessionId)).toBe(true)
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('paused'))

    await memory.trigger(sessionId, model.port)
    expect(model.requests).toHaveLength(3)

    memory.resume(sessionId)
    model.enqueue(proposal({}))
    await memory.trigger(sessionId, model.port)
    expect(model.requests).toHaveLength(4)
    expect(memory.watermark(sessionId)).toBe(2)
  })

  it('a success resets the failure count', async () => {
    recordPlay()
    model.enqueue(fails, fails, proposal({}), fails, fails)
    for (let i = 0; i < 3; i++) await memory.extract(sessionId, model.port)
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'More.' })
    for (let i = 0; i < 2; i++) await memory.extract(sessionId, model.port)
    expect(memory.paused(sessionId)).toBe(false)
  })

  it('never throws, even when the model port does', async () => {
    recordPlay()
    const broken = () => {
      throw new Error('no model')
    }
    expect(await memory.extract(sessionId, broken)).toBe('failure')
  })

  it('an forced extraction runs while paused', async () => {
    recordPlay()
    model.enqueue(fails, fails, fails)
    for (let i = 0; i < 3; i++) await memory.extract(sessionId, model.port)
    expect(await memory.extract(sessionId, model.port)).toBe('paused')
    model.enqueue(proposal({}))
    expect(await memory.extract(sessionId, model.port, { force: true })).toBe('success')
  })

  it('works on an ended Session, for the final extraction', async () => {
    recordPlay()
    sessions.end(sessionId)
    model.enqueue(
      proposal({ facts: [{ title: 'Late fact', detail: 'Lands on the ended Session.' }] })
    )
    await memory.extract(sessionId, model.port)
    expect(db.select().from(fact).get()).toMatchObject({ createdSessionId: sessionId })
    expect(db.select().from(session).where(eq(session.id, sessionId)).get()!.memoryThroughSeq).toBe(
      2
    )
  })
})

describe('one extraction at a time per Session', () => {
  it('coalesces triggers made while one runs into a single follow-up', async () => {
    recordPlay()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const slow = async function* () {
      await gate
      yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object: empty } }
      yield { type: 'RUN_FINISHED' }
    }
    model.enqueue(slow, proposal({}))

    const first = memory.trigger(sessionId, model.port)
    expect(memory.running(sessionId)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 10))
    const second = memory.trigger(sessionId, model.port)
    const third = memory.trigger(sessionId, model.port)
    expect(model.requests).toHaveLength(1)
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'Next.' })

    release()
    await Promise.all([first, second, third])
    expect(model.requests).toHaveLength(2)
    expect(memory.watermark(sessionId)).toBe(3)
    expect(await memory.drain(sessionId, 1000)).toBe(true)
  })

  it('drain gives up after its timeout while the extraction keeps going', async () => {
    recordPlay()
    const hang = async function* () {
      await new Promise((resolve) => setTimeout(resolve, 80))
      yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object: empty } }
      yield { type: 'RUN_FINISHED' }
    }
    model.enqueue(hang)
    void memory.trigger(sessionId, model.port)
    expect(await memory.drain(sessionId, 10)).toBe(false)
    expect(await memory.drain(sessionId, 1000)).toBe(true)
    expect(memory.watermark(sessionId)).toBe(2)
  })
})

describe('after a run', () => {
  const yields: Pipeline = async function* () {
    yield { type: 'done', reason: 'yield' }
  }
  const rolls: Pipeline = async function* () {
    yield { type: 'done', reason: 'roll' }
  }
  const errors: Pipeline = async function* () {
    yield { type: 'done', reason: 'error', message: 'boom' }
  }
  const stops: Pipeline = async function* () {
    yield { type: 'done', reason: 'stopped' }
  }

  async function play(pipeline: Pipeline, signal = new AbortController().signal) {
    const runner = createSceneRunner({ sessions, port: model.port, pipeline, memory })
    const result = runner.begin(sessionId, 'I look around.', signal)
    if (!result.ok) throw new Error(result.reason)
    const seen = []
    for await (const e of result.events) seen.push(e)
    await runner.settled()
    return seen
  }

  it('extracts in the background after a yield and after a roll request', async () => {
    model.enqueue(proposal({ facts: [{ title: 'First', detail: 'One thing.' }] }))
    await play(yields)
    expect(memory.watermark(sessionId)).toBe(1)

    model.enqueue(proposal({ facts: [{ title: 'Second', detail: 'Another thing.' }] }))
    await play(rolls)
    expect(
      db
        .select()
        .from(fact)
        .all()
        .map((f) => f.title)
    ).toEqual(['First', 'Second'])
  })

  it('triggers nothing after an errored or stopped run', async () => {
    await play(errors)
    await play(stops)
    expect(model.requests).toHaveLength(0)
    expect(memory.watermark(sessionId)).toBe(0)
  })

  it('never fails the run because of memory', async () => {
    model.enqueue(fails)
    const seen = await play(yields)
    expect(seen.at(-1)).toEqual({ type: 'done', reason: 'yield' })
    expect(memory.watermark(sessionId)).toBe(0)
    expect(log).toHaveBeenCalledOnce()
  })

  it('does not make the next action wait for a running extraction', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    model.enqueue(async function* () {
      await gate
      yield { type: 'CUSTOM', name: 'structured-output.complete', value: { object: empty } }
      yield { type: 'RUN_FINISHED' }
    })
    const runner = createSceneRunner({ sessions, port: model.port, pipeline: yields, memory })
    const drain = async (r: ReturnType<typeof runner.begin>) => {
      if (!r.ok) throw new Error(r.reason)
      for await (const e of r.events) void e
    }
    await drain(runner.begin(sessionId, 'one', new AbortController().signal))
    await drain(runner.begin(sessionId, 'two', new AbortController().signal))
    expect(memory.running(sessionId)).toBe(true)
    expect(sessions.events(sessionId)).toHaveLength(2)

    model.enqueue(proposal({}))
    release()
    await runner.settled()
    expect(memory.watermark(sessionId)).toBe(2)
  })
})
