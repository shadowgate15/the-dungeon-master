import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../../testing/scripted-chat-port'
import { playableCampaign } from '../../fixture'
import { createSceneRunner, type PipelineEvent } from '../../scene-runner.ts'
import { createSessionService, type SessionService } from '../../service'
import { buildMenu } from '../menu.ts'
import { MENU_OPTIONS } from '../options.ts'
import { createDirectorPipeline } from '../pipeline.ts'

let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(() => {
  const fixture = playableCampaign()
  sessions = createSessionService(fixture.db)
  sessionId = sessions.start(fixture.campaignId).id
  model = createScriptedPort()
})

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

const menu = () =>
  buildMenu(MENU_OPTIONS, { scene: sessions.scene(sessionId), events: sessions.events(sessionId) })

describe('moving through an exit', () => {
  it('offers one move option per existing exit after a player action', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'I wait' })
    expect(menu().map((m) => m.id)).toEqual([
      'narrate',
      'move:front-door',
      'move:cellar-stairs',
      'yield'
    ])
  })

  it('points the Director at the exit the player names', () => {
    sessions.appendEvent(sessionId, {
      role: 'player',
      kind: 'player-action',
      text: 'I head down the cellar stairs'
    })
    const hints = Object.fromEntries(menu().map((m) => [m.id, m.hint]))
    expect(hints['move:cellar-stairs']).toContain("player's action")
    expect(hints['move:front-door']).not.toContain("player's action")
  })

  it('does not offer a move in dialogue', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'hi' })
    const scene = sessions.scene(sessionId)
    sessions.saveScene(sessionId, { ...scene, mode: 'dialogue', dialogueNpcId: 'marta' })
    expect(menu().map((m) => m.id)).toEqual(['narrate', 'yield'])
  })

  it('changes the scene and logs a scene-changed event for a valid exit', async () => {
    model.enqueue(says('move:front-door'), says('yield'))

    const events = await play('I leave through the front door')

    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('The Muddy Road')
    expect(scene.exits.map((e) => e.id)).toEqual(['inn-door'])
    expect(scene.npcs).toEqual([])
    expect(scene.mode).toBe('exploration')
    const changed = sessions.events(sessionId).filter((e) => e.kind === 'scene-changed')
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatchObject({
      role: 'code',
      data: { exitId: 'front-door', from: 'The Sleeping Griffin', to: 'The Muddy Road' }
    })
    expect(events.some((e) => e.type === 'event' && e.event.kind === 'scene-changed')).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'yield' })
  })

  it('rejects an exit that does not exist like an invalid pick: no change, control returns', async () => {
    model.enqueue(says('move:attic'))

    const events = await play('I climb to the attic')

    expect(sessions.scene(sessionId).location.name).toBe('The Sleeping Griffin')
    expect(sessions.events(sessionId).some((e) => e.kind === 'scene-changed')).toBe(false)
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'yield' })
  })

  it('uses a generic place for an exit with no known destination and offers a way back', async () => {
    const scene = sessions.scene(sessionId)
    sessions.saveScene(sessionId, {
      ...scene,
      exits: [{ id: 'tunnel', name: 'A narrow tunnel' }]
    })
    model.enqueue(says('move:tunnel'), says('yield'))

    await play('I crawl into the tunnel')

    const after = sessions.scene(sessionId)
    expect(after.location.name).toBe('A narrow tunnel')
    expect(after.exits).toEqual([{ id: 'back', name: 'Back to The Sleeping Griffin' }])
  })
})
