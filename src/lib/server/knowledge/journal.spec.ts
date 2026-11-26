import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createToolHost, type ToolHost } from '../tools/host'
import { gameTools } from '../tools/index'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string
let wren: string
let kael: string

beforeEach(() => {
  const tmp = tempDir('journal')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools })
  wren = addCharacter(library, campaignId, fighterDraft('Wren'))
  kael = addCharacter(library, campaignId, fighterDraft('Kael'))
})

afterEach(() => library.close())

/* eslint-disable @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown>): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return JSON.parse(result.content[0].text)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const journal = () => library.record(campaignId).journal()

describe('the Journal', () => {
  it("is empty until the Player's Characters learn something", () => {
    ok('establish', { type: 'npc', name: 'Mira Voss', fields: {} })
    expect(journal()).toEqual({ entries: [] })
  })

  it("shows each of the Player's Characters' Beliefs once, marked with who holds it", () => {
    const fact = ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: { role: 'fence' },
      facts: [{ claim: 'Mira owes the harbourmaster money' }]
    }).facts[0]
    ok('reveal', { of: fact })
    ok('reveal', { of: 'npc:mira-voss.role', holders: ['char:kael'] })

    expect(journal().entries).toEqual([
      {
        id: expect.any(String),
        about: { name: 'Mira Voss', type: 'npc' },
        text: 'Mira owes the harbourmaster money',
        source: null,
        holders: [
          { id: wren, name: 'Wren' },
          { id: kael, name: 'Kael' }
        ]
      },
      {
        id: expect.any(String),
        about: { name: 'Mira Voss', type: 'npc' },
        text: "Mira Voss's role: fence",
        source: null,
        holders: [{ id: kael, name: 'Kael' }]
      }
    ])
  })

  it('never shows a raw handle: a link reads as the name the Party knows, else "someone"', () => {
    ok('establish', { type: 'npc', name: 'Tam', fields: {} })
    ok('establish', { type: 'npc', name: 'Tam', fields: {}, distinct_from: ['npc:tam'] })
    ok('establish', { type: 'place', name: 'Saltgate', fields: {} })
    ok('reveal', { of: 'npc:tam', holders: ['char:wren'] })
    ok('reveal', {
      claim: '[[npc:tam]] and [[npc:tam-2]] met at [[place:saltgate]]',
      about: 'place:saltgate',
      holders: ['char:wren']
    })

    const texts = journal().entries.map((e) => e.text)
    expect(texts.join(' ')).not.toMatch(/npc:|place:/)
    expect(texts).toContain('Tam and someone met at Saltgate')
  })

  it('never shows NPC Beliefs or the World layer', () => {
    const fact = ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: {},
      facts: [{ claim: 'Mira is the cult patron' }]
    }).facts[0]
    ok('establish', {
      type: 'npc',
      name: 'Harbourmaster Doyle',
      fields: {},
      knows: [{ of: fact }]
    })

    expect(journal()).toEqual({ entries: [] })
    expect(JSON.stringify(journal())).not.toContain('cult patron')
  })

  it('strips the truth: an outdated Belief shows only what the Character learned', () => {
    ok('establish', { type: 'place', name: 'Saltgate', fields: {} })
    const fact = ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: {},
      facts: [{ claim: 'Mira is hiding in [[Saltgate]]' }]
    }).facts[0]
    ok('reveal', {
      claim: 'Mira sailed for the Isles',
      about: 'npc:mira-voss',
      source: 'a dockhand',
      holders: ['char:wren']
    })
    ok('reveal', { of: fact, holders: ['char:wren'] })
    ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira has fled to the hills',
      supersedes: [fact]
    })

    const payload = journal()
    expect(payload.entries.map((e) => e.text)).toEqual([
      'Mira sailed for the Isles',
      'Mira is hiding in Saltgate'
    ])
    expect(payload.entries[0].source).toBe('a dockhand')
    const text = JSON.stringify(payload)
    for (const leak of ['outdated', 'truth', 'fled', 'kind', 'npc:', 'claim', 'fact']) {
      expect(text).not.toContain(leak)
    }
  })
})
