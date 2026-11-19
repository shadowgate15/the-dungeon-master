import { beforeEach, describe, expect, it } from 'vitest'
import { createScriptedPort, says } from '../../../../testing/scripted-chat-port'
import { playableCampaign, sessionServiceWith } from '../../fixture'
import { createSceneRunner, type PipelineEvent } from '../../scene-runner.ts'
import type { SessionService } from '../../service'
import { buildMenu } from '../menu.ts'
import { MENU_OPTIONS } from '../options.ts'
import { createDirectorPipeline } from '../pipeline.ts'

let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(async () => {
  const fixture = playableCampaign()
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
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

// Other options (NPC voice, rolls) are covered in their own specs.
const ids = () =>
  menu()
    .map((m) => m.id)
    .filter(
      (id) => !id.startsWith('npc-speaks') && !id.startsWith('roll:') && !id.includes('dialogue')
    )

describe('moving through an exit', () => {
  it('offers one move option per existing exit after a player action', () => {
    sessions.appendEvent(sessionId, { role: 'player', kind: 'player-action', text: 'I wait' })
    expect(ids()).toEqual(['narrate', 'move:front-door', 'move:cellar-stairs', 'yield'])
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
    sessions.saveScene(sessionId, { ...scene, mode: 'dialogue', dialogueNpcId: scene.npcs[0].id })
    expect(ids()).toEqual(['narrate', 'yield'])
  })

  it('changes the scene and logs a scene-changed event for a valid exit', async () => {
    model.enqueue(says('move:front-door'), says('yield'))

    const events = await play('I leave through the front door')

    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('Front door')
    expect(scene.exits.map((e) => e.id)).toEqual(['back'])
    expect(scene.npcs).toEqual([])
    expect(scene.mode).toBe('exploration')
    const changed = sessions.events(sessionId).filter((e) => e.kind === 'scene-changed')
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatchObject({
      role: 'code',
      data: { exitId: 'front-door', from: 'The Gilded Stag', to: 'Front door' }
    })
    expect(events.some((e) => e.type === 'event' && e.event.kind === 'scene-changed')).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'yield' })
  })

  it('rejects an exit that does not exist like an invalid pick: no change, control returns', async () => {
    // An unknown exit is an unusable pick twice (retry), then the fallback narrates.
    model.enqueue(says('move:attic'), says('move:attic'), says('Rain.'), says('yield'))

    const events = await play('I climb to the attic')

    expect(sessions.scene(sessionId).location.name).toBe('The Gilded Stag')
    expect(sessions.events(sessionId).some((e) => e.kind === 'scene-changed')).toBe(false)
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'yield' })
  })

  it('uses a bare place named after the exit and offers a way back', async () => {
    const scene = sessions.scene(sessionId)
    sessions.saveScene(sessionId, {
      ...scene,
      exits: [{ id: 'tunnel', name: 'A narrow tunnel' }]
    })
    model.enqueue(says('move:tunnel'), says('yield'))

    await play('I crawl into the tunnel')

    const after = sessions.scene(sessionId)
    expect(after.location.name).toBe('A narrow tunnel')
    expect(after.exits).toEqual([{ id: 'back', name: 'Back to The Gilded Stag' }])
  })
})
