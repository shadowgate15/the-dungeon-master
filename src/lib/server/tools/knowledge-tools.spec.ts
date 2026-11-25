import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-knowledge-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools })
  addCharacter(library, campaignId, fighterDraft('Wren'))
  addCharacter(library, campaignId, fighterDraft('Kael'))
})

afterEach(() => library.close())

function payload(result: ToolResult) {
  return JSON.parse(result.content[0].text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown>): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return payload(result)
}

function refused(name: string, args: Record<string, unknown>): any {
  const result = host.call(folder, name, args)
  expect(result.isError, result.content[0]?.text).toBe(true)
  return payload(result)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const mira = {
  type: 'npc',
  name: 'Mira Voss',
  fields: { description: 'A harbour smuggler', role: 'fence', status: 'alive' }
}

/** Establishes Mira with one Fact; returns the Fact's id. */
function miraWithFact(claim = 'Mira owes the harbourmaster money'): number {
  return ok('establish', { ...mira, facts: [{ claim }] }).facts[0]
}

describe('reveal', () => {
  it('gives a Belief to every Character in the Scene when no Holders are named', () => {
    const fact = miraWithFact()

    const revealed = ok('reveal', { of: fact })

    expect(revealed.skipped).toEqual([])
    expect(revealed.beliefs.map((b: { holder: string }) => b.holder).sort()).toEqual([
      'char:kael',
      'char:wren'
    ])
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      { claim: 'Mira owes the harbourmaster money', outdated: false }
    ])
  })
})

describe('reveal with the Party split', () => {
  it('gives a Belief only to the Characters in the Scene, not to those elsewhere', () => {
    const fact = miraWithFact()
    ok('establish', { type: 'place', name: 'The Docks', fields: {} })
    ok('establish', { type: 'place', name: 'Cellar', fields: {} })
    ok('move', { who: ['char:wren'], to: 'place:the-docks' })
    ok('move', { who: ['char:kael'], to: 'place:cellar' })
    ok('set_scene', { place: 'place:the-docks' })

    const revealed = ok('reveal', { of: fact })

    expect(revealed.beliefs.map((b: { holder: string }) => b.holder)).toEqual(['char:wren'])
    expect(ok('beliefs_of', { holder: 'char:kael' }).beliefs).toEqual([])
  })
})

describe('reveal to named Holders', () => {
  it('narrows to the named Characters and widens to NPCs', () => {
    const fact = miraWithFact()
    ok('establish', { type: 'npc', name: 'Dock Warden Ilse', fields: {} })

    const revealed = ok('reveal', { of: fact, holders: ['char:wren', 'npc:dock-warden-ilse'] })

    expect(revealed.beliefs.map((b: { holder: string }) => b.holder)).toEqual([
      'char:wren',
      'npc:dock-warden-ilse'
    ])
    expect(ok('beliefs_of', { holder: 'char:kael' }).beliefs).toEqual([])
    expect(ok('beliefs_of', { holder: 'npc:dock-warden-ilse' }).beliefs).toHaveLength(1)
  })

  it('refuses a Holder that is neither a Character nor an NPC', () => {
    const fact = miraWithFact()
    ok('establish', { type: 'place', name: 'Saltgate', fields: {} })

    expect(refused('reveal', { of: fact, holders: ['place:saltgate'] })).toMatchObject({
      code: 'invalid_input'
    })
    expect(refused('reveal', { of: fact, holders: ['char:nobody'] })).toMatchObject({
      code: 'unknown_handle'
    })
  })

  it('skips Holders who already believe it and returns them separately', () => {
    const fact = miraWithFact()
    const first = ok('reveal', { of: fact, holders: ['char:wren'] })

    const again = ok('reveal', { of: fact })

    expect(again.beliefs.map((b: { holder: string }) => b.holder)).toEqual(['char:kael'])
    expect(again.skipped).toEqual([{ holder: 'char:wren', belief: first.beliefs[0].id }])
  })

  it('logs one DM-only event', () => {
    const fact = miraWithFact()
    ok('reveal', { of: fact })
    expect(host.events(folder).at(-1)).toMatchObject({
      tool: 'reveal',
      kind: 'beliefs_revealed',
      dmOnly: true
    })
  })
})

describe('outdated Beliefs', () => {
  it('flags a Belief whose Fact was superseded, with the truth beside it, and keeps it', () => {
    const fact = miraWithFact('Mira is hiding in the harbour')
    ok('reveal', { of: fact, holders: ['char:wren'] })
    ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira has fled to the hills',
      supersedes: [fact]
    })

    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      {
        claim: 'Mira is hiding in the harbour',
        outdated: true,
        truth: 'Mira has fled to the hills'
      }
    ])
  })

  it('flags a field Belief once the field changes, keeping the value as learned', () => {
    ok('establish', mira)
    ok('reveal', { of: 'npc:mira-voss.role', holders: ['char:wren'] })
    ok('set_field', { handle: 'npc:mira-voss', version: 1, field: 'role', value: 'informant' })

    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      {
        kind: 'field',
        claim: "Mira Voss's role: fence",
        outdated: true,
        truth: "Mira Voss's role: informant"
      }
    ])
  })

  it('is computed, not stored: setting the field back makes it current again', () => {
    ok('establish', mira)
    ok('reveal', { of: 'npc:mira-voss.role', holders: ['char:wren'] })
    ok('set_field', { handle: 'npc:mira-voss', version: 1, field: 'role', value: 'informant' })
    ok('set_field', { handle: 'npc:mira-voss', version: 2, field: 'role', value: 'fence' })

    const [held] = ok('beliefs_of', { holder: 'char:wren' }).beliefs
    expect(held.outdated).toBe(false)
    expect(held).not.toHaveProperty('truth')
  })
})

describe('replacement', () => {
  it('replaces the older Belief on the same Fact chain, keeping it as history', () => {
    const old = miraWithFact('Mira is hiding in the harbour')
    const first = ok('reveal', { of: old, holders: ['char:wren'] }).beliefs[0]
    const next = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira has fled to the hills',
      supersedes: [old]
    }).fact

    const second = ok('reveal', { of: next, holders: ['char:wren'] }).beliefs[0]

    expect(second.replaced).toEqual([first.id])
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      { id: second.id, claim: 'Mira has fled to the hills', outdated: false }
    ])
    expect(ok('beliefs_of', { holder: 'char:wren', history: true }).beliefs).toMatchObject([
      { id: first.id, replaced_by: second.id },
      { id: second.id }
    ])
  })

  it('replaces an older value of the same field', () => {
    ok('establish', mira)
    const first = ok('reveal', { of: 'npc:mira-voss.role', holders: ['char:wren'] }).beliefs[0]
    ok('set_field', { handle: 'npc:mira-voss', version: 1, field: 'role', value: 'informant' })

    const second = ok('reveal', { of: 'npc:mira-voss.role', holders: ['char:wren'] }).beliefs[0]

    expect(second.replaced).toEqual([first.id])
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      { claim: "Mira Voss's role: informant", outdated: false }
    ])
  })
})

describe('lies and rumours', () => {
  it('records a lie as a Belief with its source and never as a Fact', () => {
    ok('establish', mira)

    const lie = ok('reveal', {
      claim: 'Mira sailed for the Isles last week',
      about: 'npc:mira-voss',
      source: 'a dockhand',
      holders: ['char:wren']
    }).beliefs[0]

    expect(ok('beliefs_of', { holder: 'char:wren', about: 'npc:mira-voss' }).beliefs).toEqual([
      expect.objectContaining({
        id: lie.id,
        kind: 'claim',
        claim: 'Mira sailed for the Isles last week',
        source: 'a dockhand',
        outdated: false
      })
    ])
    expect(ok('open', { handle: 'npc:mira-voss' }).facts).toEqual([])
  })

  it('replaces a lie only when the DM names it in replaces', () => {
    ok('establish', mira)
    const lie = ok('reveal', {
      claim: 'Mira sailed for the Isles',
      about: 'npc:mira-voss',
      holders: ['char:wren']
    }).beliefs[0]
    const other = ok('reveal', {
      claim: 'Mira is a noble in disguise',
      about: 'npc:mira-voss',
      holders: ['char:wren']
    }).beliefs[0]
    expect(other.replaced).toEqual([])

    const correction = ok('reveal', {
      claim: 'Mira never left the city',
      about: 'npc:mira-voss',
      holders: ['char:wren'],
      replaces: [lie.id]
    }).beliefs[0]

    expect(correction.replaced).toEqual([lie.id])
    expect(
      ok('beliefs_of', { holder: 'char:wren' }).beliefs.map((b: { claim: string }) => b.claim)
    ).toEqual(['Mira is a noble in disguise', 'Mira never left the city'])
  })

  it('re-points a rumour made true at its Fact', () => {
    ok('establish', mira)
    const rumour = ok('reveal', {
      claim: 'Mira owes the harbourmaster money',
      about: 'npc:mira-voss',
      holders: ['char:wren']
    }).beliefs[0]
    const fact = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira owes the harbourmaster money'
    }).fact

    const truth = ok('reveal', { of: fact, holders: ['char:wren'], replaces: [rumour.id] })

    expect(truth.beliefs[0].replaced).toEqual([rumour.id])
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toMatchObject([
      { kind: 'fact', claim: 'Mira owes the harbourmaster money' }
    ])
  })

  it("refuses to replace a Belief held by someone who isn't learning", () => {
    ok('establish', mira)
    const kaels = ok('reveal', {
      claim: 'Mira sailed for the Isles',
      about: 'npc:mira-voss',
      holders: ['char:kael']
    }).beliefs[0]

    expect(
      refused('reveal', {
        claim: 'Mira never left',
        about: 'npc:mira-voss',
        holders: ['char:wren'],
        replaces: [kaels.id]
      })
    ).toMatchObject({ code: 'invalid_input' })
  })
})

describe('the World tools and Beliefs', () => {
  it('open counts the current Beliefs about an Entity', () => {
    const fact = miraWithFact()
    ok('reveal', { of: fact })
    ok('reveal', { of: 'npc:mira-voss', holders: ['char:wren'] })

    expect(ok('open', { handle: 'npc:mira-voss' }).beliefs).toBe(3)
  })

  it('retiring an Entity retires every Belief pointing at it and returns them', () => {
    const fact = miraWithFact()
    const revealed = ok('reveal', { of: fact }).beliefs.map((b: { id: number }) => b.id)

    const retired = ok('retire', { handle: 'npc:mira-voss', version: 1, reason: 'A duplicate' })

    expect(retired.retired_beliefs.sort()).toEqual(revealed.sort())
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toEqual([])
  })

  it('merging moves Beliefs onto the survivor', () => {
    miraWithFact()
    ok('establish', { type: 'npc', name: 'The Fence', fields: {} })
    ok('reveal', { of: 'npc:the-fence', holders: ['char:wren'] })

    ok('merge', { from: 'npc:the-fence', into: 'npc:mira-voss', versions: { from: 1, into: 1 } })

    expect(ok('beliefs_of', { holder: 'char:wren', about: 'npc:mira-voss' }).beliefs).toHaveLength(
      1
    )
    expect(ok('open', { handle: 'npc:mira-voss' }).beliefs).toBe(1)
  })

  it("establish's knows seeds the new NPC's Beliefs, secrets included", () => {
    const fact = miraWithFact('Mira owes the harbourmaster money')

    ok('establish', {
      type: 'npc',
      name: 'Harbourmaster Doyle',
      fields: {},
      knows: [{ of: fact }, { claim: 'Mira works for the crown', about: 'npc:mira-voss' }]
    })

    expect(ok('beliefs_of', { holder: 'npc:harbourmaster-doyle' }).beliefs).toMatchObject([
      { kind: 'fact', claim: 'Mira owes the harbourmaster money' },
      { kind: 'claim', claim: 'Mira works for the crown' }
    ])
    expect(ok('beliefs_of', { holder: 'char:wren' }).beliefs).toEqual([])
  })

  it('refuses knows on anything but an NPC', () => {
    expect(
      refused('establish', {
        type: 'place',
        name: 'Saltgate',
        fields: {},
        knows: [{ claim: 'It floods', about: 'place:saltgate' }]
      })
    ).toMatchObject({ code: 'invalid_input' })
  })
})
