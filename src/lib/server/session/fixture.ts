/** Test-only: an in-memory database holding a Campaign with a linked Character, ready to play. */
import { arc, arcAct, arcBeat } from '../db/schema'
import { answers, createScriptedPort, type Script } from '../../testing/scripted-chat-port'
import { createSessionService, type SessionService } from './service'
import { createCampaignService } from '../campaign/service'
import { createCharacterService } from '../character/service'
import { migrateDatabase, openDatabase, type Database } from '../db/connect'
import { seedRulesData } from '../rules/seed'
import { createWorldService } from '../world/service'

export interface PlayableCampaign {
  db: Database
  campaignId: string
  characterId: string
}

/** Gives the Campaign an accepted Arc of one Act with two Beats (a Session requires one). */
export function acceptArc(
  db: Database,
  campaignId: string,
  status: 'draft' | 'accepted' = 'accepted'
) {
  const row = db
    .insert(arc)
    .values({
      campaignId,
      status,
      title: 'The Ember Crown',
      premise: 'A relic wakes.',
      stakes: 'The valley burns.',
      resolution: 'The relic is destroyed.',
      createdAt: 1,
      updatedAt: 1
    })
    .returning()
    .get()
  const act = db
    .insert(arcAct)
    .values({ arcId: row.id, position: 0, name: 'Setup', purpose: 'Strangers gather.' })
    .returning()
    .get()
  db.insert(arcBeat)
    .values([
      {
        actId: act.id,
        position: 0,
        title: 'A stranger arrives',
        description: 'Someone asks for help.'
      },
      { actId: act.id, position: 1, title: 'The relic stirs', description: 'It glows at night.' }
    ])
    .run()
}

/** A valid answer for each of the three First Scene stages. */
export const firstSceneAnswers = {
  situation: {
    situation: 'The Characters shelter from a storm while a stranger watches the door.'
  },
  place: {
    name: 'The Gilded Stag',
    description: 'A low-beamed tavern warm with hearth smoke and the smell of wet wool.',
    exits: ['Front door', 'Cellar stairs'],
    objects: ['The hearth', 'A notice board']
  },
  npcs: {
    npcs: [
      {
        name: 'Brenna',
        description: 'A broad-shouldered innkeeper with flour on her sleeves.',
        role: 'Innkeeper',
        attitude: 'friendly',
        knowledge: 'Knows who has been asking after travellers.'
      },
      {
        name: 'Old Hob',
        description: 'A stooped farmer nursing a cup of cider.',
        role: 'Farmer',
        attitude: 'wary',
        knowledge: 'Saw lights on the north road.'
      }
    ]
  }
}

/** The three scripted model answers of a successful First Scene. */
export const firstSceneScripts = (): Script[] => [
  answers(firstSceneAnswers.situation),
  answers(firstSceneAnswers.place),
  answers(firstSceneAnswers.npcs)
]

/** A Session service over the fixture whose model first answers with the given scripts. */
export function sessionServiceWith(
  fixture: PlayableCampaign,
  scripts: Script[] = firstSceneScripts(),
  now?: () => number
): { sessions: SessionService; model: ReturnType<typeof createScriptedPort> } {
  const model = createScriptedPort(scripts)
  return { sessions: createSessionService(fixture.db, now, model.port), model }
}

/** A fresh in-memory database with a Campaign whose linked Character is a human Fighter. */
export function playableCampaign(options: { arc?: boolean } = {}): PlayableCampaign {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  const worldId = createWorldService(db).create({ name: 'Eldoria' }).id
  const campaigns = createCampaignService(db)
  const campaignId = campaigns.create({ name: 'C', premise: 'P', tone: 'dark', length: 'short' }, [
    worldId
  ]).id
  const characterId = createCharacterService(db).create({
    name: 'Rowan',
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
  }).id
  campaigns.linkCharacter(campaignId, characterId)
  if (options.arc !== false) acceptArc(db, campaignId)
  return { db, campaignId, characterId }
}
