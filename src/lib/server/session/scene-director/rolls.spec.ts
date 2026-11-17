import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../testing/scripted-chat-port'
import type { Database } from '../../db/connect'
import { playableCampaign } from '../fixture'
import {
  createSceneRunner,
  type BeginResult,
  type ResolveResult,
  type PipelineEvent
} from '../scene-runner.ts'
import { createSessionService, type SessionService } from '../service'
import { buildMenu } from './menu.ts'
import { MENU_OPTIONS } from './options.ts'
import { createDirectorPipeline } from './pipeline.ts'

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

/** A runner whose d20 always lands on `die` and whose modifier is `modifier`. */
const runner = (die = 10, modifier = 3) =>
  createSceneRunner({
    sessions,
    port: model.port,
    pipeline: createDirectorPipeline(),
    dice: { random: () => 0, roll: () => die, d20: () => die },
    rollModifier: () => modifier
  })

async function drain(result: BeginResult | ResolveResult) {
  if (!result.ok) throw new Error(result.reason)
  const events: PipelineEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const types = (events: PipelineEvent[]) =>
  events.map((e) => (e.type === 'done' ? `done:${e.reason}` : e.type))
const log = () => sessions.events(sessionId).map((e) => `${e.role}:${e.kind}`)
const signal = () => new AbortController().signal

describe('a Director roll request', () => {
  it('sets the pending roll with a DC from the code table, logs it and forces a yield', async () => {
    model.enqueue(says('roll:perception'))

    const events = await drain(runner().begin(sessionId, 'I scan the room', signal()))

    expect(types(events).at(-1)).toBe('done:roll')
    expect(log()).toEqual(['player:player-action', 'code:roll-requested'])
    const pending = sessions.scene(sessionId).pendingRoll
    expect(pending).toMatchObject({ check: 'perception', dc: 12 })
    expect(pending?.reason).toBeTruthy()
    expect(sessions.events(sessionId)[1].data).toMatchObject({ check: 'perception', dc: 12 })
  })

  it('does not take a DC from the model', async () => {
    model.enqueue(says('roll:perception DC 3'))
    await drain(runner().begin(sessionId, 'I look', signal()))
    expect(sessions.scene(sessionId).pendingRoll?.dc).toBe(12)
  })

  it('is offered unless a roll is already pending', () => {
    const action = sessions.appendEvent(sessionId, {
      role: 'player',
      kind: 'player-action',
      text: 'hi'
    })
    const menu = () =>
      buildMenu(MENU_OPTIONS, { scene: sessions.scene(sessionId), events: [action] }).map(
        (m) => m.id
      )
    expect(menu()).toContain('roll:perception')
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      pendingRoll: { check: 'perception', dc: 12, reason: 'x' }
    })
    expect(menu().some((id) => id.startsWith('roll:'))).toBe(false)
  })
})

describe('resolving a roll', () => {
  const requestRoll = async () => {
    model.enqueue(says('roll:stealth'))
    await drain(runner().begin(sessionId, 'I sneak', signal()))
  }

  it('rolls the d20 in code, adds the modifier, logs the result against the DC and continues to narration', async () => {
    await requestRoll()
    model.enqueue(says('narrate'), says('You slip past.'), says('yield'))

    const events = await drain(runner(15, 3).resolveRoll(sessionId, signal()))

    expect(sessions.scene(sessionId).pendingRoll).toBeNull()
    const resolved = sessions.events(sessionId).find((e) => e.kind === 'roll-resolved')
    expect(resolved?.role).toBe('code')
    expect(resolved?.data).toEqual({
      check: 'stealth',
      dc: 12,
      die: 15,
      modifier: 3,
      total: 18,
      success: true
    })
    expect(log().slice(-2)).toEqual(['code:roll-resolved', 'narrator:narration'])
    expect(types(events)[0]).toBe('event')
    expect(types(events).at(-1)).toBe('done:yield')
  })

  it('records a failure when the total is under the DC', async () => {
    await requestRoll()
    model.enqueue(says('yield'))
    await drain(runner(4, 1).resolveRoll(sessionId, signal()))
    const resolved = sessions.events(sessionId).find((e) => e.kind === 'roll-resolved')
    expect(resolved?.data).toMatchObject({ total: 5, success: false })
  })

  it('shows the Director the outcome so it can be narrated', async () => {
    await requestRoll()
    model.enqueue(says('yield'))
    await drain(runner(15, 3).resolveRoll(sessionId, signal()))
    expect(model.requests.at(-1)?.messages[0].content).toContain('18')
  })

  it('is refused when no roll is pending, or the Session is unknown', () => {
    expect(runner().resolveRoll(sessionId, signal())).toEqual({
      ok: false,
      reason: 'no-pending-roll'
    })
    expect(runner().resolveRoll('nope', signal())).toEqual({ ok: false, reason: 'not-found' })
  })

  it('cannot be skipped: the pending roll survives a reload and refuses new actions', async () => {
    await requestRoll()
    const reloaded = createSessionService(db)
    expect(reloaded.scene(sessionId).pendingRoll).toMatchObject({ check: 'stealth', dc: 12 })
    expect(runner().begin(sessionId, 'never mind', signal())).toEqual({
      ok: false,
      reason: 'roll-pending'
    })
  })
})
