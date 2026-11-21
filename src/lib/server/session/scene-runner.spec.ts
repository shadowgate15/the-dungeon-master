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
import type { CallAnswer, CarriedEffect } from '#lib/session/call.ts'
import { asks, effect, happens, impossible, rules } from '../../testing/exchange-scripts'
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
import { EFFECT_SYSTEM } from './exchange/contract.ts'
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

describe('a clarifying question', () => {
  const which = () => asks('Which way do you go?', ['The front door', 'The cellar stairs'])
  const answer = (a: CallAnswer, using = runner()) =>
    drain(using.answerCall(sessionId, a, new AbortController().signal))
  /** Everything a model request was sent, as one string. */
  const request = (index: number) =>
    model.requests
      .at(index)!
      .messages.map((m) => m.content)
      .join('\n')

  it('raises a Call holding the question, then a chosen choice is ruled again and gets a Reply', async () => {
    model.enqueue(which())
    const raised = await play('I leave')

    expect(done(raised)).toEqual({ type: 'done', reason: 'call' })
    expect(raised.some((e) => e.type === 'delta')).toBe(false)
    expect(sessions.scene(sessionId).openCall).toEqual({
      kind: 'question',
      question: 'Which way do you go?',
      choices: ['The front door', 'The cellar stairs'],
      declaration: { seq: 1, text: 'I leave' },
      history: []
    })

    model.enqueue(happens(), effect({ effect: 'none' }), says('You step out into the rain.'))
    const answered = await answer({ kind: 'choice', choice: 'The front door' })

    expect(log()).toEqual([
      'player:declaration:I leave',
      'code:call-raised:Which way do you go?',
      'player:call-answered:The front door',
      'narrator:narration:You step out into the rain.'
    ])
    expect(answeredData()).toMatchObject({ kind: 'question', answer: 'The front door' })
    expect(sessions.scene(sessionId).openCall).toBeNull()
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('takes free text, and the re-adjudication is told the question and the answer', async () => {
    model.enqueue(which())
    await play('I leave')
    const asked = model.requests.length

    model.enqueue(happens(), effect({ effect: 'none' }), says('You slip out the back.'))
    await answer({ kind: 'text', text: 'Out the back window, quietly' })

    const ruling = request(asked)
    expect(ruling).toContain('I leave')
    expect(ruling).toContain('Which way do you go?')
    expect(ruling).toContain('Out the back window, quietly')
    expect(log()).toContain('player:call-answered:Out the back window, quietly')
  })

  it('asks as many rounds as it takes, keeping the history, before a ruling', async () => {
    model.enqueue(which())
    await play('I leave')
    model.enqueue(asks('Openly, or quietly?'))
    const second = await answer({ kind: 'text', text: 'The front door' })

    expect(done(second)).toEqual({ type: 'done', reason: 'call' })
    expect(sessions.scene(sessionId).openCall).toMatchObject({
      kind: 'question',
      question: 'Openly, or quietly?',
      declaration: { seq: 1, text: 'I leave' },
      history: [{ question: 'Which way do you go?', answer: 'The front door' }]
    })

    model.enqueue(happens(), effect({ effect: 'none' }), says('You stroll out the front.'))
    const ruled = model.requests.length
    await answer({ kind: 'text', text: 'Openly' })

    const ruling = request(ruled)
    expect(ruling).toContain('The front door')
    expect(ruling).toContain('Openly')
    expect(log().at(-1)).toBe('narrator:narration:You stroll out the front.')
  })

  it('can lead to a Check Call, rolled as usual', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(asks('Climb what?', ['The wall', 'The stairs rail']))
    await play('I climb', using)

    model.enqueue(climb())
    const asked = await answer({ kind: 'choice', choice: 'The wall' }, using)
    expect(done(asked)).toEqual({ type: 'done', reason: 'call' })
    expect(sessions.scene(sessionId).openCall).toMatchObject({ kind: 'check', skill: 'athletics' })

    model.enqueue(effect({ effect: 'none' }), says('You haul yourself over.'))
    await roll(using)
    // The Effect after the roll (the request before the Reply) still knows what was clarified.
    expect(request(-2)).toContain('The wall')
    expect(log().slice(-2)).toEqual([
      'code:call-answered:Athletics: 19 + 5 = 24, success',
      'narrator:narration:You haul yourself over.'
    ])
  })

  it('is withdrawn by a new Declaration, which starts a new Exchange', async () => {
    model.enqueue(which())
    await play('I leave')

    model.enqueue(happens(), effect({ effect: 'none' }), says('You order another ale.'))
    const events = await play('Actually, I order an ale')

    expect(log()).toEqual([
      'player:declaration:I leave',
      'code:call-raised:Which way do you go?',
      'code:call-answered:Question withdrawn',
      'player:declaration:Actually, I order an ale',
      'narrator:narration:You order another ale.'
    ])
    expect(answeredData()).toMatchObject({ kind: 'question', withdrawn: true })
    expect(sessions.scene(sessionId).openCall).toBeNull()
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('stays open across a reload: a new runner instance can answer it', async () => {
    model.enqueue(which())
    await play('I leave')

    const reloaded = createSessionService(db)
    expect(reloaded.scene(sessionId).openCall).toMatchObject({
      kind: 'question',
      question: 'Which way do you go?'
    })
    model.enqueue(happens(), effect({ effect: 'none' }), says('Out you go.'))
    const answered = await answer(
      { kind: 'choice', choice: 'The cellar stairs' },
      runner({ sessions: reloaded })
    )
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('restores the question when the re-adjudication fails, so it can be answered again', async () => {
    model.enqueue(which())
    await play('I leave')
    const before = sessions.scene(sessionId)
    const logged = log()

    model.enqueue(fails)
    const events = await answer({ kind: 'text', text: 'The front door' })

    expect(done(events)).toMatchObject({ type: 'done', reason: 'error' })
    expect(sessions.scene(sessionId)).toEqual(before)
    expect(log()).toEqual(logged)
  })

  it('refuses a roll, a choice it did not offer and an empty answer', async () => {
    model.enqueue(which())
    await play('I leave')
    const using = runner()
    const signal = new AbortController().signal

    expect(using.answerCall(sessionId, { kind: 'roll' }, signal)).toEqual({
      ok: false,
      reason: 'no-open-call'
    })
    expect(using.answerCall(sessionId, { kind: 'choice', choice: 'The roof' }, signal)).toEqual({
      ok: false,
      reason: 'no-open-call'
    })
    expect(using.answerCall(sessionId, { kind: 'text', text: '  ' }, signal)).toEqual({
      ok: false,
      reason: 'empty-action'
    })
  })

  it('refuses a question answer while a Check is open', async () => {
    model.enqueue(climb())
    await play('I climb the wall')
    expect(
      runner().answerCall(
        sessionId,
        { kind: 'text', text: 'The wall' },
        new AbortController().signal
      )
    ).toEqual({ ok: false, reason: 'no-open-call' })
  })
})

describe('a clicked exit or NPC', () => {
  const click = (text: string, carried: CarriedEffect, using = runner()) =>
    drain(using.begin(sessionId, text, new AbortController().signal, carried))
  const cellarStairs: CarriedEffect = { effect: 'move', exitId: 'cellar-stairs' }
  const effectRequested = () => model.requests.some((r) => r.systemPrompts.includes(EFFECT_SYSTEM))

  it('ruled happens applies the carried move without asking the Effect step', async () => {
    model.enqueue(happens(), answers(cellar), answers(cellarNpcs), says('Cold air rises.'))

    const events = await click('I go through the Cellar stairs.', cellarStairs)

    expect(effectRequested()).toBe(false)
    expect(sessions.scene(sessionId).location.name).toBe('The Damp Cellar')
    expect(log()).toEqual([
      'player:declaration:I go through the Cellar stairs.',
      'code:scene-changed:You go through: Cellar stairs. You are now at The Damp Cellar.',
      'narrator:narration:Cold air rises.'
    ])
    expect(events.find((e) => e.type === 'ruling')).toMatchObject({ effect: cellarStairs })
    expect(
      model.requests
        .at(-1)!
        .messages.map((m) => m.content)
        .join('\n')
    ).toContain('went through Cellar stairs')
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('ruled impossible applies no Effect and only gets a Reply', async () => {
    const [brenna] = sessions.scene(sessionId).npcs
    const before = sessions.scene(sessionId)
    model.enqueue(impossible(), says('Brenna will not look at you.'))

    const events = await click('I talk to Brenna.', { effect: 'talk', npcId: brenna.id })

    expect(model.requests).toHaveLength(2)
    expect(events.find((e) => e.type === 'ruling')).toMatchObject({ effect: null })
    expect(log()).toEqual([
      'player:declaration:I talk to Brenna.',
      'narrator:narration:Brenna will not look at you.'
    ])
    expect(sessions.scene(sessionId)).toEqual(before)
  })

  it('ruled check applies the carried Effect once the roll succeeds', async () => {
    const using = runner({ seed: 4 })
    model.enqueue(climb())
    await click('I go through the Cellar stairs.', cellarStairs, using)
    expect(sessions.scene(sessionId).openCall).toMatchObject({ effect: cellarStairs })

    model.enqueue(answers(cellar), answers(cellarNpcs), says('You force it open.'))
    const answered = await roll(using)

    expect(effectRequested()).toBe(false)
    expect(sessions.scene(sessionId).location.name).toBe('The Damp Cellar')
    expect(log().slice(-2)).toEqual([
      'code:scene-changed:You go through: Cellar stairs. You are now at The Damp Cellar.',
      'narrator:narration:You force it open.'
    ])
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('ruled check applies nothing when the roll fails', async () => {
    const using = runner({ seed: 7 })
    model.enqueue(climb())
    await click('I go through the Cellar stairs.', cellarStairs, using)
    const before = sessions.scene(sessionId)

    model.enqueue(says('The door holds.'))
    await roll(using)

    expect(effectRequested()).toBe(false)
    expect(sessions.scene(sessionId)).toEqual({ ...before, openCall: null })
    expect(log().at(-1)).toBe('narrator:narration:The door holds.')
  })

  it('the Scene no longer allows is treated as typed: the Effect step decides', async () => {
    const before = sessions.scene(sessionId)
    model.enqueue(happens(), effect({ effect: 'none' }), says('There is no such door.'))

    const events = await click('I go through the Trapdoor.', { effect: 'move', exitId: 'trapdoor' })

    expect(effectRequested()).toBe(true)
    expect(events.find((e) => e.type === 'ruling')).toMatchObject({ effect: { effect: 'none' } })
    expect(sessions.scene(sessionId).location.name).toBe(before.location.name)
    expect(done(events)).toEqual({ type: 'done', reason: 'replied' })
  })

  it('ruled ask carries its Effect through the question, and applies it once ruled happens', async () => {
    model.enqueue(asks('Openly, or creeping?', ['Openly', 'Creeping']))
    await click('I go through the Cellar stairs.', cellarStairs)
    expect(sessions.scene(sessionId).openCall).toMatchObject({
      kind: 'question',
      effect: cellarStairs
    })

    model.enqueue(happens(), answers(cellar), answers(cellarNpcs), says('You creep down.'))
    const answered = await drain(
      runner().answerCall(
        sessionId,
        { kind: 'choice', choice: 'Creeping' },
        new AbortController().signal
      )
    )

    expect(effectRequested()).toBe(false)
    expect(sessions.scene(sessionId).location.name).toBe('The Damp Cellar')
    expect(log().slice(-2)).toEqual([
      'code:scene-changed:You go through: Cellar stairs. You are now at The Damp Cellar.',
      'narrator:narration:You creep down.'
    ])
    expect(done(answered)).toEqual({ type: 'done', reason: 'replied' })
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
