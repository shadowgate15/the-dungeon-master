/** Test-only: an in-memory database holding a Campaign with a linked Character, ready to play. */
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

/** A fresh in-memory database with a Campaign whose linked Character is a human Fighter. */
export function playableCampaign(): PlayableCampaign {
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
  return { db, campaignId, characterId }
}
