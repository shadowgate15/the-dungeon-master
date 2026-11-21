import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/connect'
import type { MemoryExtraction } from '../memory/extraction.ts'
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
  type AnswerResult,
  type BeginResult,
  type ExchangeEvent,
  type SceneRunner,
  type SceneRunnerDeps
} from './scene-runner.ts'
import { createDice } from '../dice.ts'
import { createCheckModifier } from './check-modifier.ts'
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

const runner = ({ seed = 1, ...deps }: { seed?: number } & Partial<SceneRunnerDeps> = {}) =>
  createSceneRunner({
    sessions,
    port: model.port,
    dice: createDice(seed),
    checkModifier: createCheckModifier(db),
    ...deps
  })

async function drain(result: BeginResult | AnswerResult) {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  const events: ExchangeEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const play = (text: string, using = runner()) =>
  drain(using.begin(sessionId, text, new AbortController().signal))

const roll = (using: SceneRunner) =>
  drain(using.answerCall(sessionId, { kind: 'roll' }, new AbortController().signal))

const answeredData = () =>
  sessions.events(sessionId).findLast((e) => e.kind === 'call-answered')?.data

const climb = () => rules({ outcome: 'check', skill: 'athletics', difficulty: 'hard' })

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

describe('a Check', () => {
  // A human Fighter: athletics +5 (proficient), constitution save +4 (proficient).
  // Seed 4 rolls a 19 first; seed 7 rolls a 1.

  it('raises a Call that pauses the Exchange, then a roll that succeeds applies its Effect', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(climb())
    const raised = await play('I vault down the cellar stairs', using)

    expect(done(raised)).toEqual({ type: 'done', reason: 'call' })
    expect(sessions.scene(sessionId).openCall).toMatchObject({ kind: 'check', skill: 'athletics' })

    model.enqueue(
      effect({ effect: 'move', exitId: 'cellar-stairs' }),
      answers(cellar),
      answers(cellarNpcs),
      says('You land in the cold dark.')
    )
    const answered = await roll(using)

    expect(log()).toEqual([
      'player:declaration:I vault down the cellar stairs',
      'code:call-raised:Athletics check: I vault down the cellar stairs',
      'code:call-answered:Athletics: 19 + 5 = 24, success',
      'code:scene-changed:You go through: Cellar stairs. You are now at The Damp Cellar.',
      'narrator:narration:You land in the cold dark.'
    ])
    expect(answeredData()).toMatchObject({ die: 19, modifier: 5, total: 24, success: true })
    expect(sessions.scene(sessionId)).toMatchObject({
      location: { name: 'The Damp Cellar' },
      openCall: null
    })
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('that fails gets a Reply narrating the failure, and no Effect', async () => {
    const using = runner({ seed: 7 })
    model.enqueue(climb())
    await play('I vault down the cellar stairs', using)
    const before = sessions.scene(sessionId)

    model.enqueue(says('You slip and land hard on the top step.'))
    const answered = await roll(using)

    expect(model.requests).toHaveLength(2)
    expect(model.requests[1].messages.map((m) => m.content).join('\n')).toContain('fails')
    expect(log().slice(-2)).toEqual([
      'code:call-answered:Athletics: 1 + 5 = 6, failure',
      'narrator:narration:You slip and land hard on the top step.'
    ])
    expect(answeredData()).toMatchObject({ die: 1, modifier: 5, total: 6, success: false })
    expect(sessions.scene(sessionId)).toEqual({ ...before, openCall: null })
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('maps the difficulty to the DC: a 19 + 5 fails a very hard Check', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(rules({ outcome: 'check', skill: 'athletics', difficulty: 'very_hard' }))
    await play('I leap the chasm', using)
    model.enqueue(says('Not quite.'))
    await roll(using)
    expect(answeredData()).toMatchObject({ total: 24, success: false })
  })

  it('rolls a save with the save modifier', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(rules({ outcome: 'check', skill: 'constitution_save', difficulty: 'easy' }))
    await play('I drink the bitter draught', using)
    model.enqueue(effect({ effect: 'none' }), says('You keep it down.'))
    await roll(using)
    expect(log()).toContain('code:call-answered:Constitution save: 19 + 4 = 23, success')
  })

  it('is withdrawn by a new Declaration, which starts a new Exchange', async () => {
    const using = runner()
    model.enqueue(climb())
    await play('I vault down the cellar stairs', using)

    model.enqueue(happens(), effect({ effect: 'none' }), says('You sit by the fire instead.'))
    const events = await play('Never mind, I sit by the fire', using)

    expect(log()).toEqual([
      'player:declaration:I vault down the cellar stairs',
      'code:call-raised:Athletics check: I vault down the cellar stairs',
      'code:call-answered:Athletics check withdrawn',
      'player:declaration:Never mind, I sit by the fire',
      'narrator:narration:You sit by the fire instead.'
    ])
    expect(answeredData()).toMatchObject({ withdrawn: true })
    expect(sessions.scene(sessionId).openCall).toBeNull()
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('stays open across a reload: a new runner instance can roll it', async () => {
    model.enqueue(climb())
    await play('I vault down the cellar stairs')

    const reloaded = createSessionService(db)
    expect(reloaded.scene(sessionId).openCall).toMatchObject({ kind: 'check', skill: 'athletics' })
    model.enqueue(effect({ effect: 'none' }), says('Down you go.'))
    const answered = await drain(
      runner({ seed: 4, sessions: reloaded }).answerCall(
        sessionId,
        { kind: 'roll' },
        new AbortController().signal
      )
    )
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('runs no background jobs while it is open, and runs them once the Exchange replies', async () => {
    const trigger = vi.fn(() => Promise.resolve())
    const using = runner({ seed: 4, memory: { trigger } as unknown as MemoryExtraction })
    model.enqueue(climb())
    await play('I vault down the cellar stairs', using)
    await using.settled()
    expect(trigger).not.toHaveBeenCalled()

    model.enqueue(effect({ effect: 'none' }), says('Down.'))
    await roll(using)
    await using.settled()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('never sends the DC to the client, in streamed events or chunks', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(climb())
    const raised = await play('I vault down the cellar stairs', using)
    model.enqueue(effect({ effect: 'none' }), says('Down.'))
    const answered = await roll(using)
    model.enqueue(rules({ outcome: 'check', skill: 'stealth', difficulty: 'medium' }))
    const again = await play('I sneak past', using)
    model.enqueue(happens(), effect({ effect: 'none' }), says('Fine.'))
    const withdrawn = await play('I stand up', using)

    for (const events of [raised, answered, again, withdrawn]) {
      const sent = JSON.stringify(events)
      expect(sent).not.toMatch(/"dc"/)
      expect(sent).not.toMatch(/\bDC\b/)
    }
    // The DC is still kept server-side.
    expect(sessions.events(sessionId).find((e) => e.kind === 'call-raised')?.data).toMatchObject({
      dc: 20
    })
  })
})

describe('the inspector stream', () => {
  it('shows each step thinking, and counts its requests and latency', async () => {
    model.enqueue(happens(), effect({ effect: 'none' }), says('Rain.'))
    const events = await play('I wait')
    expect(events.flatMap((e) => (e.type === 'thinking' ? [e.step] : []))).toEqual([
      'adjudication',
      'effect',
      'reply'
    ])
    const last = events.findLast((e) => e.type === 'stats')
    const once = { requests: 1, retries: 0, defaults: 0, latencyMs: expect.any(Number) }
    expect(last?.type === 'stats' && last.stats.steps).toEqual({
      adjudication: once,
      effect: once,
      reply: once
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
})

describe('a bad model answer', () => {
  const invalid = () => answers({ outcome: 'maybe' })
  const lastStats = (events: ExchangeEvent[]) => {
    const last = events.findLast((e) => e.type === 'stats')
    return last?.type === 'stats' ? last.stats : undefined
  }

  it('retries an invalid Adjudication answer once and goes on with the valid one', async () => {
    model.enqueue(invalid(), impossible(), says('The wall does not yield.'))

    const events = await play('I walk through the wall')

    expect(events.find((e) => e.type === 'ruling')).toMatchObject({
      adjudication: { outcome: 'impossible' },
      effect: null
    })
    expect(log()).toEqual([
      'player:declaration:I walk through the wall',
      'narrator:narration:The wall does not yield.'
    ])
    expect(lastStats(events)?.steps.adjudication).toMatchObject({
      requests: 2,
      retries: 1,
      defaults: 0
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('defaults an Adjudication invalid twice to happens with Effect none, and still replies', async () => {
    model.enqueue(invalid(), invalid(), says('You wait.'))

    const events = await play('I wait')

    expect(events.find((e) => e.type === 'ruling')).toEqual({
      type: 'ruling',
      adjudication: { outcome: 'happens' },
      effect: { effect: 'none' }
    })
    expect(log()).toEqual(['player:declaration:I wait', 'narrator:narration:You wait.'])
    expect(model.requests).toHaveLength(3)
    expect(lastStats(events)?.steps.adjudication).toMatchObject({
      requests: 2,
      retries: 1,
      defaults: 1
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('defaults an Effect invalid twice to none, so nothing changes but the Reply', async () => {
    const before = sessions.scene(sessionId)
    model.enqueue(
      happens(),
      effect({ effect: 'move', exitId: 'nowhere' }),
      answers({ effect: 'fly' }),
      says('You stay put.')
    )

    const events = await play('I go somewhere')

    expect(events.find((e) => e.type === 'ruling')).toMatchObject({ effect: { effect: 'none' } })
    expect(log()).toEqual(['player:declaration:I go somewhere', 'narrator:narration:You stay put.'])
    expect(sessions.scene(sessionId)).toEqual(before)
    expect(lastStats(events)?.steps.effect).toMatchObject({
      requests: 2,
      retries: 1,
      defaults: 1
    })
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('does not retry a model error', async () => {
    model.enqueue(fails, says('never'))
    const events = await play('I wait')
    expect(model.requests).toHaveLength(1)
    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
  })
})

describe('a model error mid-Exchange', () => {
  it('ends with error, keeps the Declaration and leaves the Scene as it was', async () => {
    const before = sessions.scene(sessionId)
    model.enqueue(
      happens(),
      effect({ effect: 'move', exitId: 'cellar-stairs' }),
      answers(cellar),
      answers(cellarNpcs),
      fails
    )

    const events = await play('I go down the cellar stairs')

    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
    expect(sessions.scene(sessionId)).toEqual(before)
    expect(createSessionService(db).scene(sessionId)).toEqual(before)
    expect(log()).toEqual(['player:declaration:I go down the cellar stairs'])
  })

  it('leaves an open Call as it was when the Declaration that withdraws it fails', async () => {
    model.enqueue(climb())
    await play('I climb the wall')
    const before = sessions.scene(sessionId)
    const logged = log()

    model.enqueue(fails)
    const events = await play('I walk away instead')

    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
    expect(sessions.scene(sessionId)).toEqual(before)
    expect(sessions.scene(sessionId).openCall).toMatchObject({ skill: 'athletics' })
    expect(log()).toEqual(logged)
  })

  it('reopens the Call when the Exchange after its roll fails, so it can be rolled again', async () => {
    model.enqueue(climb())
    await play('I climb the wall')
    const before = sessions.scene(sessionId)
    const logged = log()

    model.enqueue(fails)
    const events = await roll(runner({ seed: 4 }))

    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
    expect(sessions.scene(sessionId)).toEqual(before)
    expect(log()).toEqual(logged)
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

  it('refuses to answer when no Call is open, an unknown Session and an ended one', () => {
    const using = runner()
    const signal = new AbortController().signal
    expect(using.answerCall(sessionId, { kind: 'roll' }, signal)).toEqual({
      ok: false,
      reason: 'no-open-call'
    })
    expect(using.answerCall('nope', { kind: 'roll' }, signal)).toEqual({
      ok: false,
      reason: 'not-found'
    })
    sessions.end(sessionId)
    expect(using.answerCall(sessionId, { kind: 'roll' }, signal)).toEqual({
      ok: false,
      reason: 'ended'
    })
    expect(log()).toEqual([])
  })

  it('refuses to answer while an Exchange is in flight', async () => {
    const using = runner()
    model.enqueue(climb())
    await play('I climb', using)
    model.enqueue(happens(), effect({ effect: 'none' }), says('Rain.'))
    const busy = using.begin(sessionId, 'I wait', new AbortController().signal)
    expect(using.answerCall(sessionId, { kind: 'roll' }, new AbortController().signal)).toEqual({
      ok: false,
      reason: 'in-flight'
    })
    await drain(busy)
  })

  it('releases the claim when a stream nobody reads is aborted', () => {
    const using = runner()
    const controller = new AbortController()
    expect(using.begin(sessionId, 'I wait', controller.signal).ok).toBe(true)
    controller.abort()
    expect(using.begin(sessionId, 'again', new AbortController().signal).ok).toBe(true)
  })
})
