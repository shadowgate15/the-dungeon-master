import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { place, sessionScene } from '../db/schema'
import {
  answers,
  createScriptedPort,
  fails,
  hangsAfter,
  says
} from '../../testing/scripted-chat-port'
import { effect, happens, impossible, rules } from '../../testing/exchange-scripts'
import { playableCampaign, sessionServiceWith, updateNpc } from './fixture'
import {
  createSceneRunner,
  type BeginResult,
  type ExchangeEvent,
  type SceneRunner
} from './scene-runner.ts'
import { createSessionService, type SessionService } from './service'

let db: Database
let sessions: SessionService
let sessionId: string
let model: ReturnType<typeof createScriptedPort>
let fixture: ReturnType<typeof playableCampaign>

beforeEach(async () => {
  fixture = playableCampaign()
  db = fixture.db
  sessions = sessionServiceWith(fixture).sessions
  sessionId = (await sessions.start(fixture.campaignId)).id
  model = createScriptedPort()
})

const runner = (): SceneRunner => createSceneRunner({ sessions, port: model.port })

async function drain(result: BeginResult) {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  const events: ExchangeEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const play = (text: string, using = runner()) =>
  drain(using.begin(sessionId, text, new AbortController().signal))

const log = () => sessions.events(sessionId).map((e) => `${e.role}:${e.kind}:${e.text}`)
const done = (events: ExchangeEvent[]) => events.at(-1)

describe('a Declaration that happens with no Effect', () => {
  it('is saved, ruled, and always gets a Reply from the Narrator', async () => {
    model.enqueue(happens(), effect({ effect: 'none' }), says('The hearth ', 'crackles.'))

    const events = await play('I warm my hands')

    expect(log()).toEqual([
      'player:declaration:I warm my hands',
      'narrator:narration:The hearth crackles.'
    ])
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text)).toEqual([
      'The hearth ',
      'crackles.'
    ])
    expect(events.find((e) => e.type === 'ruling')).toEqual({
      type: 'ruling',
      adjudication: { outcome: 'happens' },
      effect: { effect: 'none' }
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
    expect(sessions.scene(sessionId).location.name).toBe('The Gilded Stag')
  })

  it('survives a reload: a fresh service sees the same log', async () => {
    model.enqueue(happens(), effect({ effect: 'none' }), says('Rain.'))
    await play('I look around')
    expect(
      createSessionService(db)
        .events(sessionId)
        .map((e) => e.text)
    ).toEqual(['I look around', 'Rain.'])
  })
})

describe('NPCs that no longer resolve', () => {
  it('are pruned from the stored Scene at the next Exchange, ending their dialogue', async () => {
    const stored = () =>
      db.select().from(sessionScene).where(eq(sessionScene.sessionId, sessionId)).get()!
    const [brenna, hob] = sessions.scene(sessionId).npcs
    sessions.saveScene(sessionId, {
      ...sessions.scene(sessionId),
      mode: 'dialogue',
      dialogueNpcId: hob.id
    })
    updateNpc(fixture, hob.id, { status: 'dead' })

    model.enqueue(happens(), effect({ effect: 'none' }), says('Quiet.'))
    await play('I look around')

    expect(stored()).toMatchObject({ npcs: [brenna.id], mode: 'exploration', dialogueNpcId: null })
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

describe('a move', () => {
  const places = () => fixture.db.select().from(place).all()
  const goDown = () =>
    model.enqueue(
      happens(),
      effect({ effect: 'move', exitId: 'cellar-stairs' }),
      answers(cellar),
      answers(cellarNpcs),
      says('Cold air rises.')
    )

  it('generates the destination the first time, changes the Scene, and is narrated', async () => {
    goDown()
    const events = await play('I go down the cellar stairs')

    const scene = sessions.scene(sessionId)
    expect(scene.location).toEqual({ name: 'The Damp Cellar', description: cellar.description })
    expect(scene.exits).toEqual([
      { id: 'tunnel-mouth', name: 'Tunnel mouth' },
      { id: 'back-to-the-gilded-stag', name: 'Back to The Gilded Stag' }
    ])
    expect(scene.npcs.map((n) => n.name)).toEqual(['Pip'])
    expect(log()).toEqual([
      'player:declaration:I go down the cellar stairs',
      'code:scene-changed:You go through: Cellar stairs. You are now at The Damp Cellar.',
      'narrator:narration:Cold air rises.'
    ])
    expect(events.find((e) => e.type === 'ruling')).toMatchObject({
      effect: { effect: 'move', exitId: 'cellar-stairs' }
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('tells the Reply about the move it narrates', async () => {
    goDown()
    await play('I go down the cellar stairs')
    const narrator = model.requests.at(-1)!
    expect(narrator.messages.map((m) => m.content).join('\n')).toContain(
      'went through Cellar stairs and is now at The Damp Cellar'
    )
  })

  it('returns to the same stored place instead of regenerating', async () => {
    goDown()
    await play('I go down the cellar stairs')
    const count = places().length

    model.enqueue(
      happens(),
      effect({ effect: 'move', exitId: 'back-to-the-gilded-stag' }),
      says('Up.')
    )
    await play('I go back up')
    model.enqueue(happens(), effect({ effect: 'move', exitId: 'cellar-stairs' }), says('Down.'))
    await play('I go down again')

    expect(sessions.scene(sessionId).location.name).toBe('The Damp Cellar')
    expect(places()).toHaveLength(count)
  })

  it('falls back to a bare place with a way back when generation fails', async () => {
    model.enqueue(
      happens(),
      effect({ effect: 'move', exitId: 'cellar-stairs' }),
      fails,
      says('Dark.')
    )
    await play('I go down the cellar stairs')
    const scene = sessions.scene(sessionId)
    expect(scene.location.name).toBe('Cellar stairs')
    expect(scene.exits.map((e) => e.name)).toEqual(['Back to The Gilded Stag'])
  })
})

describe('a conversation', () => {
  it('starts with talk, and the NPC voices the Reply', async () => {
    const [brenna] = sessions.scene(sessionId).npcs
    model.enqueue(
      happens(),
      effect({ effect: 'talk', npcId: brenna.id }),
      says('Welcome, ', 'traveller.')
    )

    const events = await play('I greet Brenna')

    expect(sessions.scene(sessionId)).toMatchObject({ mode: 'dialogue', dialogueNpcId: brenna.id })
    expect(log()).toEqual([
      'player:declaration:I greet Brenna',
      'code:mode-changed:Dialogue with Brenna',
      'npc:npc-line:Welcome, traveller.'
    ])
    const deltas = events.flatMap((e) => (e.type === 'delta' ? [e] : []))
    expect(deltas.map((d) => [d.role, d.kind, d.npcId])).toEqual([
      ['npc', 'npc-line', brenna.id],
      ['npc', 'npc-line', brenna.id]
    ])
  })

  it("gives the NPC's voice only that NPC's own data", async () => {
    const [brenna] = sessions.scene(sessionId).npcs
    model.enqueue(happens(), effect({ effect: 'talk', npcId: brenna.id }), says('Hello.'))
    await play('I greet Brenna')

    const voice = model.requests.at(-1)!
    const prompt = [...voice.systemPrompts, ...voice.messages.map((m) => m.content)].join('\n')
    expect(prompt).toContain('Knows who has been asking after travellers.')
    expect(prompt).not.toContain('Old Hob')
    expect(prompt).not.toContain('Saw lights on the north road.')
  })

  it('ends with end_talk, and the Narrator voices the Reply again', async () => {
    const scene = sessions.scene(sessionId)
    sessions.saveScene(sessionId, { ...scene, mode: 'dialogue', dialogueNpcId: scene.npcs[0].id })
    model.enqueue(happens(), effect({ effect: 'end_talk' }), says('Brenna turns away.'))

    await play('Goodbye')

    expect(sessions.scene(sessionId)).toMatchObject({ mode: 'exploration', dialogueNpcId: null })
    expect(log().slice(-2)).toEqual([
      'code:mode-changed:Dialogue ends',
      'narrator:narration:Brenna turns away.'
    ])
  })
})

describe('an impossible Declaration', () => {
  it('gets a Reply and no Effect: nothing is asked of Effect and nothing changes', async () => {
    model.enqueue(impossible(), says('The wall does not yield.'))
    const before = sessions.scene(sessionId)

    const events = await play('I walk through the wall')

    expect(model.requests).toHaveLength(2)
    expect(events.find((e) => e.type === 'ruling')).toEqual({
      type: 'ruling',
      adjudication: { outcome: 'impossible' },
      effect: null
    })
    expect(log()).toEqual([
      'player:declaration:I walk through the wall',
      'narrator:narration:The wall does not yield.'
    ])
    expect(sessions.scene(sessionId)).toEqual(before)
  })
})

describe('a Check or a question (until their own tickets)', () => {
  it('resolves as happens for now, while the ruling shows what the model said', async () => {
    model.enqueue(
      rules({ outcome: 'check', skill: 'athletics', difficulty: 'hard' }),
      effect({ effect: 'none' }),
      says('You heave the door open.')
    )
    const events = await play('I force the door')
    expect(events.find((e) => e.type === 'ruling')).toEqual({
      type: 'ruling',
      adjudication: { outcome: 'check', skill: 'athletics', difficulty: 'hard' },
      effect: { effect: 'none' }
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })
})

describe('the inspector stream', () => {
  it('shows each step thinking and counts its requests', async () => {
    model.enqueue(happens(), effect({ effect: 'none' }), says('Rain.'))
    const events = await play('I wait')
    expect(events.flatMap((e) => (e.type === 'thinking' ? [e.step] : []))).toEqual([
      'adjudication',
      'effect',
      'reply'
    ])
    const last = events.findLast((e) => e.type === 'stats')
    expect(last?.type === 'stats' && last.stats.steps).toEqual({
      adjudication: { requests: 1 },
      effect: { requests: 1 },
      reply: { requests: 1 }
    })
  })
})

describe('a stopped or failed Exchange', () => {
  it('discards a stopped Reply, saves nothing more, and ends stopped', async () => {
    const controller = new AbortController()
    model.enqueue(happens(), effect({ effect: 'none' }), hangsAfter('The door '))
    const result = runner().begin(sessionId, 'I wait', controller.signal)
    if (!result.ok) throw new Error(result.reason)

    const events: ExchangeEvent[] = []
    for await (const e of result.events) {
      events.push(e)
      if (e.type === 'delta') controller.abort()
    }

    const tail = events.filter((e) => e.type !== 'stats').slice(-2)
    expect(tail).toEqual([{ type: 'discard' }, { type: 'done', reason: 'stopped' }])
    expect(log()).toEqual(['player:declaration:I wait'])
  })

  it('ends with an error when a step fails, keeping the Declaration', async () => {
    model.enqueue(fails)
    const events = await play('I wait')
    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
    expect(log()).toEqual(['player:declaration:I wait'])
  })

  it('ends with an error on an invalid Adjudication answer', async () => {
    model.enqueue(answers({ outcome: 'maybe' }))
    const events = await play('I wait')
    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
  })
})

describe('refusals', () => {
  it('refuses an unknown Session, an ended one and an empty Declaration', () => {
    const using = runner()
    const signal = new AbortController().signal
    expect(using.begin('nope', 'hi', signal)).toEqual({ ok: false, reason: 'not-found' })
    expect(using.begin(sessionId, '   ', signal)).toEqual({ ok: false, reason: 'empty-action' })
    sessions.end(sessionId)
    expect(using.begin(sessionId, 'hi', signal)).toEqual({ ok: false, reason: 'ended' })
    expect(log()).toEqual([])
  })

  it('refuses a second Declaration while an Exchange is in flight, then accepts one after', async () => {
    const using = runner()
    model.enqueue(happens(), effect({ effect: 'none' }), says('Rain.'))
    const first = using.begin(sessionId, 'I wait', new AbortController().signal)

    expect(using.begin(sessionId, 'I wait again', new AbortController().signal)).toEqual({
      ok: false,
      reason: 'in-flight'
    })
    await drain(first)

    model.enqueue(happens(), effect({ effect: 'none' }), says('More rain.'))
    expect(done(await play('I wait again', using))).toEqual({ type: 'done', reason: 'replied' })
  })

  it('releases the claim when a stream nobody reads is aborted', () => {
    const using = runner()
    const controller = new AbortController()
    expect(using.begin(sessionId, 'I wait', controller.signal).ok).toBe(true)
    controller.abort()
    expect(using.begin(sessionId, 'again', new AbortController().signal).ok).toBe(true)
  })
})
