import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createBeatProgress, type BeatProgress } from '../arc/beat-progress.ts'
import { ArcLockedError, createArcService } from '../arc/service.ts'
import type { Database } from '../db/connect'
import { arc, arcAct, arcBeat } from '../db/schema'
import { answers, createScriptedPort, fails, says } from '../../testing/scripted-chat-port'
import {
  firstSceneScripts,
  playableCampaign,
  sessionServiceWith,
  type PlayableCampaign
} from './fixture'
import { createDirectorPipeline } from './scene-director/pipeline.ts'
import { createSceneRunner, type Pipeline } from './scene-runner.ts'
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

const yieldsAtOnce: Pipeline = async function* () {
  yield { type: 'done', reason: 'yield' }
}

function runnerWith(
  pipeline: Pipeline = yieldsAtOnce,
  progress: BeatProgress = createBeatProgress(db, { log })
) {
  return createSceneRunner({ sessions, port: model.port, pipeline, beatProgress: progress })
}

async function play(runner: ReturnType<typeof runnerWith>, id = sessionId, text = 'I act') {
  const result = runner.begin(id, text, new AbortController().signal)
  if (!result.ok) throw new Error(result.reason)
  for await (const e of result.events) void e
  await runner.settled()
}

const propose = (...transitions: { beatId: string; to: string }[]) => answers({ transitions })
const director = (...picks: string[]) => picks.map((p) => says(p))

describe('Beat check after a run', () => {
  it('moves a proposed Beat once, stamped with the Session and the last event id', async () => {
    model.enqueue(propose({ beatId: beats.a, to: 'reached' }))
    await play(runnerWith())

    const lastEvent = sessions.events(sessionId).at(-1)!
    expect(stateOf(beats.a)).toMatchObject({
      state: 'reached',
      stateSessionId: sessionId,
      stateEventId: lastEvent.id
    })
    expect(stateOf(beats.b).state).toBe('pending')

    model.enqueue(propose({ beatId: beats.a, to: 'abandoned' }))
    await play(runnerWith())
    expect(stateOf(beats.a).state).toBe('reached')
  })

  it('abandons pending Beats of earlier Acts when a later-Act Beat is reached', async () => {
    model.enqueue(propose({ beatId: beats.c, to: 'reached' }))
    await play(runnerWith())

    expect(stateOf(beats.c).state).toBe('reached')
    expect(stateOf(beats.a).state).toBe('abandoned')
    expect(stateOf(beats.b).state).toBe('abandoned')
    expect(stateOf(beats.b).stateSessionId).toBe(sessionId)
    expect(stateOf(beats.d).state).toBe('pending')
  })

  it('keeps at most 3 proposals and drops unknown and duplicate ids', async () => {
    model.enqueue(
      propose(
        { beatId: 'nope', to: 'reached' },
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.a, to: 'abandoned' },
        { beatId: beats.b, to: 'abandoned' }
      )
    )
    await play(runnerWith())

    expect(stateOf(beats.a).state).toBe('reached')
    expect(stateOf(beats.b).state).toBe('pending')
  })

  it('shows the model only pending Beats of the current and next Act', async () => {
    model.enqueue(propose({ beatId: beats.a, to: 'reached' }))
    await play(runnerWith())
    model.enqueue(propose())
    await play(runnerWith())

    const prompt = JSON.stringify(model.requests.at(-1))
    expect(prompt).not.toContain(beats.a)
    expect(prompt).toContain(beats.b)
    expect(prompt).toContain(beats.c)
  })

  it('logs a failed check and drops it without retry or changing the run', async () => {
    model.enqueue(fails)
    await play(runnerWith())

    expect(model.requests).toHaveLength(1)
    expect(log).toHaveBeenCalledOnce()
    expect(stateOf(beats.a).state).toBe('pending')
    expect(sessions.events(sessionId)).toHaveLength(1)
  })

  it('drops invalid output without retry', async () => {
    model.enqueue(answers({ transitions: 'lots' }))
    await play(runnerWith())

    expect(model.requests).toHaveLength(1)
    expect(log).toHaveBeenCalledOnce()
    expect(stateOf(beats.a).state).toBe('pending')
  })

  it('skips the check when the Arc has no pending Beats', async () => {
    model.enqueue(
      propose(
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.b, to: 'reached' },
        { beatId: beats.c, to: 'reached' }
      )
    )
    await play(runnerWith())
    model.enqueue(propose({ beatId: beats.d, to: 'reached' }))
    await play(runnerWith())
    const calls = model.requests.length

    await play(runnerWith())
    expect(model.requests).toHaveLength(calls)
  })

  it('does not run after a failed run', async () => {
    const errors: Pipeline = async function* () {
      yield { type: 'done', reason: 'error', message: 'boom' }
    }
    await play(runnerWith(errors))
    expect(model.requests).toHaveLength(0)
  })

  it('only sees the events of its own run', async () => {
    model.enqueue(propose(), propose())
    const runner = runnerWith()
    await play(runner, sessionId, 'first action')
    await play(runner, sessionId, 'second action')

    const second = JSON.stringify(model.requests[1].messages)
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

describe('steering in the prompts', () => {
  it('gives the Director a compact Arc line and the Narrator the full Arc block', async () => {
    model.enqueue(...director('narrate'), says('The door creaks.'), ...director('yield'))
    model.enqueue(propose())
    await play(runnerWith(createDirectorPipeline()))

    const directorPrompt = model.requests[0].messages[0].content
    expect(directorPrompt).toContain('Setup')
    expect(directorPrompt).toContain('2 open Beats')
    expect(directorPrompt).not.toContain('Strangers gather.')

    const narratorSystem = model.requests[1].systemPrompts.join('\n')
    expect(narratorSystem).toContain('Strangers gather.')
    expect(narratorSystem).toContain('Beat a: Do a.')
    expect(narratorSystem).toContain('Beat c')
    expect(narratorSystem.toLowerCase()).toContain('never announce')
  })

  it('adds a drift hook once runs since the last transition reach the threshold, across Sessions', async () => {
    const progress = createBeatProgress(db, { log, driftRuns: 3 })
    const runner = runnerWith(createDirectorPipeline(), progress)

    for (let i = 0; i < 2; i++) {
      model.enqueue(...director('yield'), propose())
      await play(runner)
    }
    expect(model.requests[2].messages[0].content).not.toContain('drifting')

    sessions.end(sessionId)
    serviceModel.enqueue(...firstSceneScripts())
    const next = (await sessions.start(fixture.campaignId)).id
    const before = model.requests.length

    model.enqueue(...director('narrate'), says('Time passes.'), ...director('yield'), propose())
    await play(runner, next)

    expect(model.requests[before].messages[0].content).toContain('drifting')
    expect(model.requests[before + 1].systemPrompts.join('\n')).toContain('drifted')
  })

  it('resets drift when a Beat transitions', async () => {
    const progress = createBeatProgress(db, { log, driftRuns: 2 })
    const runner = runnerWith(createDirectorPipeline(), progress)
    model.enqueue(...director('yield'), propose({ beatId: beats.a, to: 'reached' }))
    await play(runner)
    model.enqueue(...director('yield'), propose())
    await play(runner)

    expect(model.requests[2].messages[0].content).not.toContain('drifting')
  })

  it('says the Arc is complete and play continues when no Beats are pending', async () => {
    model.enqueue(
      propose(
        { beatId: beats.a, to: 'reached' },
        { beatId: beats.b, to: 'reached' },
        { beatId: beats.c, to: 'reached' }
      )
    )
    await play(runnerWith())
    model.enqueue(propose({ beatId: beats.d, to: 'reached' }))
    await play(runnerWith())

    const before = model.requests.length
    model.enqueue(...director('narrate'), says('An epilogue.'), ...director('yield'))
    await play(runnerWith(createDirectorPipeline()))
    expect(model.requests[before].messages[0].content).toContain('complete')
    expect(model.requests[before + 1].systemPrompts.join('\n')).toContain('The relic is destroyed.')
  })
})
