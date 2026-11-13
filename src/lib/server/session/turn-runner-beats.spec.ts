import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatPort, ChatRequest, TextEvent } from '../ai/port.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createArcService, type ArcService } from '../arc/service'
import { createMemoryRepository } from '../memory/repository'
import { MAX_BEAT_TRANSITIONS } from '../memory/extraction'
import { createSessionService, type SessionService } from './service'
import { createTurnRunner, type BeginResult, type TurnRunner } from './turn-runner.ts'

/** Beat transitions proposed by extraction, through the turn-runner with in-memory SQLite. */

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

const beat = (n: string) => ({ title: `Beat ${n}`, description: `Outcome ${n}.` })
const ARC = {
  title: 'The Drowned Crown',
  premise: 'A crown lies under the lake.',
  stakes: 'The village floods.',
  resolution: 'The crown is returned.',
  acts: [
    {
      name: 'One',
      purpose: 'Arrive.',
      beats: [beat('1.1'), beat('1.2'), beat('1.3'), beat('1.4')]
    },
    { name: 'Two', purpose: 'Dive.', beats: [beat('2.1'), beat('2.2')] },
    { name: 'Three', purpose: 'Return.', beats: [beat('3.1'), beat('3.2')] }
  ]
}

type Script = (request: ChatRequest) => AsyncGenerator<unknown>
let scripts: Script[]
let requests: ChatRequest[]
let sessions: SessionService
let arcs: ArcService
let runner: TurnRunner
let sessionId: string
let campaignId: string
let logs: { kind: string; reason: string; seq: number }[]

const finished = { type: 'RUN_FINISHED' }
const says = (text: string): Script =>
  async function* () {
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: text }
    yield finished
  }
const extracts = (beats: unknown[]): Script =>
  async function* () {
    yield {
      type: 'CUSTOM',
      name: 'structured-output.complete',
      value: { object: { npcs: [], facts: [], beats } }
    }
    yield finished
  }
const fails: Script = async function* () {
  yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'Half' }
  yield { type: 'RUN_ERROR', message: 'fell over' }
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

async function play(action: string | undefined, reply: Script, extraction?: Script) {
  scripts.push(reply)
  if (extraction) scripts.push(extraction)
  await drain(runner.begin(sessionId, action ? { action } : {}, new AbortController().signal))
  await runner.memoryIdle()
}

const beats = () => arcs.get(campaignId)!.acts.flatMap((a) => a.beats)
const id = (title: string) => beats().find((b) => b.title === title)!.id
const stateOf = (title: string) => beats().find((b) => b.title === title)!
const mark = (titles: string[], state = 'reached') =>
  titles.map((t) => ({ id: id(`Beat ${t}`), state }))

beforeEach(() => {
  scripts = []
  requests = []
  logs = []
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const w = createWorldService(db).create({ name: 'Eldoria' })
  campaignId = createCampaignService(db).create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  arcs = createArcService(db)
  const draft = arcs.replaceWithDraft(campaignId, ARC)
  arcs.save(campaignId, draft, { accept: true })
  const hero = createCharacterService(db).create(HERO)
  const linking = createSessionService(db)
  linking.linkCharacter(campaignId, hero.id)
  sessionId = linking.start(campaignId).id
  sessions = createSessionService(db)
  runner = createTurnRunner({
    sessions,
    port,
    contextLimit: 8000,
    replyReserve: 512,
    rollD20: () => 10,
    rollModifier: () => 0,
    loadContext: () => ({
      campaign: { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
      worlds: [],
      sheet: 'Brenna, a fighter.'
    }),
    memory: createMemoryRepository(db),
    beats: arcs,
    log: (entry) => logs.push(entry)
  })
})

describe('Beat transitions from extraction', () => {
  it('offers the pending Beats of the current and next Act, with ids', async () => {
    await play(undefined, says('The lake.'), extracts([]))
    const text = requests
      .at(-1)!
      .messages.map((m) => m.content)
      .join('\n')
    expect(text).toContain(`[${id('Beat 1.1')}]`)
    expect(text).toContain(`[${id('Beat 2.2')}]`)
    expect(text).not.toContain(id('Beat 3.1'))
  })

  it('persists reached and abandoned with the source Session and Turn', async () => {
    await play(undefined, says('Grom waits.'))
    await play(
      'I greet Grom.',
      says('You meet Grom.'),
      extracts([...mark(['1.1']), ...mark(['1.2'], 'abandoned')])
    )
    expect(stateOf('Beat 1.1')).toMatchObject({
      state: 'reached',
      sourceSessionId: sessionId,
      sourceTurnSeq: sessions.turns(sessionId).at(-1)!.seq
    })
    expect(stateOf('Beat 1.2').state).toBe('abandoned')
    expect(stateOf('Beat 1.3').state).toBe('pending')
    expect(stateOf('Beat 1.3').sourceSessionId).toBeNull()
  })

  it('rejects unknown ids, repeats and bad states silently', async () => {
    await play(undefined, says('One.'), extracts(mark(['1.1'])))
    await play(
      'Go on.',
      says('Two.'),
      extracts([
        ...mark(['1.1'], 'abandoned'),
        { id: 'nope', state: 'reached' },
        ...mark(['1.2'], 'pending'),
        ...mark(['1.3'], 'sideways'),
        {}
      ])
    )
    expect(stateOf('Beat 1.1').state).toBe('reached')
    expect(stateOf('Beat 1.2').state).toBe('pending')
    expect(stateOf('Beat 1.3').state).toBe('pending')
    expect(logs.filter((l) => l.kind === 'beat').length).toBeGreaterThanOrEqual(5)
  })

  it('never moves a Beat beyond the next Act', async () => {
    await play(undefined, says('One.'), extracts(mark(['2.1', '3.1'])))
    expect(stateOf('Beat 2.1').state).toBe('reached')
    expect(stateOf('Beat 3.1').state).toBe('pending')
  })

  it('accepts at most three transitions per call', async () => {
    await play(undefined, says('One.'), extracts(mark(['1.1', '1.2', '1.3', '1.4'])))
    expect(MAX_BEAT_TRANSITIONS).toBe(3)
    expect(beats().filter((b) => b.state === 'reached')).toHaveLength(3)
  })

  it('judges the next-Act limit by the state before the call', async () => {
    await play(undefined, says('One.'), extracts(mark(['1.1', '1.2', '1.3'])))
    await play('On.', says('Two.'), extracts(mark(['1.4', '3.1'])))
    expect(stateOf('Beat 1.4').state).toBe('reached')
    expect(stateOf('Beat 3.1').state).toBe('pending')
  })

  it('leaves the Arc complete when no Beat is pending', async () => {
    await play(undefined, says('One.'), extracts(mark(['1.1', '1.2', '1.3'])))
    await play('a', says('Two.'), extracts(mark(['1.4', '2.1', '2.2'])))
    await play('b', says('Three.'), extracts(mark(['3.1', '3.2'], 'abandoned')))
    expect(beats().every((b) => b.state !== 'pending')).toBe(true)
  })

  it('never moves a Beat on a discarded turn', async () => {
    scripts.push(fails, extracts(mark(['1.1'])))
    await drain(runner.begin(sessionId, {}, new AbortController().signal))
    await runner.memoryIdle()
    expect(stateOf('Beat 1.1').state).toBe('pending')
  })

  it('offers no Beats for an Arc that is only a draft', () => {
    const db = openDatabase(':memory:')
    migrateDatabase(db)
    expect(createArcService(db).openBeats('missing')).toEqual([])
  })
})
