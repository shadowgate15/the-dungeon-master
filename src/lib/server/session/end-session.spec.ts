import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answers, createScriptedPort, says, type Script } from '../../testing/scripted-chat-port'
import { createMemoryExtraction } from '../memory/extraction.ts'
import { SUMMARY_THRESHOLD_TOKENS, createRollingSummary } from '../memory/summary.ts'
import { createSessionEnd } from './end-session.ts'
import { playableCampaign, sessionServiceWith, type PlayableCampaign } from './fixture'
import type { SessionService } from './service'

let fixture: PlayableCampaign
let sessions: SessionService
let sessionId: string

beforeEach(async () => {
  fixture = playableCampaign()
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
})

const empty = { npcs: [], facts: [], dispositions: [], knowledge: [] }

function setup(model: ReturnType<typeof createScriptedPort>, drainMs?: number) {
  const log = vi.fn<(m: string) => void>()
  const memory = createMemoryExtraction(fixture.db, sessions, { log })
  const summary = createRollingSummary(fixture.db, { log })
  const end = createSessionEnd({ sessions, memory, summary, port: model.port, drainMs, log })
  return { memory, summary, end }
}

function longPlay() {
  sessions.appendEvent(sessionId, {
    role: 'narrator',
    kind: 'narration',
    text: 'word '.repeat(SUMMARY_THRESHOLD_TOKENS)
  })
}

/** A model call that waits for `release`, then answers with `script`. */
function gated(script: Script) {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const wrapped: Script = async function* (request) {
    await gate
    yield* script(request)
  }
  return { script: wrapped, release }
}

describe('ending a Session', () => {
  it('marks it ended without waiting for the final extraction and summary, which land afterwards', async () => {
    longPlay()
    const final = gated(answers(empty))
    const model = createScriptedPort([final.script, says('The long story, summarized.')])
    const { end, summary, memory } = setup(model)

    const ended = await end.end(sessionId)

    expect(ended.endedAt).not.toBeNull()
    expect(summary.get(sessionId).text).toBeNull()
    expect(memory.watermark(sessionId)).toBe(0)

    final.release()
    await end.settled()

    expect(memory.watermark(sessionId)).toBe(1)
    expect(summary.get(sessionId)).toEqual({ text: 'The long story, summarized.', throughSeq: 1 })
  })

  it('waits for a running extraction before ending, then runs the rest', async () => {
    longPlay()
    const running = gated(answers(empty))
    const model = createScriptedPort([running.script, answers(empty), says('Summary.')])
    const { end, memory } = setup(model)
    void memory.trigger(sessionId, model.port)
    expect(memory.running(sessionId)).toBe(true)

    let ended = false
    const pending = end.end(sessionId).then(() => (ended = true))
    await new Promise((r) => setTimeout(r, 20))
    expect(ended).toBe(false)

    running.release()
    await pending
    expect(sessions.get(sessionId)!.endedAt).not.toBeNull()
    await end.settled()
  })

  it('waits at most the drain limit for a stuck extraction', async () => {
    longPlay()
    const stuck = gated(answers(empty))
    const model = createScriptedPort([stuck.script, answers(empty), says('Summary.')])
    const { end, memory } = setup(model, 30)
    void memory.trigger(sessionId, model.port)

    const started = Date.now()
    await end.end(sessionId)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(sessions.get(sessionId)!.endedAt).not.toBeNull()

    stuck.release()
    await end.settled()
  })

  it('lifts an extraction pause and still finalizes', async () => {
    const failing = createScriptedPort()
    // The backlog takes two extraction slices before the summary call.
    const { end, memory, summary } = setup(
      createScriptedPort([answers(empty), answers(empty), says('Summary.')])
    )
    for (let i = 0; i < 3; i++) {
      sessions.appendEvent(sessionId, { role: 'narrator', kind: 'narration', text: 'x' })
      await memory.extract(sessionId, failing.port)
    }
    expect(memory.paused(sessionId)).toBe(true)
    longPlay()

    await end.end(sessionId)
    expect(memory.paused(sessionId)).toBe(false)
    await end.settled()
    expect(summary.get(sessionId).text).toBe('Summary.')
  })

  it('a failing background step never rejects the end', async () => {
    longPlay()
    const { end } = setup(createScriptedPort())
    await expect(end.end(sessionId)).resolves.toMatchObject({ id: sessionId })
    await end.settled()
  })
})
