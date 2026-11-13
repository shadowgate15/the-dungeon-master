import { beforeEach, describe, expect, it } from 'vitest'
import type { ChatPort, ChatRequest } from '../ai/port.ts'
import { migrateDatabase, openDatabase } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { createWorldService } from '../world/service'
import { createArcService } from '../arc/service'
import { ARC_DRIFT_TURNS } from '../arc/context.ts'
import type { Database } from '../db/connect'
import { arcBeat } from '../db/schema'
import { eq } from 'drizzle-orm'
import { createSessionService, type SessionService } from './service'
import { createTurnRunner, type TurnRunner } from './turn-runner.ts'

/** The Arc block in the DM's request through the turn-runner, with in-memory SQLite. */

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

let requests: ChatRequest[]
let db: Database
let sessions: SessionService
let runner: TurnRunner
let sessionId: string
let campaignId: string

const port: ChatPort = (request) => {
  requests.push(request)
  return (async function* () {
    yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'The wind howls.' }
    yield { type: 'RUN_FINISHED' }
  })()
}

const ARC = {
  title: 'The Drowned Crown',
  premise: 'A crown lies under the lake.',
  stakes: 'The village floods.',
  resolution: 'The crown is returned.',
  acts: [
    {
      name: 'Setup',
      purpose: 'Arrive at the lake.',
      beats: [
        { title: 'Meet the warden', description: 'Grom is met.' },
        { title: 'Find the boat', description: 'A boat is found.' }
      ]
    },
    {
      name: 'Dive',
      purpose: 'Go under.',
      beats: [
        { title: 'Enter the ruins', description: 'The ruins are entered.' },
        { title: 'Find the crown', description: 'The crown is found.' }
      ]
    },
    {
      name: 'Return',
      purpose: 'Bring it home.',
      beats: [
        { title: 'Flee the lake', description: 'The lake is fled.' },
        { title: 'Return the crown', description: 'It is returned.' }
      ]
    }
  ]
}

const systemText = () => requests.at(-1)!.systemPrompts.join('\n')

async function play(action?: string) {
  const result = runner.begin(sessionId, action ? { action } : {}, new AbortController().signal)
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  for await (const _ of result.events) void _
}

function setUp(accept: boolean) {
  db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  requests = []
  const w = createWorldService(db).create({ name: 'Eldoria' })
  campaignId = createCampaignService(db).create(
    { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
    [w.id]
  ).id
  const arcs = createArcService(db)
  if (accept) {
    const draft = arcs.replaceWithDraft(campaignId, ARC)
    arcs.save(campaignId, { ...draft, acts: draft.acts }, { accept: true })
  }
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
    loadContext: ({ campaignId: id }) => ({
      campaign: { name: 'Crown', premise: 'Find it.', tone: 'dark', length: 'short' },
      worlds: [],
      sheet: 'Brenna, a fighter.',
      arc: createArcService(db).get(id)
    })
  })
}

describe('the Arc in the DM request', () => {
  beforeEach(() => {
    setUp(true)
  })

  it('shows the current Act, not the whole outline', async () => {
    await play()
    const text = systemText()
    expect(text).toContain('Setup')
    expect(text).toContain('Meet the warden: Grom is met.')
    expect(text).toContain('Enter the ruins')
    expect(text).not.toContain('The ruins are entered.')
    expect(text).not.toContain('The crown is returned.')
  })

  it('adds the drift hint only after enough DM turns without Beat progress', async () => {
    for (let i = 0; i < ARC_DRIFT_TURNS - 1; i++) {
      sessions.appendTurn(sessionId, { author: 'dm', kind: 'narration', text: 'x' })
    }
    await play('Onward.')
    expect(systemText()).not.toMatch(/drift/i)
    // 14 earlier + the one just saved = 15 DM turns.
    await play('Onward again.')
    expect(systemText()).toMatch(/drift/i)
  })

  it('clears the drift hint when a Beat is reached', async () => {
    for (let i = 0; i < ARC_DRIFT_TURNS; i++) {
      sessions.appendTurn(sessionId, { author: 'dm', kind: 'narration', text: 'x' })
    }
    const beat = createArcService(db).get(campaignId)!.acts[0].beats[0]
    const seq = sessions.turns(sessionId).length
    db.update(arcBeat)
      .set({ state: 'reached', sourceSessionId: sessionId, sourceTurnSeq: seq })
      .where(eq(arcBeat.id, beat.id))
      .run()
    await play('Onward.')
    expect(systemText()).not.toMatch(/drift/i)
    expect(systemText()).toMatch(/already happened/i)
  })
})

describe('without an accepted Arc', () => {
  it('sends no Arc text', async () => {
    setUp(false)
    await play()
    expect(systemText()).not.toContain('Drowned')
    expect(requests.at(-1)!.systemPrompts).toHaveLength(4)
  })
})
