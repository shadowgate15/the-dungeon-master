import { beforeEach, describe, expect, it } from 'vitest'
import { answers, createScriptedPort, fails, says } from '../../../../testing/scripted-chat-port'
import { place, placeExit } from '../../../db/schema'
import { playableCampaign, sessionServiceWith } from '../../fixture'
import { createSceneRunner, type PipelineEvent } from '../../scene-runner.ts'
import type { SessionService } from '../../service'
import { buildMenu } from '../menu.ts'
import { MENU_OPTIONS } from '../options.ts'
import { createDirectorPipeline } from '../pipeline.ts'

let fixture: ReturnType<typeof playableCampaign>
let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>

beforeEach(async () => {
  fixture = playableCampaign()
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
    model.enqueue(says('move:front-door'), fails, says('yield'))

    const events = await play('I leave through the front door')

    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('Front door')
    expect(scene.exits.map((e) => e.id)).toEqual(['back-to-the-gilded-stag'])
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
    model.enqueue(says('move:tunnel'), fails, says('yield'))

    await play('I crawl into the tunnel')

    const after = sessions.scene(sessionId)
    expect(after.location.name).toBe('A narrow tunnel')
    expect(after.exits).toEqual([
      { id: 'back-to-the-gilded-stag', name: 'Back to The Gilded Stag' }
    ])
  })
})

const cellar = {
  name: 'The Damp Cellar',
  description: 'Barrels sweat in the cold dark beneath the inn.',
  exits: ['Tunnel mouth'],
  objects: ['A cracked barrel']
}
const cellarNpcs = {
  npcs: [
    {
      name: 'Pip',
      description: 'A nervous cellar boy.',
      role: 'Cellar hand',
      attitude: 'wary',
      knowledge: 'Heard scratching in the walls.'
    }
  ]
}

describe('first move through an exit generates the destination', () => {
  const places = () => fixture.db.select().from(place).all()

  it('stores a new place with a way back, links the exit, and puts its NPCs in the scene', async () => {
    model.enqueue(says('move:cellar-stairs'), answers(cellar), answers(cellarNpcs), says('yield'))

    await play('I go down the cellar stairs')

    const scene = sessions.scene(sessionId)
    expect(scene.location).toEqual({ name: 'The Damp Cellar', description: cellar.description })
    expect(scene.exits).toEqual([
      { id: 'tunnel-mouth', name: 'Tunnel mouth' },
      { id: 'back-to-the-gilded-stag', name: 'Back to The Gilded Stag' }
    ])
    expect(scene.objects).toEqual(['A cracked barrel'])
    expect(scene.npcs.map((n) => [n.name, n.attitude])).toEqual([['Pip', 'wary']])
    const stored = places().find((p) => p.name === 'The Damp Cellar')!
    const origin = places().find((p) => p.name === 'The Gilded Stag')!
    const edges = fixture.db.select().from(placeExit).all()
    expect(edges.find((e) => e.placeId === origin.id && e.name === 'Cellar stairs')).toMatchObject({
      targetPlaceId: stored.id
    })
    expect(
      edges.find((e) => e.placeId === stored.id && e.name.startsWith('Back to'))
    ).toMatchObject({ targetPlaceId: origin.id })
  })

  it('tells the model the origin, the exit and the Act', async () => {
    model.enqueue(says('move:cellar-stairs'), answers(cellar), answers(cellarNpcs), says('yield'))
    await play('I go down the cellar stairs')
    const prompt = model.requests.map((r) => r.systemPrompts.join('\n')).join('\n')
    expect(prompt).toContain('Cellar stairs')
    expect(prompt).toContain('The Gilded Stag')
    expect(prompt).toContain('Setup')
    expect(prompt).toContain('Eldoria')
  })

  it('returns to the same stored place instead of regenerating', async () => {
    model.enqueue(says('move:cellar-stairs'), answers(cellar), answers(cellarNpcs), says('yield'))
    await play('I go down the cellar stairs')
    const count = places().length

    model.enqueue(says('move:back-to-the-gilded-stag'), says('yield'))
    await play('I go back up')
    expect(sessions.scene(sessionId).location.name).toBe('The Gilded Stag')

    model.enqueue(says('move:cellar-stairs'), says('yield'))
    await play('I go down again')
    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('The Damp Cellar')
    expect(scene.npcs.map((n) => n.name)).toEqual(['Pip'])
    expect(places()).toHaveLength(count)
  })

  it('falls back to a bare place with a way back when generation fails, and reuses it', async () => {
    model.enqueue(says('move:cellar-stairs'), fails, says('yield'))
    await play('I go down the cellar stairs')
    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('Cellar stairs')
    expect(scene.exits.map((e) => e.name)).toEqual(['Back to The Gilded Stag'])
    expect(places().map((p) => p.name)).toContain('Cellar stairs')

    model.enqueue(says('move:back-to-the-gilded-stag'), says('yield'))
    await play('back up')
    model.enqueue(says('move:cellar-stairs'), says('yield'))
    await play('down again')
    expect(sessions.scene(sessionId).location.name).toBe('Cellar stairs')
    expect(places().filter((p) => p.name === 'Cellar stairs')).toHaveLength(1)
  })

  it('keeps the place when only the NPC stage fails', async () => {
    model.enqueue(says('move:cellar-stairs'), answers(cellar), fails, says('yield'))
    await play('I go down the cellar stairs')
    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('The Damp Cellar')
    expect(scene.npcs).toEqual([])
  })
})
