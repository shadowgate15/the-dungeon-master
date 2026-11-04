import { registerHooks } from 'node:module'
import type { Page } from '@playwright/test'
import type { CharacterInput } from '../lib/server/character/service'

// The Rules Data is imported as JSON without an import attribute (Vite allows it), which Node
// rejects under Playwright's loader. Supply the attribute so the real service can be imported.
registerHooks({
  load: (url, context, nextLoad) =>
    nextLoad(
      url,
      url.endsWith('.json') ? { ...context, importAttributes: { type: 'json' } } : context
    )
})

/**
 * Creates a Character straight through the service, in the e2e database the app runs on. Visits
 * `/characters` first so the app has migrated and seeded the Rules Data before the insert.
 */
export async function seedCharacter(page: Page, name: string, over: Partial<CharacterInput> = {}) {
  await page.goto('/characters')
  const { openDatabase } = await import('../lib/server/db/connect')
  const { createCharacterService } = await import('../lib/server/character/service')
  const db = openDatabase('e2e.db')
  let created
  try {
    created = createCharacterService(db).create({
      name,
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
        { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' }
      ],
      ...over
    })
  } finally {
    db.$client.close()
  }
  // Reload so the list shows the new Character.
  await page.goto('/characters')
  return created
}
