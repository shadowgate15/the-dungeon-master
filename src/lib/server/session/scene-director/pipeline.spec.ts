import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, fails, hangsAfter, says } from '../../../testing/scripted-chat-port'
import { playableCampaign } from '../fixture'
import { createSceneRunner, type PipelineEvent } from '../scene-runner.ts'
import { createSessionService, type SessionService } from '../service'
import { buildMenu, parsePick } from './menu.ts'
import { MENU_OPTIONS } from './options.ts'
import { createDirectorPipeline } from './pipeline.ts'

let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(() => {
  const fixture = playableCampaign()
  sessions = createSessionService(fixture.db)
  sessionId = sessions.start(fixture.campaignId).id
  model = createScriptedPort()
})

async function play(text: string, signal = new AbortController().signal) {
  const runner = createSceneRunner({
    sessions,
    port: model.port,
    pipeline: createDirectorPipeline()
  })
  const result = runner.begin(sessionId, text, signal)
  if (!result.ok) throw new Error(result.reason)
  const events: PipelineEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const log = () => sessions.events(sessionId).map((e) => `${e.role}:${e.kind}:${e.text}`)
const types = (events: PipelineEvent[]) =>
  events.map((e) => (e.type === 'done' ? `done:${e.reason}` : e.type))

describe('the menu', () => {
  const menuOf = (events = sessions.events(sessionId)) =>
    buildMenu(MENU_OPTIONS, { scene: sessions.scene(sessionId), events })
      .map((m) => m.id)
      .filter((id) => !id.startsWith('npc-speaks') && !id.includes('dialogue')) // see steps/*.spec.ts

  it('offers narrate and yield after a player action', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'hi' })
    expect(menuOf()).toEqual(['narrate', 'yield'])
  })

  it('drops narrate right after narration', () => {
    sessions.appendEvent(sessionId, { role: 'narrator', kind: 'narration', text: 'Rain.' })
    expect(menuOf()).toEqual(['yield'])
  })

  it('reads the Director answer as a menu id, tolerating chatter, never an unknown one', () => {
    const menu = [
      { id: 'narrate', hint: '' },
      { id: 'yield', hint: '' }
    ]
    expect(parsePick(' Narrate ', menu)).toBe('narrate')
    expect(parsePick('I choose yield.', menu)).toBe('yield')
    expect(parsePick('dance', menu)).toBeUndefined()
  })
})

describe('a run', () => {
  it('shows thinking, streams the narration token by token, saves it, then yields after a Director pick', async () => {
    model.enqueue(says('narrate'), says('Rain ', 'taps the ', 'roof.'), says('yield'))

    const events = await play('I listen')

    expect(types(events)).toEqual([
      'event', // the player's action
      'thinking',
      'delta',
      'delta',
      'delta',
      'event', // the finished narration
      'thinking',
      'done:yield'
    ])
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text)).toEqual([
      'Rain ',
      'taps the ',
      'roof.'
    ])
    expect(log()).toEqual([
      'player:player-action:I listen',
      'narrator:narration:Rain taps the roof.'
    ])
  })

  it('hands control back at once when the Director picks yield', async () => {
    model.enqueue(says('yield'))
    const events = await play('I wait')
    expect(types(events)).toEqual(['event', 'thinking', 'done:yield'])
    expect(log()).toEqual(['player:player-action:I wait'])
  })

  it('treats an unusable Director answer as yield', async () => {
    model.enqueue(says('???'))
    expect((await play('hm')).at(-1)).toEqual({ type: 'done', reason: 'yield' })
  })

  it('gives the Director only the menu code built, in a non-streaming small call', async () => {
    model.enqueue(says('yield'))
    await play('I look')
    const [request] = model.requests
    expect(request.messages[0].content).toContain('narrate:')
    expect(request.messages[0].content).toContain('yield:')
    expect(request.maxTokens).toBeLessThanOrEqual(64)
  })

  it('discards the in-flight narration and keeps the log when the model fails', async () => {
    model.enqueue(says('narrate'), fails)
    const events = await play('I look')
    expect(types(events).slice(-2)).toEqual(['discard', 'done:error'])
    expect(log()).toEqual(['player:player-action:I look'])
  })

  it('discards the in-flight narration and keeps the log when the player presses Stop', async () => {
    const controller = new AbortController()
    model.enqueue(says('narrate'), hangsAfter('Half '))
    const runner = createSceneRunner({
      sessions,
      port: model.port,
      pipeline: createDirectorPipeline()
    })
    const result = runner.begin(sessionId, 'I look', controller.signal)
    if (!result.ok) throw new Error('refused')
    const seen: PipelineEvent[] = []
    for await (const e of result.events) {
      seen.push(e)
      if (e.type === 'delta') controller.abort()
    }
    expect(types(seen).slice(-2)).toEqual(['discard', 'done:stopped'])
    expect(log()).toEqual(['player:player-action:I look'])
  })

  it('reports an error when the Director call fails', async () => {
    model.enqueue(fails)
    const events = await play('I look')
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' })
    expect(log()).toEqual(['player:player-action:I look'])
  })
})
