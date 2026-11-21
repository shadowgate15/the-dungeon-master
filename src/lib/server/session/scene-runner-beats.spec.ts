import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createBeatProgress, type BeatProgress } from '../arc/beat-progress.ts'
import { ArcLockedError, createArcService } from '../arc/service.ts'
import type { Database } from '../db/connect'
import { arc, arcAct, arcBeat } from '../db/schema'
import { effect, happens } from '../../testing/exchange-scripts'
import {
  answers,
  createScriptedPort,
  fails,
  hangsAfter,
  says,
  type Script
} from '../../testing/scripted-chat-port'
import {
  firstSceneScripts,
  playableCampaign,
  sessionServiceWith,
  type PlayableCampaign
} from './fixture'
import { createSceneRunner } from './scene-runner.ts'
import type { SessionService } from './service'

let fixture: PlayableCampaign
let db: Database
let sessions: SessionService
let serviceModel: ReturnType<typeof sessionServiceWith>['model']
let sessionId: string
let model: ReturnType<typeof createScriptedPort>
let log: Mock<(message: string) => void>
let beats: Record<string, string>

/** An accepted Arc of two Acts: Setup (a, b) and Rising (c, d). Replaces the fixture's Arc. */
function twoActArc() {
  db.delete(arc).where(eq(arc.campaignId, fixture.campaignId)).run()
  const row = db
    .insert(arc)
    .values({
      campaignId: fixture.campaignId,
      status: 'accepted',
      title: 'The Ember Crown',
      premise: 'p',
      stakes: 's',
      resolution: 'The relic is destroyed.',
      createdAt: 1,
      updatedAt: 1
    })
    .returning()
    .get()
  const ids: Record<string, string> = {}
  const acts = [
    ['Setup', 'Strangers gather.', ['a', 'b']],
    ['Rising', 'The threat grows.', ['c', 'd']]
  ] as const
  acts.forEach(([name, purpose, keys], position) => {
    const act = db
      .insert(arcAct)
      .values({ arcId: row.id, position, name, purpose })
      .returning()
      .get()
    keys.forEach((key, i) => {
      ids[key] = db
        .insert(arcBeat)
        .values({ actId: act.id, position: i, title: `Beat ${key}`, description: `Do ${key}.` })
        .returning()
        .get().id
    })
  })
  return ids
}

const stateOf = (id: string) => db.select().from(arcBeat).where(eq(arcBeat.id, id)).get()!

beforeEach(async () => {
  fixture = playableCampaign()
  db = fixture.db
  beats = twoActArc()
  const made = sessionServiceWith(fixture)
  sessions = made.sessions
  serviceModel = made.model
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
  log = vi.fn<(message: string) => void>()
})

function runnerWith(progress: BeatProgress = createBeatProgress(db, { log })) {
  return createSceneRunner({ sessions, port: model.port, beatProgress: progress })
}

/** One Exchange's model answers: a ruling of happens, no Effect, and the Narrator's Reply. */
const exchange = (reply = 'Time passes.') => [happens(), effect({ effect: 'none' }), says(reply)]
const EXCHANGE_REQUESTS = 3

interface Play {
  /** The Beat check's answer, after the Exchange's own; none when no check should run. */
  check?: Script
  runner?: ReturnType<typeof runnerWith>
  id?: string
  text?: string
  /** The Exchange's model answers; defaults to one that replies. */
  scripts?: Script[]
}

/** Plays one Declaration through the runner and waits for the background Beat check. */
async function play({
  check,
  runner = runnerWith(),
  id = sessionId,
  text = 'I act',
  scripts
}: Play = {}) {
  model.enqueue(...(scripts ?? exchange()), ...(check ? [check] : []))
  const result = runner.begin(id, text, new AbortController().signal)
  if (!result.ok) throw new Error(result.reason)
  for await (const e of result.events) void e
  await runner.settled()
}

const propose = (...transitions: { beatId: string; to: string }[]) => answers({ transitions })

/** The Beat check requests the model was sent. */
const checks = () =>
  model.requests.filter((r) => r.systemPrompts.join('\n').includes('track which story beats'))
/** The Narrator's Reply requests the model was sent. */
const narrations = () =>
  model.requests.filter((r) => r.systemPrompts.join('\n').includes('You are the narrator'))

describe('Beat check after an Exchange', () => {
  it('moves a proposed Beat once, stamped with the Session and the last event id', async () => {
    await play({ check: propose({ beatId: beats.a, to: 'reached' }) })

    const lastEvent = sessions.events(sessionId).at(-1)!
    expect(stateOf(beats.a)).toMatchObject({
      state: 'reached',
      stateSessionId: sessionId,
      stateEventId: lastEvent.id
    })
    expect(stateOf(beats.b).state).toBe('pending')

    await play({ check: propose({ beatId: beats.a, to: 'abandoned' }) })
    expect(stateOf(beats.a).state).toBe('reached')
  })

  it('abandons pending Beats of earlier Acts when a later-Act Beat is reached', async () => {
    await play({ check: propose({ beatId: beats.c, to: 'reached' }) })

    expect(stateOf(beats.c).state).toBe('reached')
    expect(stateOf(beats.a).state).toBe('abandoned')
    expect(stateOf(beats.b).state).toBe('abandoned')
    expect(stateOf(beats.b).stateSessionId).toBe(sessionId)
    expect(stateOf(beats.d).state).toBe('pending')
  })

  it('keeps at most 3 proposals and drops unknown and duplicate ids', async () => {
    await play({
      check: propose(
        { beatId: 'nope', to: 'reached' },
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.a, to: 'abandoned' },
        { beatId: beats.b, to: 'abandoned' }
      )
    })

    expect(stateOf(beats.a).state).toBe('reached')
    expect(stateOf(beats.b).state).toBe('pending')
  })

  it('shows the model only pending Beats of the current and next Act', async () => {
    await play({ check: propose({ beatId: beats.a, to: 'reached' }) })
    await play({ check: propose() })

    const prompt = JSON.stringify(checks().at(-1))
    expect(prompt).not.toContain(beats.a)
    expect(prompt).toContain(beats.b)
    expect(prompt).toContain(beats.c)
  })

  it('logs a failed check and drops it without retry or changing the Exchange', async () => {
    await play({ check: fails })

    expect(checks()).toHaveLength(1)
    expect(log).toHaveBeenCalledOnce()
    expect(stateOf(beats.a).state).toBe('pending')
    expect(sessions.events(sessionId).map((e) => e.kind)).toEqual(['declaration', 'narration'])
  })

  it('drops invalid output without retry', async () => {
    await play({ check: answers({ transitions: 'lots' }) })

    expect(checks()).toHaveLength(1)
    expect(log).toHaveBeenCalledOnce()
    expect(stateOf(beats.a).state).toBe('pending')
  })

  it('skips the check when the Arc has no pending Beats', async () => {
    await play({
      check: propose(
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.b, to: 'reached' },
        { beatId: beats.c, to: 'reached' }
      )
    })
    await play({ check: propose({ beatId: beats.d, to: 'reached' }) })
    const calls = model.requests.length

    await play()
    expect(model.requests).toHaveLength(calls + EXCHANGE_REQUESTS)
  })

  it('does not run after a failed Exchange', async () => {
    await play({ scripts: [fails] })
    expect(model.requests).toHaveLength(1)
    expect(checks()).toHaveLength(0)
  })

  it('does not run after a stopped Reply', async () => {
    const runner = runnerWith()
    const controller = new AbortController()
    model.enqueue(happens(), effect({ effect: 'none' }), hangsAfter('The door '))
    const result = runner.begin(sessionId, 'I wait', controller.signal)
    if (!result.ok) throw new Error(result.reason)
    for await (const e of result.events) if (e.type === 'delta') controller.abort()
    await runner.settled()
    expect(checks()).toHaveLength(0)
  })

  it('only sees the events of its own Exchange', async () => {
    const runner = runnerWith()
    await play({ runner, text: 'first action', check: propose() })
    await play({ runner, text: 'second action', check: propose() })

    const second = JSON.stringify(checks()[1].messages)
    expect(second).toContain('second action')
    expect(second).not.toContain('first action')
  })
})

describe('the Arc is read-only to the player', () => {
  it('refuses an Arc edit once a Session exists, so Beat state cannot be edited', () => {
    const arcs = createArcService(db)
    const view = arcs.get(fixture.campaignId)!
    expect(() => arcs.save(fixture.campaignId, view)).toThrow(ArcLockedError)
  })
})

describe('steering in the Reply', () => {
  it('gives the Narrator the full Arc block, and the ruling steps no Arc', async () => {
    await play({ scripts: exchange('The door creaks.'), check: propose() })

    const narratorSystem = narrations()[0].systemPrompts.join('\n')
    expect(narratorSystem).toContain('Strangers gather.')
    expect(narratorSystem).toContain('Beat a: Do a.')
    expect(narratorSystem).toContain('Beat c')
    expect(narratorSystem.toLowerCase()).toContain('never announce')

    const adjudication = JSON.stringify(model.requests[0])
    expect(adjudication).not.toContain('Strangers gather.')
  })

  it('adds a drift hook once Exchanges since the last transition reach the threshold, across Sessions', async () => {
    const runner = runnerWith(createBeatProgress(db, { log, driftRuns: 3 }))

    for (let i = 0; i < 2; i++) await play({ runner, check: propose() })
    expect(narrations().at(-1)!.systemPrompts.join('\n')).not.toContain('drifted')

    sessions.end(sessionId)
    serviceModel.enqueue(...firstSceneScripts())
    const next = (await sessions.start(fixture.campaignId)).id

    await play({ runner, id: next, check: propose() })
    expect(narrations().at(-1)!.systemPrompts.join('\n')).toContain('drifted')
  })

  it('resets drift when a Beat transitions', async () => {
    const runner = runnerWith(createBeatProgress(db, { log, driftRuns: 2 }))
    await play({ runner, check: propose({ beatId: beats.a, to: 'reached' }) })
    await play({ runner, check: propose() })

    expect(narrations().at(-1)!.systemPrompts.join('\n')).not.toContain('drifted')
  })

  it('says the Arc is complete and play continues when no Beats are pending', async () => {
    await play({
      check: propose(
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.b, to: 'reached' },
        { beatId: beats.c, to: 'reached' }
      )
    })
    await play({ check: propose({ beatId: beats.d, to: 'reached' }) })

    await play({ scripts: exchange('An epilogue.') })
    expect(narrations().at(-1)!.systemPrompts.join('\n')).toContain('The relic is destroyed.')
  })
})
