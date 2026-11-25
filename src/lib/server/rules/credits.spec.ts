import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../db/connect'
import { loadCredits } from './credits'
import { createRulesRepository } from './repository'
import { seedRulesData } from './seed'

const SRD_WORDING =
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'

function seeded() {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  return createRulesRepository(db)
}

describe('credits', () => {
  it('shows the exact SRD attribution and the seeded dataset version', () => {
    const credits = loadCredits(seeded())

    expect(credits.attribution).toBe(SRD_WORDING)
    expect(credits.dataset).toMatchObject({ version: '5.12.0', tag: 'v5.12.0', srdVersion: '5.1' })
    expect(credits.mitNotice).toContain('MIT License')
  })

  it('names each kind of SRD content the seeded rules data includes, new datasets too', () => {
    const contents = loadCredits(seeded()).dataset!.contents

    expect(contents).toEqual(
      expect.arrayContaining([
        { name: 'Spells', count: 319 },
        { name: 'Monsters', count: 334 },
        { name: 'Conditions', count: 15 },
        { name: 'Magic items', count: 362 },
        { name: 'Rules sections', count: 33 }
      ])
    )
  })

  it('says so when no dataset has been seeded', () => {
    const db = openDatabase(':memory:')
    migrateDatabase(db)

    expect(loadCredits(createRulesRepository(db)).dataset).toBeNull()
  })
})

describe('NOTICE', () => {
  const notice = readFileSync(new URL('../../../../NOTICE', import.meta.url), 'utf8')
  const mit = readFileSync(
    new URL('../../../../vendor/5e-database/LICENSE.md', import.meta.url),
    'utf8'
  )

  it('carries the exact SRD attribution, the MIT notice and the dataset version', () => {
    expect(notice).toContain(SRD_WORDING)
    expect(notice).toContain(mit.trim())
    expect(notice).toContain(`Rules data version: ${loadCredits(seeded()).dataset!.version}`)
  })

  it('lists every kind of SRD content the rules data includes', () => {
    for (const { name } of loadCredits(seeded()).dataset!.contents) expect(notice).toContain(name)
  })
})
