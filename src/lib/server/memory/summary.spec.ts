import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createScriptedPort, fails, says } from '../../testing/scripted-chat-port'
import type { Database } from '../db/connect'
import { memoryRun, session } from '../db/schema'
import { playableCampaign, sessionServiceWith, type PlayableCampaign } from '../session/fixture'
import type { SessionService } from '../session/service'
import {
  SUMMARY_MARKER,
  SUMMARY_THRESHOLD_TOKENS,
  createRollingSummary,
  type RollingSummary
} from './summary.ts'

let fixture: PlayableCampaign
let db: Database
let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>
let log: Mock<(message: string) => void>
let summary: RollingSummary

beforeEach(async () => {
  fixture = playableCampaign()
  db = fixture.db
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
  log = vi.fn<(message: string) => void>()
  summary = createRollingSummary(db, { log })
})

/** Narration of about `tokens` tokens of event text. */
function narrate(tokens: number, label = 'word') {
  sessions.appendEvent(sessionId, {
    role: 'narrator',
    kind: 'narration',
    text: `${label} `.repeat(Math.ceil((tokens * 4) / (label.length + 1)))
  })
}

const runs = () => db.select().from(memoryRun).where(eq(memoryRun.sessionId, sessionId)).all()

describe('the Rolling summary', () => {
  it('does nothing while uncovered event text is under the threshold', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS - 200)
    expect(await summary.summarize(sessionId, model.port)).toBe('idle')
    expect(model.requests).toHaveLength(0)
    expect(summary.get(sessionId)).toEqual({ text: null, throughSeq: 0 })
  })

  it('writes the summary and advances its watermark once the threshold is passed', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS + 100)
    model.enqueue(says('The party arrived at the tavern.'))

    expect(await summary.summarize(sessionId, model.port)).toBe('success')

    expect(summary.get(sessionId)).toEqual({
      text: 'The party arrived at the tavern.',
      throughSeq: sessions.events(sessionId).at(-1)!.seq
    })
    expect(model.requests[0].systemPrompts[0]).toContain(SUMMARY_MARKER)
    expect(model.requests[0].outputSchema).toBeUndefined()
    expect(runs()).toMatchObject([{ kind: 'summary', outcome: 'success', accepted: 1 }])
  })

  it('merges the previous summary with only the newly covered events', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS + 100, 'first')
    model.enqueue(says('Old summary text.'))
    await summary.summarize(sessionId, model.port)
    narrate(SUMMARY_THRESHOLD_TOKENS + 100, 'second')
    model.enqueue(says('Merged summary text.'))

    expect(await summary.summarize(sessionId, model.port)).toBe('success')

    const prompt = model.requests[1].messages[0].content
    expect(prompt).toContain('Old summary text.')
    expect(prompt).toContain('second')
    expect(prompt).not.toContain('first')
    expect(summary.get(sessionId).text).toBe('Merged summary text.')
  })

  it.each([
    ['digits', 'The party found 3 coins.', 'contains a digit'],
    ['size', 'word '.repeat(400), 'over']
  ])(
    'rejects a summary with bad %s and leaves summary and watermark alone',
    async (_name, text, why) => {
      narrate(SUMMARY_THRESHOLD_TOKENS + 100)
      model.enqueue(says(text))

      expect(await summary.summarize(sessionId, model.port)).toBe('failure')

      expect(summary.get(sessionId)).toEqual({ text: null, throughSeq: 0 })
      const [row] = runs()
      expect(row).toMatchObject({ outcome: 'failure', dropped: 1 })
      expect(row.droppedItems[0].reason).toContain(why)
      expect(log).toHaveBeenCalledOnce()
    }
  )

  it('keeps the old summary and watermark when the call fails, and retries later', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS + 100)
    model.enqueue(fails)
    expect(await summary.summarize(sessionId, model.port)).toBe('failure')
    expect(summary.get(sessionId)).toEqual({ text: null, throughSeq: 0 })
    expect(runs()).toMatchObject([{ outcome: 'failure', fromSeq: 1 }])

    model.enqueue(says('It worked this time.'))
    expect(await summary.summarize(sessionId, model.port)).toBe('success')
    expect(summary.get(sessionId).text).toBe('It worked this time.')
  })

  it('never throws when the model port itself throws', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS + 100)
    expect(await summary.summarize(sessionId, model.port)).toBe('failure')
    expect(log).toHaveBeenCalled()
  })

  it('reports in-flight status and drains', async () => {
    narrate(SUMMARY_THRESHOLD_TOKENS + 100)
    model.enqueue(says('Done.'))
    const pending = summary.summarize(sessionId, model.port)
    expect(summary.running(sessionId)).toBe(true)
    expect(await summary.drain(sessionId, 1000)).toBe(true)
    await pending
    expect(summary.running(sessionId)).toBe(false)
  })
})

describe('the recap of an earlier Session', () => {
  it('is nothing for a first Session', () => {
    expect(summary.recap(fixture.campaignId, sessionId)).toBeUndefined()
  })

  it('prefers the previous Session summary, then falls back to its last narration', async () => {
    sessions.appendEvent(sessionId, { role: 'narrator', kind: 'narration', text: 'Fin.' })
    sessions.end(sessionId)
    const next = await sessions.start(fixture.campaignId)

    expect(summary.recap(fixture.campaignId, next.id)).toEqual({
      source: 'narration',
      sessionId,
      text: 'Fin.'
    })

    db.update(session).set({ summary: 'The story so far.' }).where(eq(session.id, sessionId)).run()
    expect(summary.recap(fixture.campaignId, next.id)).toEqual({
      source: 'summary',
      sessionId,
      text: 'The story so far.'
    })
  })

  it('recaps the most recent earlier Session even when it was never ended', () => {
    sessions.appendEvent(sessionId, { role: 'narrator', kind: 'narration', text: 'Cliffhanger.' })
    const startedAt = sessions.get(sessionId)!.startedAt
    const later = db
      .insert(session)
      .values({
        campaignId: fixture.campaignId,
        characterId: fixture.characterId,
        startedAt: startedAt + 10,
        endedAt: startedAt + 20
      })
      .returning()
      .get()

    expect(summary.recap(fixture.campaignId, later.id)).toEqual({
      source: 'narration',
      sessionId,
      text: 'Cliffhanger.'
    })
  })
})
