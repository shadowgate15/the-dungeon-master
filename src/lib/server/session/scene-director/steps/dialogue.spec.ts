import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../../testing/scripted-chat-port'
import { addNpc, playableCampaign, sessionServiceWith, setSceneNpcs } from '../../fixture'
import { createSceneRunner, type PipelineEvent } from '../../scene-runner.ts'
import type { SessionService } from '../../service'
import { buildMenu } from '../menu.ts'
import { MENU_OPTIONS } from '../options.ts'
import { createDirectorPipeline } from '../pipeline.ts'

let sessions: SessionService
let sessionId: string
let mira: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(async () => {
  const fixture = playableCampaign()
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
  mira = addNpc(fixture, {
    name: 'Mira',
    stance: 'friendly',
    note: 'The key is under the altar.'
  })
  setSceneNpcs(fixture, sessionId, [mira])
})

const menuIds = () =>
  buildMenu(MENU_OPTIONS, {
    scene: sessions.scene(sessionId),
    events: sessions.events(sessionId)
  })
    .map((m) => m.id)
    .filter((id) => id.includes('dialogue'))

async function play(text: string) {
  const runner = createSceneRunner({
    sessions,
    port: model.port,
    pipeline: createDirectorPipeline()
  })
  const result = runner.begin(sessionId, text, new AbortController().signal)
  if (!result.ok) throw new Error(result.reason)
  const events: PipelineEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

describe('dialogue menu options', () => {
  it('offers begin-dialogue per NPC present, and only in exploration', () => {
    expect(menuIds()).toEqual(['begin-dialogue:mira'])
  })

  it('offers end-dialogue, and no begin-dialogue, while in dialogue', () => {
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      mode: 'dialogue',
      dialogueNpcId: mira
    })
    expect(menuIds()).toEqual(['end-dialogue'])
  })

  it('offers begin-dialogue for nobody when no NPC is present', () => {
    sessions.saveScene(sessionId, { ...sessions.scene(sessionId), npcs: [] })
    expect(menuIds()).toEqual([])
  })
})

describe('mode transitions', () => {
  it('begins dialogue: code saves the scene and logs a mode-changed event', async () => {
    model.enqueue(says('begin-dialogue:mira'), says('yield'))
    const events = await play('I approach Mira')

    expect(sessions.scene(sessionId)).toMatchObject({ mode: 'dialogue', dialogueNpcId: mira })
    expect(sessions.events(sessionId).at(-1)).toMatchObject({
      role: 'code',
      kind: 'mode-changed',
      npcId: mira,
      data: { mode: 'dialogue', npcId: mira }
    })
    expect(events.some((e) => e.type === 'event' && e.event.kind === 'mode-changed')).toBe(true)
  })

  it('ends dialogue and returns to exploration, clearing the NPC', async () => {
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      mode: 'dialogue',
      dialogueNpcId: mira
    })
    model.enqueue(says('end-dialogue'), says('yield'))
    await play('Farewell')

    expect(sessions.scene(sessionId)).toMatchObject({ mode: 'exploration', dialogueNpcId: null })
    expect(sessions.events(sessionId).at(-1)).toMatchObject({
      role: 'code',
      kind: 'mode-changed',
      data: { mode: 'exploration', npcId: null }
    })
  })

  it('does not begin dialogue with an NPC who is not present', async () => {
    model.enqueue(says('begin-dialogue:borg'), says('yield'))
    await play('I look for Borg')
    expect(sessions.scene(sessionId).mode).toBe('exploration')
  })
})
