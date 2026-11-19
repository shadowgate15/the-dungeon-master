import { count, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { answers, fails } from '../../testing/scripted-chat-port'
import { createArcService } from '../arc/service'
import { disposition, npc, place, placeExit, session, sessionScene } from '../db/schema'
import {
  acceptArc,
  firstSceneAnswers as ok,
  firstSceneScripts,
  playableCampaign,
  sessionServiceWith,
  type PlayableCampaign
} from './fixture'
import { SessionStartError, SessionValidationError } from './service'

let fixture: PlayableCampaign
beforeEach(() => {
  fixture = playableCampaign()
})

const rows = (f: PlayableCampaign) => ({
  sessions: f.db.select({ n: count() }).from(session).get()!.n,
  scenes: f.db.select({ n: count() }).from(sessionScene).get()!.n,
  places: f.db.select({ n: count() }).from(place).get()!.n,
  exits: f.db.select({ n: count() }).from(placeExit).get()!.n,
  npcs: f.db.select({ n: count() }).from(npc).get()!.n,
  dispositions: f.db.select({ n: count() }).from(disposition).get()!.n
})
const NOTHING = { sessions: 0, scenes: 0, places: 0, exits: 0, npcs: 0, dispositions: 0 }

describe('the first Session of a Campaign', () => {
  it('opens in a generated place with exits, objects and NPCs, written as World memory', async () => {
    const { sessions } = sessionServiceWith(fixture)

    const started = await sessions.start(fixture.campaignId)

    const scene = sessions.scene(started.id)
    expect(scene.location).toEqual({ name: ok.place.name, description: ok.place.description })
    expect(scene.exits).toEqual([
      { id: 'front-door', name: 'Front door' },
      { id: 'cellar-stairs', name: 'Cellar stairs' }
    ])
    expect(scene.objects).toEqual(ok.place.objects)
    expect(scene.npcs.map((n) => [n.name, n.attitude, n.knowledge])).toEqual([
      ['Brenna', 'friendly', 'Knows who has been asking after travellers.'],
      ['Old Hob', 'wary', 'Saw lights on the north road.']
    ])
    expect(sessions.events(started.id)).toEqual([])

    const [p] = fixture.db.select().from(place).all()
    expect(p).toMatchObject({
      campaignId: fixture.campaignId,
      name: ok.place.name,
      createdSessionId: started.id,
      createdSeq: null,
      changedSeq: null
    })
    expect(
      fixture.db.select().from(placeExit).where(eq(placeExit.placeId, p.id)).all()
    ).toHaveLength(2)
    const npcs = fixture.db.select().from(npc).all()
    expect(npcs.map((n) => [n.name, n.placeId, n.createdSeq, n.status])).toEqual([
      ['Brenna', p.id, null, 'alive'],
      ['Old Hob', p.id, null, 'alive']
    ])
    expect(scene.npcs.map((n) => n.id)).toEqual(npcs.map((n) => n.id))
    expect(scene.npcs.map((n) => n.key)).toEqual(['brenna', 'old-hob'])
    expect(
      fixture.db
        .select()
        .from(disposition)
        .all()
        .map((d) => [d.characterId, d.stance, d.changedSeq])
    ).toEqual([
      [fixture.characterId, 'friendly', null],
      [fixture.characterId, 'wary', null]
    ])
  })

  it('tells the model the Seed, Worlds, first Act, Beats and Character, stage by stage', async () => {
    const { sessions, model } = sessionServiceWith(fixture)
    await sessions.start(fixture.campaignId)

    const prompts = model.requests.map((r) => r.systemPrompts.join('\n'))
    expect(model.requests).toHaveLength(3)
    expect(prompts[0]).toContain('Eldoria')
    expect(prompts[0]).toContain('Setup')
    expect(prompts[0]).toContain('A stranger arrives')
    expect(prompts[0]).toContain('Rowan')
    expect(prompts[1]).toContain(ok.situation.situation)
    expect(prompts[2]).toContain(ok.place.name)
  })

  it('retries a stage once, naming the problem', async () => {
    const { sessions, model } = sessionServiceWith(fixture, [
      answers(ok.situation),
      answers({ ...ok.place, exits: ['Front door'] }),
      answers(ok.place),
      answers(ok.npcs)
    ])

    const started = await sessions.start(fixture.campaignId)

    expect(sessions.scene(started.id).exits).toHaveLength(2)
    expect(model.requests).toHaveLength(4)
    expect(model.requests[2].messages.at(-1)!.content).toMatch(/at least 2 exits/)
  })

  it('drops over-cap and duplicate items and keeps the rest', async () => {
    const { sessions } = sessionServiceWith(fixture, [
      answers(ok.situation),
      answers({
        ...ok.place,
        exits: [
          'Front door',
          'front  DOOR',
          'Cellar stairs',
          'Back lane',
          'Roof hatch',
          'Sewer grate'
        ],
        objects: ['A', 'B', 'C', 'D', 'E', 'F', 'a']
      }),
      answers({
        npcs: [
          ok.npcs.npcs[0],
          { ...ok.npcs.npcs[0], name: 'BRENNA' },
          { ...ok.npcs.npcs[1], attitude: 'furious' },
          { ...ok.npcs.npcs[1], name: 'Cob' },
          { ...ok.npcs.npcs[1], name: 'Dunn' },
          { ...ok.npcs.npcs[1], name: 'Edda' }
        ]
      })
    ])

    const started = await sessions.start(fixture.campaignId)
    const scene = sessions.scene(started.id)

    expect(scene.exits.map((e) => e.name)).toEqual([
      'Front door',
      'Cellar stairs',
      'Back lane',
      'Roof hatch'
    ])
    expect(scene.objects).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(scene.npcs.map((n) => n.name)).toEqual(['Brenna', 'Cob', 'Dunn'])
  })

  it('allows a place with no NPCs', async () => {
    const { sessions } = sessionServiceWith(fixture, [
      answers(ok.situation),
      answers(ok.place),
      answers({ npcs: [] })
    ])
    const started = await sessions.start(fixture.campaignId)
    expect(sessions.scene(started.id).npcs).toEqual([])
  })
})

describe('a failed First Scene', () => {
  it.each([
    ['the model errors', [answers(ok.situation), fails]],
    [
      'a stage stays unparseable after its retry',
      [answers(ok.situation), answers({ nope: 1 }), answers({ nope: 1 })]
    ],
    [
      'the place keeps too few exits',
      [
        answers(ok.situation),
        answers({ ...ok.place, exits: [] }),
        answers({ ...ok.place, exits: ['One'] })
      ]
    ],
    [
      'the NPC stage fails after the place succeeded',
      [
        answers(ok.situation),
        answers(ok.place),
        answers({ npcs: 'many' }),
        answers({ npcs: 'many' })
      ]
    ]
  ])('creates nothing when %s', async (_name, scripts) => {
    const { sessions } = sessionServiceWith(fixture, scripts)

    await expect(sessions.start(fixture.campaignId)).rejects.toThrow(SessionStartError)

    expect(rows(fixture)).toEqual(NOTHING)
    expect(sessions.openFor(fixture.campaignId)).toBeUndefined()
  })

  it('names the reason, and a Retry starts the Session', async () => {
    const { sessions, model } = sessionServiceWith(fixture, [answers(ok.situation), fails])
    await expect(sessions.start(fixture.campaignId)).rejects.toThrow(
      /opening Scene.*model fell over/
    )

    model.enqueue(...firstSceneScripts())
    const started = await sessions.start(fixture.campaignId)

    expect(sessions.openFor(fixture.campaignId)?.id).toBe(started.id)
    expect(rows(fixture)).toMatchObject({ sessions: 1, scenes: 1, places: 1, npcs: 2 })
  })

  it('has no fallback Scene when no model is available', async () => {
    const { sessions } = sessionServiceWith(fixture, [])
    await expect(sessions.start(fixture.campaignId)).rejects.toThrow(SessionStartError)
    expect(rows(fixture)).toEqual(NOTHING)
  })
})

describe('the Arc lock', () => {
  it('refuses a Session without an accepted Arc, and never calls the model', async () => {
    const bare = playableCampaign({ arc: false })
    const first = sessionServiceWith(bare)
    await expect(first.sessions.start(bare.campaignId)).rejects.toThrow(/Accept the Arc/)

    const draft = playableCampaign({ arc: false })
    acceptArc(draft.db, draft.campaignId, 'draft')
    const second = sessionServiceWith(draft)
    await expect(second.sessions.start(draft.campaignId)).rejects.toThrow(SessionValidationError)

    expect(first.model.requests).toEqual([])
    expect(second.model.requests).toEqual([])
  })

  it('makes the Arc read-only once the first Session exists', async () => {
    const arcs = createArcService(fixture.db)
    expect(arcs.availability(fixture.campaignId)).toEqual({ canGenerate: true, locked: false })
    const view = arcs.get(fixture.campaignId)!

    await sessionServiceWith(fixture).sessions.start(fixture.campaignId)

    expect(arcs.availability(fixture.campaignId)).toEqual({ canGenerate: false, locked: true })
    expect(() => arcs.save(fixture.campaignId, view)).toThrow(/read-only/)
    expect(() =>
      arcs.replaceWithDraft(fixture.campaignId, {
        title: 'x',
        premise: 'x',
        stakes: 'x',
        resolution: 'x',
        acts: []
      })
    ).toThrow(/read-only/)
  })
})

describe('later Sessions', () => {
  it('open where the previous Session ended, with no model call', async () => {
    const { sessions, model } = sessionServiceWith(fixture)
    const first = await sessions.start(fixture.campaignId)
    sessions.saveScene(first.id, { ...sessions.scene(first.id), objects: ['Changed'] })
    sessions.end(first.id)
    const before = model.requests.length

    const second = await sessions.start(fixture.campaignId)

    expect(sessions.scene(second.id)).toEqual(sessions.scene(first.id))
    expect(model.requests).toHaveLength(before)
    expect(rows(fixture)).toMatchObject({ sessions: 2, places: 1 })
  })
})
