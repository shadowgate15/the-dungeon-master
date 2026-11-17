import { beforeEach, describe, expect, it } from 'vitest'
import { collectText } from '../ai/port.ts'
import type { Database } from '../db/connect'
import { createScriptedPort, says } from '../../testing/scripted-chat-port'
import { playableCampaign } from './fixture'
import {
  createSceneRunner,
  type BeginResult,
  type Pipeline,
  type PipelineEvent,
  type SceneRunner
} from './scene-runner.ts'
import { createSessionService, type SessionService } from './service'

let db: Database
let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(() => {
  const fixture = playableCampaign()
  db = fixture.db
  sessions = createSessionService(db)
  sessionId = sessions.start(fixture.campaignId).id
  model = createScriptedPort()
})

const runnerWith = (pipeline?: Pipeline): SceneRunner =>
  createSceneRunner({ sessions, port: model.port, pipeline })

async function drain(result: BeginResult) {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  const events: PipelineEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const log = () => sessions.events(sessionId).map((e) => `${e.role}:${e.kind}:${e.text}`)

describe('a player action', () => {
  it('is saved as a player-action event, then the stub pipeline yields', async () => {
    const events = await drain(
      runnerWith().begin(sessionId, 'I look around', new AbortController().signal)
    )

    expect(
      events.map((e) =>
        e.type === 'event' ? e.event.kind : e.type === 'done' ? `done:${e.reason}` : e.type
      )
    ).toEqual(['player-action', 'done:yield'])
    expect(log()).toEqual(['player:player-action:I look around'])
  })

  it('survives a reload: a fresh runner and service see the same scene and log', async () => {
    await drain(runnerWith().begin(sessionId, 'I look around', new AbortController().signal))

    const reloaded = createSessionService(db)
    expect(reloaded.events(sessionId).map((e) => e.text)).toEqual(['I look around'])
    expect(reloaded.scene(sessionId).location.name).toBe(sessions.scene(sessionId).location.name)
  })

  it('trims the text and refuses an empty one', () => {
    const runner = runnerWith()
    expect(runner.begin(sessionId, '   ', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'empty-action'
    })
    expect(sessions.events(sessionId)).toEqual([])
  })

  it('is refused on an unknown or ended Session', () => {
    const runner = runnerWith()
    expect(runner.begin('nope', 'hi', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'not-found'
    })
    sessions.end(sessionId)
    expect(runner.begin(sessionId, 'hi', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'ended'
    })
  })

  it('is refused while a roll is pending', () => {
    const scene = sessions.scene(sessionId)
    sessions.saveScene(sessionId, {
      ...scene,
      pendingRoll: { check: 'perception', dc: 12, reason: 'listening' }
    })
    expect(runnerWith().begin(sessionId, 'hi', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'roll-pending'
    })
  })

  it('is refused while another run is in flight, and allowed once it finishes', async () => {
    const runner = runnerWith()
    const first = runner.begin(sessionId, 'one', new AbortController().signal)
    expect(runner.begin(sessionId, 'two', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'in-flight'
    })
    await drain(first)
    await drain(runner.begin(sessionId, 'two', new AbortController().signal))
    expect(log()).toEqual(['player:player-action:one', 'player:player-action:two'])
  })

  it('releases the Session when the caller aborts before reading the stream', () => {
    const runner = runnerWith()
    const controller = new AbortController()
    runner.begin(sessionId, 'one', controller.signal)
    controller.abort()
    expect(runner.begin(sessionId, 'two', new AbortController().signal).ok).toBe(true)
  })
})

describe('the pipeline seam', () => {
  it('runs a pluggable pipeline over the chat port and database-backed state', async () => {
    model.enqueue(says('The hearth ', 'crackles.'))
    const narrate: Pipeline = async function* (ctx) {
      const text = await collectText(ctx.port, {
        systemPrompts: ['Narrate.'],
        messages: [{ role: 'user', content: 'go' }],
        maxTokens: 50,
        threadId: ctx.sessionId,
        signal: ctx.signal
      })
      const event = ctx.sessions.appendEvent(ctx.sessionId, {
        role: 'narrator',
        kind: 'narration',
        text
      })
      yield { type: 'event', event }
      yield { type: 'done', reason: 'yield' }
    }

    const events = await drain(
      runnerWith(narrate).begin(sessionId, 'I wait', new AbortController().signal)
    )

    expect(events.at(-1)).toEqual({ type: 'done', reason: 'yield' })
    expect(log()).toEqual([
      'player:player-action:I wait',
      'narrator:narration:The hearth crackles.'
    ])
  })

  it('ends a run as stopped when the caller aborts, keeping the player action', async () => {
    const controller = new AbortController()
    const waits: Pipeline = async function* () {
      yield* []
      controller.abort() // the player presses Stop mid-run; the pipeline just stops
    }
    const events = await drain(runnerWith(waits).begin(sessionId, 'hmm', controller.signal))
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'stopped' })
    expect(log()).toEqual(['player:player-action:hmm'])
  })

  it('reports a pipeline failure as an error and frees the Session', async () => {
    const broken: Pipeline = async function* () {
      yield* []
      throw new Error('boom')
    }
    const runner = runnerWith(broken)
    const events = await drain(runner.begin(sessionId, 'hmm', new AbortController().signal))
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error', message: 'boom' })
    expect(runner.begin(sessionId, 'again', new AbortController().signal).ok).toBe(true)
  })
})
