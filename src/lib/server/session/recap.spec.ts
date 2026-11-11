import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatPort, ChatRequest } from '../ai/port.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createSessionService, type SessionService } from './service'
import { createRecap, type Recap } from './recap.ts'

type Script = (request: ChatRequest) => AsyncGenerator<unknown>
let scripts: Script[]
let requests: ChatRequest[]
let sessions: SessionService
let recap: Recap
let sessionId: string

const says = (...parts: string[]): Script =>
  async function* () {
    for (const p of parts) yield { type: 'TEXT_MESSAGE_CONTENT', delta: p }
    yield { type: 'RUN_FINISHED' }
  }

const port: ChatPort = (request) => {
  requests.push(request)
  const script = scripts.shift()
  if (!script) throw new Error('no script left')
  return script(request)
}

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
  const hero = createCharacterService(db).create({
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
  } as Parameters<ReturnType<typeof createCharacterService>['create']>[0])
  sessions = createSessionService(db)
  sessions.linkCharacter(campaignId, hero.id)
  sessionId = sessions.start(campaignId).id
  sessions.appendTurn(sessionId, { author: 'dm', kind: 'narration', text: 'A gate looms.' })
  sessions.appendTurn(sessionId, { author: 'player', kind: 'action', text: 'I push it.' })
  sessions.appendTurn(sessionId, { author: 'dm', kind: 'narration', text: 'It swings open.' })
  recap = createRecap({ sessions, port })
})

describe('the resume recap', () => {
  it('writes a recap from the summary and recent Turns without saving a Turn', async () => {
    sessions.saveSummary(sessionId, 'The hero reached the gate.', 1)
    scripts.push(says('You stood ', 'at an open gate.'))

    const text = await recap.get(sessionId, new AbortController().signal)

    expect(text).toBe('You stood at an open gate.')
    const prompt = JSON.stringify(requests[0])
    expect(prompt).toContain('The hero reached the gate.')
    expect(prompt).toContain('It swings open.')
    expect(sessions.turns(sessionId)).toHaveLength(3)
  })

  it('is cached per last Turn: no second call until a new Turn exists', async () => {
    scripts.push(says('First.'), says('Second.'))
    const signal = new AbortController().signal

    expect(await recap.get(sessionId, signal)).toBe('First.')
    expect(await recap.get(sessionId, signal)).toBe('First.')
    expect(requests).toHaveLength(1)

    sessions.appendTurn(sessionId, { author: 'player', kind: 'action', text: 'I go.' })
    sessions.appendTurn(sessionId, { author: 'dm', kind: 'narration', text: 'Dust.' })
    expect(await recap.get(sessionId, signal)).toBe('Second.')
    expect(requests).toHaveLength(2)
  })

  it('stops the model call when aborted and caches nothing', async () => {
    const controller = new AbortController()
    scripts.push(async function* (request) {
      yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'Half' }
      await new Promise<void>((r) => request.signal.addEventListener('abort', () => r()))
    })
    const pending = recap.get(sessionId, controller.signal)
    await new Promise((r) => setTimeout(r, 10))
    controller.abort()

    expect(await pending).toBeUndefined()
    expect(requests[0].signal.aborted).toBe(true)
    scripts.push(says('Again.'))
    expect(await recap.get(sessionId, new AbortController().signal)).toBe('Again.')
  })

  it('fails silently and does not cache a failure', async () => {
    scripts.push(async function* () {
      yield { type: 'RUN_ERROR', message: 'down' }
    })
    expect(await recap.get(sessionId, new AbortController().signal)).toBeUndefined()
    scripts.push(says('Ok.'))
    expect(await recap.get(sessionId, new AbortController().signal)).toBe('Ok.')
  })

  it('gives nothing when the last Turn is not a plain DM turn', async () => {
    sessions.appendTurn(sessionId, { author: 'player', kind: 'action', text: 'I wait.' })
    expect(await recap.get(sessionId, new AbortController().signal)).toBeUndefined()
    expect(requests).toHaveLength(0)
  })
})
