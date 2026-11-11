import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatPort, ChatRequest, TextEvent } from '../ai/port.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createSessionService, type SessionService } from './service'
import { createTurnRunner, type BeginResult, type TurnRunner } from './turn-runner.ts'

const HERO = {
  name: 'Brenna',
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: [
    { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
    { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
    { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
    { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' },
    { choiceKey: 'background/acolyte/equipment-0', item: 'amulet' }
  ]
} as Parameters<ReturnType<typeof createCharacterService>['create']>[0]

/** A scripted model: each call takes the next script; a script is a function over the request. */
type Script = (request: ChatRequest) => AsyncGenerator<unknown>
let scripts: Script[]
let requests: ChatRequest[]
let sessions: SessionService
let runner: TurnRunner
let sessionId: string

const delta = (text: string) => ({ type: 'TEXT_MESSAGE_CONTENT', delta: text })
const finished = { type: 'RUN_FINISHED' }

const says = (...parts: string[]): Script =>
  async function* () {
    for (const p of parts) yield delta(p)
    yield finished
  }

/** Streams one piece, then waits until aborted (a long narration the player stops). */
const hangsAfter = (part: string): Script =>
  async function* (request) {
    yield delta(part)
    if (request.signal.aborted) return
    await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve()))
  }

const fails: Script = async function* () {
  yield delta('Half a sent')
  yield { type: 'RUN_ERROR', message: 'model fell over' }
}

const port: ChatPort = (request) => {
  requests.push(request)
  const script = scripts.shift()
  if (!script) throw new Error('no script left')
  return script(request)
}

async function drain(result: BeginResult) {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  const events: TextEvent[] = []
  for await (const e of result.events) events.push(e)
  return events
}

const texts = () => sessions.turns(sessionId).map((t) => `${t.author}:${t.text}`)
const controller = () => new AbortController()

beforeEach(() => {
  scripts = []
  requests = []
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const w = createWorldService(db).create({ name: 'Eldoria' })
  const campaignId = createCampaignService(db).create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  const hero = createCharacterService(db).create(HERO)
  const linking = createSessionService(db)
  linking.linkCharacter(campaignId, hero.id)
  sessionId = linking.start(campaignId).id
  sessions = createSessionService(db)
  runner = createTurnRunner({
    sessions,
    port,
    contextLimit: 4096,
    replyReserve: 512,
    loadContext: () => ({
      campaign: { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
      worlds: [],
      sheet: 'Brenna, a fighter.'
    })
  })
})

describe('the DM opens the Session', () => {
  it('streams narration and saves it as the first DM turn', async () => {
    scripts.push(says('You stand ', 'at a gate.'))

    const events = await drain(runner.begin(sessionId, {}, controller().signal))

    expect(
      events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text)
    ).toEqual(['You stand ', 'at a gate.'])
    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(texts()).toEqual(['dm:You stand at a gate.'])
  })
})

describe('a player action', () => {
  beforeEach(async () => {
    scripts.push(says('A gate.'))
    await drain(runner.begin(sessionId, {}, controller().signal))
  })

  it('is saved before the model call, and the reply is saved as a DM turn', async () => {
    let seenByModel: string[] = []
    scripts.push(async function* () {
      seenByModel = texts()
      yield delta('It swings open.')
      yield finished
    })

    await drain(runner.begin(sessionId, { action: 'I push the gate.' }, controller().signal))

    expect(seenByModel).toEqual(['dm:A gate.', 'player:I push the gate.'])
    expect(texts()).toEqual(['dm:A gate.', 'player:I push the gate.', 'dm:It swings open.'])
    expect(requests.at(-1)?.messages.at(-1)).toEqual({ role: 'user', content: 'I push the gate.' })
  })

  it('on Stop discards the partial DM turn and leaves the action unanswered', async () => {
    scripts.push(hangsAfter('It swi'))
    const stop = controller()
    const result = runner.begin(sessionId, { action: 'I push.' }, stop.signal)
    if (!result.ok) throw new Error('refused')
    const events: TextEvent[] = []
    for await (const e of result.events) {
      events.push(e)
      stop.abort()
    }

    expect(events.some((e) => e.type === 'done' || e.type === 'error')).toBe(false)
    expect(texts()).toEqual(['dm:A gate.', 'player:I push.'])
    expect(runner.isGenerating(sessionId)).toBe(false)
  })

  it('on model failure discards the partial DM turn and reports the failure', async () => {
    scripts.push(fails)

    const events = await drain(runner.begin(sessionId, { action: 'I push.' }, controller().signal))

    expect(events.at(-1)).toMatchObject({ type: 'error', failure: { kind: 'provider-error' } })
    expect(texts()).toEqual(['dm:A gate.', 'player:I push.'])
  })

  it('is answered by Retry without saving the action twice, then the player may act again', async () => {
    scripts.push(fails, says('It opens.'), says('Beyond, a hall.'))
    await drain(runner.begin(sessionId, { action: 'I push.' }, controller().signal))

    await drain(runner.begin(sessionId, {}, controller().signal))
    expect(texts()).toEqual(['dm:A gate.', 'player:I push.', 'dm:It opens.'])

    await drain(runner.begin(sessionId, { action: 'I go in.' }, controller().signal))
    expect(texts().at(-1)).toBe('dm:Beyond, a hall.')
  })

  it('cannot be sent while an earlier action is still unanswered', async () => {
    scripts.push(fails)
    await drain(runner.begin(sessionId, { action: 'I push.' }, controller().signal))

    expect(runner.begin(sessionId, { action: 'I kick.' }, controller().signal)).toEqual({
      ok: false,
      reason: 'invalid-state'
    })
    expect(texts()).toEqual(['dm:A gate.', 'player:I push.'])
  })

  it('refuses a blank action', () => {
    expect(runner.begin(sessionId, { action: '   ' }, controller().signal)).toEqual({
      ok: false,
      reason: 'empty-action'
    })
  })

  it('refuses a second call while one is in flight, and allows one once it ends', async () => {
    scripts.push(hangsAfter('...'))
    const stop = controller()
    const first = runner.begin(sessionId, { action: 'I wait.' }, stop.signal)
    expect(first.ok).toBe(true)
    expect(runner.isGenerating(sessionId)).toBe(true)

    expect(runner.begin(sessionId, {}, controller().signal)).toEqual({
      ok: false,
      reason: 'in-flight'
    })
    expect(texts()).toEqual(['dm:A gate.', 'player:I wait.'])

    stop.abort()
    expect(runner.isGenerating(sessionId)).toBe(false)
  })
})

describe('refusals', () => {
  it('refuses an ended Session and an unknown one', () => {
    sessions.end(sessionId)
    expect(runner.begin(sessionId, {}, controller().signal)).toEqual({ ok: false, reason: 'ended' })
    expect(runner.begin('nope', {}, controller().signal)).toEqual({
      ok: false,
      reason: 'not-found'
    })
  })

  it('refuses a free-text action before the DM has opened the Session', () => {
    expect(runner.begin(sessionId, { action: 'Hi' }, controller().signal)).toEqual({
      ok: false,
      reason: 'invalid-state'
    })
  })
})

describe('the rolling summary', () => {
  // A small window so a few long turns cross 50% of the Turn budget.
  const SMALL = 1000
  const LONG = 'The torchlight wavers along the wet stone walls. '.repeat(8)

  const open = async () => {
    scripts.push(says('A gate.'))
    await drain(runner.begin(sessionId, { contextLimit: SMALL }, controller().signal))
  }
  /** One player action; the DM reply script, then (if a summary is due) the summary script. */
  const act = async (action: string, reply: Script, summary?: Script) => {
    scripts.push(reply)
    if (summary) scripts.push(summary)
    const events = await drain(
      runner.begin(sessionId, { action, contextLimit: SMALL }, controller().signal)
    )
    await runner.summaryIdle()
    return events
  }

  it('is not written while unsummarized Turns stay under half the Turn budget', async () => {
    await open()
    await act('I knock.', says('A voice answers.'))

    expect(requests).toHaveLength(2)
    expect(sessions.get(sessionId)?.summary).toBeNull()
  })

  it('is written by a separate stateless call once unsummarized Turns pass half the budget', async () => {
    await open()
    await act(
      'I push the gate.',
      says(LONG),
      says('The party opened the gate and entered a torchlit hall.')
    )

    expect(requests).toHaveLength(3)
    const call = requests[2]
    expect(call.threadId).not.toBe(sessionId)
    expect(call.tools).toBeUndefined()
    expect(call.outputSchema).toBeUndefined()
    expect(call.messages.map((m) => m.content).join('\n')).toContain('I push the gate.')
    expect(sessions.get(sessionId)).toMatchObject({
      summary: 'The party opened the gate and entered a torchlit hall.',
      summarizedThroughSeq: 3
    })
  })

  it('is used in later prompts, between the sheet and the Turns', async () => {
    await open()
    await act('I push the gate.', says(LONG), says('The party entered a torchlit hall.'))

    await act('I look around.', says('Dust.'))

    const prompts = requests.at(-1)!.systemPrompts
    const summary = prompts.findIndex((p) => p.includes('The party entered a torchlit hall.'))
    expect(summary).toBe(prompts.findIndex((p) => p.includes('Brenna, a fighter.')) + 1)
  })

  it('folds the previous summary into the next one and waits for new Turns', async () => {
    await open()
    await act('I push the gate.', says(LONG), says('Summary one.'))
    // Nothing new has crossed the threshold since: no further summary call.
    await act('I wait.', says('Quiet.'))
    expect(requests).toHaveLength(4)

    await act('I shout.', says(LONG), says('Summary two.'))
    expect(requests).toHaveLength(6)
    const input = requests[5].messages.map((m) => m.content).join('\n')
    expect(input).toContain('Summary one.')
    expect(input).not.toContain('I push the gate.')
    expect(sessions.get(sessionId)?.summary).toBe('Summary two.')
  })

  const errors: Script = async function* () {
    yield { type: 'RUN_ERROR', message: 'down' }
  }
  const throws: Script = (() => {
    throw new Error('boom')
  }) as unknown as Script

  it.each([
    ['a model error', errors],
    ['a thrown call', throws],
    ['an empty answer', says('   ')],
    ['numbers in the answer', says('You have 12 gold pieces.')]
  ])('fails silently on %s and play continues', async (_name, bad) => {
    await open()
    const events = await act('I push the gate.', says(LONG), bad)

    expect(events.at(-1)).toMatchObject({ type: 'done' })
    expect(sessions.get(sessionId)?.summary).toBeNull()
    expect(texts().at(-1)).toBe(`dm:${LONG}`)

    // The next turn still plays, and tries the summary again.
    await act('I go in.', says('Inside.'), says('Summary after failure.'))
    expect(sessions.get(sessionId)?.summary).toBe('Summary after failure.')
  })

  it('is not attempted after a failed DM turn', async () => {
    await open()
    await act('I push the gate.', fails)
    expect(requests).toHaveLength(2)
  })
})
