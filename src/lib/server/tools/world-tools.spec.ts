import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let folder: string

beforeEach(() => {
  const tmp = tempDir('world')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  library.create({ name: 'Ember Road', folder })
  host = createToolHost({ library, tools: gameTools })
})

afterEach(() => library.close())

function payload(result: ToolResult) {
  expect(result.content).toHaveLength(1)
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

describe('establish and open', () => {
  it('establishes an NPC with a readable handle and opens it with its fields and version', () => {
    const made = ok('establish', mira)
    expect(made).toMatchObject({ handle: 'npc:mira-voss', version: 1, unresolved: [] })

    expect(ok('open', { handle: 'npc:mira-voss' })).toMatchObject({
      handle: 'npc:mira-voss',
      type: 'npc',
      name: 'Mira Voss',
      aliases: [],
      version: 1,
      retired: null,
      fields: { description: 'A harbour smuggler', role: 'fence', status: 'alive' },
      page: '',
      facts: [],
      links: [],
      backlinks: [],
      beliefs: 0
    })
  })
})

describe('establish', () => {
  it('logs exactly one DM-only event per call', () => {
    ok('establish', mira)
    expect(host.events(folder)).toMatchObject([
      { tool: 'establish', kind: 'entity_established', dmOnly: true }
    ])
  })

  it('refuses a name close to an existing Entity, returning the matches', () => {
    ok('establish', mira)
    const refusal = refused('establish', { type: 'npc', name: 'Mira Vos' })
    expect(refusal).toMatchObject({
      code: 'near_duplicate',
      message: expect.stringContaining('npc:mira-voss'),
      next: expect.stringContaining('distinct_from'),
      matches: [{ handle: 'npc:mira-voss', name: 'Mira Voss' }]
    })
    expect(refusal.next).toEqual(expect.any(String))
    expect(host.events(folder)).toHaveLength(1)
  })

  it('checks aliases on both sides, and a bare first name, as close', () => {
    ok('establish', { ...mira, aliases: ['The Grey Fox'] })
    expect(refused('establish', { type: 'faction', name: 'Grey Fox' }).code).toBe('near_duplicate')
    expect(refused('establish', { type: 'npc', name: 'Old Woman', aliases: ['Mira'] }).code).toBe(
      'near_duplicate'
    )
  })

  it('accepts a close name once distinct_from lists the matches, with a fresh handle', () => {
    ok('establish', mira)
    expect(
      ok('establish', { type: 'npc', name: 'Mira Voss', distinct_from: ['npc:mira-voss'] })
    ).toMatchObject({ handle: 'npc:mira-voss-2', version: 1 })
  })

  it('lets an unrelated name through', () => {
    ok('establish', mira)
    expect(ok('establish', { type: 'place', name: 'The Salt Docks' }).handle).toBe(
      'place:the-salt-docks'
    )
  })

  it('checks typed fields against the type schema', () => {
    expect(refused('establish', { type: 'npc', name: 'Odo', fields: { hp: 7 } }).code).toBe(
      'invalid_input'
    )
    expect(
      refused('establish', { type: 'npc', name: 'Odo', fields: { status: 'sleepy' } }).code
    ).toBe('invalid_input')
    expect(
      refused('establish', { type: 'npc', name: 'Odo', fields: { whereabouts: 'place:nowhere' } })
        .code
    ).toBe('invalid_input')
    expect(host.events(folder)).toHaveLength(0)
  })
})

describe('pages and links', () => {
  beforeEach(() => {
    ok('establish', mira)
    ok('establish', { type: 'place', name: 'Salt Docks', aliases: ['the wharf'] })
  })

  it('resolves [[links]] by name or alias, indexes them both ways, and never stubs', () => {
    const edited = ok('edit_page', {
      handle: 'npc:mira-voss',
      version: 1,
      text: 'Works [[the wharf]] for [[Salt Docks]]. Owes [[Bran Coyle]] money. Fears [[Salt Dock]].'
    })
    expect(edited).toMatchObject({ handle: 'npc:mira-voss', version: 2 })
    expect(edited.unresolved).toEqual([
      { link: 'Bran Coyle', near: [] },
      { link: 'Salt Dock', near: [{ handle: 'place:salt-docks', name: 'Salt Docks' }] }
    ])

    const opened = ok('open', { handle: 'npc:mira-voss' })
    expect(opened.page).toBe(
      'Works [[Salt Docks]] for [[Salt Docks]]. Owes [[Bran Coyle]] money. Fears [[Salt Dock]].'
    )
    expect(opened.links).toEqual([{ handle: 'place:salt-docks', name: 'Salt Docks', via: 'page' }])
    expect(ok('open', { handle: 'place:salt-docks' }).backlinks).toEqual([
      { handle: 'npc:mira-voss', name: 'Mira Voss', via: 'page' }
    ])
    expect(ok('search', { query: 'Bran Coyle', type: 'npc' }).results).toHaveLength(1)
    expect(ok('search', { query: 'Bran Coyle', type: 'place' }).results).toHaveLength(0)
    expect(refused('open', { handle: 'npc:bran-coyle' }).code).toBe('unknown_handle')
  })

  it('keeps links pointing at the same Entity after a rename', () => {
    ok('edit_page', {
      handle: 'npc:mira-voss',
      version: 1,
      text: 'Smuggles through [[Salt Docks]].'
    })
    expect(
      ok('set_field', {
        handle: 'place:salt-docks',
        version: 1,
        field: 'name',
        value: 'Brine Quay'
      })
    ).toMatchObject({ old: 'Salt Docks', new: 'Brine Quay', version: 2 })

    const opened = ok('open', { handle: 'npc:mira-voss' })
    expect(opened.page).toBe('Smuggles through [[Brine Quay]].')
    expect(opened.links).toEqual([{ handle: 'place:salt-docks', name: 'Brine Quay', via: 'page' }])
  })

  it('patches with old/new pairs and keeps every revision', () => {
    ok('edit_page', { handle: 'npc:mira-voss', version: 1, text: 'Tall, scarred, quiet.' })
    ok('edit_page', {
      handle: 'npc:mira-voss',
      version: 2,
      patches: [
        { old: 'scarred', new: 'scarred across the jaw' },
        { old: 'quiet.', new: 'quiet. Drinks at [[Salt Docks]].' }
      ]
    })
    const opened = ok('open', { handle: 'npc:mira-voss', history: true })
    expect(opened.page).toBe('Tall, scarred across the jaw, quiet. Drinks at [[Salt Docks]].')
    expect(opened.revisions.map((r: { text: string }) => r.text)).toEqual([
      'Tall, scarred, quiet.',
      'Tall, scarred across the jaw, quiet. Drinks at [[Salt Docks]].'
    ])
    expect(opened.revisions[1].event).toBe(host.events(folder).at(-1)!.id)
  })

  it('takes full text only into an empty Page', () => {
    ok('edit_page', { handle: 'npc:mira-voss', version: 1, text: 'Tall.' })
    expect(
      refused('edit_page', { handle: 'npc:mira-voss', version: 2, text: 'Short.' })
    ).toMatchObject({ code: 'page_not_empty', next: expect.stringContaining('patches') })
  })

  it('refuses a patch whose old text is missing or appears more than once', () => {
    ok('edit_page', { handle: 'npc:mira-voss', version: 1, text: 'a cat and a cat' })
    expect(
      refused('edit_page', {
        handle: 'npc:mira-voss',
        version: 2,
        patches: [{ old: 'dog', new: 'x' }]
      }).code
    ).toBe('patch_mismatch')
    expect(
      refused('edit_page', {
        handle: 'npc:mira-voss',
        version: 2,
        patches: [{ old: 'cat', new: 'x' }]
      }).code
    ).toBe('patch_mismatch')
  })

  it('refuses a stale version, pointing at the read to redo', () => {
    ok('edit_page', { handle: 'npc:mira-voss', version: 1, text: 'Tall.' })
    expect(
      refused('edit_page', {
        handle: 'npc:mira-voss',
        version: 1,
        patches: [{ old: 'Tall', new: 'Short' }]
      })
    ).toMatchObject({ code: 'stale_version', next: 'open npc:mira-voss' })
    expect(refused('open', { handle: 'npc:nobody' }).code).toBe('unknown_handle')
  })
})

describe('the tool list', () => {
  it('lists each World tool with an object input schema', () => {
    const names = [
      'search',
      'open',
      'establish',
      'edit_page',
      'set_field',
      'add_fact',
      'supersede',
      'retire',
      'merge'
    ]
    for (const name of names) {
      expect(host.list().find((t) => t.name === name)?.inputSchema).toMatchObject({
        type: 'object'
      })
    }
  })
})

describe('facts', () => {
  beforeEach(() => {
    ok('establish', mira)
    ok('establish', { type: 'faction', name: 'Red Lanterns' })
  })

  it('adds a Fact under the subject version, indexes its links, and logs one event', () => {
    const added = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira pays tribute to [[Red Lanterns]]',
      valid_from: 120
    })
    expect(added).toMatchObject({ subject: 'npc:mira-voss', version: 2, superseded: [] })
    expect(ok('open', { handle: 'npc:mira-voss' }).facts).toEqual([
      {
        id: added.fact,
        claim: 'Mira pays tribute to [[Red Lanterns]]',
        valid_from: 120,
        valid_to: null,
        state: 'current'
      }
    ])
    expect(ok('open', { handle: 'faction:red-lanterns' }).backlinks).toEqual([
      { handle: 'npc:mira-voss', name: 'Mira Voss', via: added.fact }
    ])
    expect(ok('search', { query: 'tribute' }).results[0].handle).toBe('npc:mira-voss')
    expect(host.events(folder).at(-1)).toMatchObject({ tool: 'add_fact', dmOnly: true })
  })

  it('defaults valid_from to now, and null means since before the Campaign', () => {
    const now = ok('add_fact', { subject: 'npc:mira-voss', version: 1, claim: 'Mira limps' })
    const ever = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 2,
      claim: 'Mira was born in Varn',
      valid_from: null
    })
    const facts = ok('open', { handle: 'npc:mira-voss' }).facts
    expect(facts.find((f: { id: number }) => f.id === now.fact).valid_from).toBe(0)
    expect(facts.find((f: { id: number }) => f.id === ever.fact).valid_from).toBeNull()
  })

  it('refuses a Fact without the current subject version', () => {
    expect(refused('add_fact', { subject: 'npc:mira-voss', version: 9, claim: 'x' })).toMatchObject(
      { code: 'stale_version', next: 'open npc:mira-voss' }
    )
  })

  it('closes a superseded Fact at the new valid_from and leaves other Facts alone', () => {
    const loyal = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira is loyal to [[Red Lanterns]]',
      valid_from: 10
    })
    const limps = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 2,
      claim: 'Mira limps',
      valid_from: 10
    })
    const turned = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 3,
      claim: 'Mira informs on the Red Lanterns',
      valid_from: 300,
      supersedes: [loyal.fact]
    })
    expect(turned.superseded).toEqual([loyal.fact])

    // A contradicting Fact that names nothing supersedes nothing.
    ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 4,
      claim: 'Mira walks fine',
      valid_from: 400
    })

    const current = ok('open', { handle: 'npc:mira-voss' }).facts.map((f: { id: number }) => f.id)
    expect(current).toContain(limps.fact)
    expect(current).not.toContain(loyal.fact)

    const all = ok('open', { handle: 'npc:mira-voss', history: true }).facts
    expect(all.find((f: { id: number }) => f.id === loyal.fact)).toMatchObject({
      state: 'superseded',
      valid_from: 10,
      valid_to: 300,
      superseded_by: turned.fact
    })
    // Superseded Fact links no longer count as backlinks.
    expect(ok('open', { handle: 'faction:red-lanterns' }).backlinks).toEqual([])
  })

  it('refuses to supersede a Fact that is not current, or with a start before it', () => {
    const a = ok('add_fact', { subject: 'npc:mira-voss', version: 1, claim: 'A', valid_from: 50 })
    expect(
      refused('add_fact', {
        subject: 'npc:mira-voss',
        version: 2,
        claim: 'B',
        valid_from: 40,
        supersedes: [a.fact]
      }).code
    ).toBe('invalid_input')
    ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 2,
      claim: 'B',
      valid_from: 60,
      supersedes: [a.fact]
    })
    expect(
      refused('add_fact', {
        subject: 'npc:mira-voss',
        version: 3,
        claim: 'C',
        supersedes: [a.fact]
      }).code
    ).toBe('not_current')
    expect(
      refused('add_fact', { subject: 'npc:mira-voss', version: 3, claim: 'C', supersedes: [999] })
        .code
    ).toBe('unknown_fact')
  })

  it('records a supersession noticed later with supersede', () => {
    const old = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 1,
      claim: 'Mira is a fence',
      valid_from: 5
    })
    const later = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 2,
      claim: 'Mira runs the guild',
      valid_from: 90
    })
    expect(ok('supersede', { old: old.fact, by: later.fact })).toMatchObject({
      old: old.fact,
      by: later.fact,
      valid_to: 90
    })
    expect(host.events(folder).at(-1)).toMatchObject({ tool: 'supersede', dmOnly: true })
    const all = ok('open', { handle: 'npc:mira-voss', history: true }).facts
    expect(all.find((f: { id: number }) => f.id === old.fact)).toMatchObject({
      state: 'superseded',
      valid_to: 90
    })
    expect(refused('supersede', { old: old.fact, by: later.fact }).code).toBe('not_current')
  })

  it('warns when a set field is restated by a current Fact', () => {
    ok('add_fact', { subject: 'npc:mira-voss', version: 1, claim: 'Mira is dead, drowned' })
    const set = ok('set_field', {
      handle: 'npc:mira-voss',
      version: 2,
      field: 'status',
      value: 'dead'
    })
    expect(set).toMatchObject({ old: 'alive', new: 'dead', version: 3 })
    expect(set.warnings).toEqual([expect.stringContaining('Mira is dead, drowned')])
    expect(
      refused('set_field', { handle: 'npc:mira-voss', version: 3, field: 'mood', value: 'x' }).code
    ).toBe('invalid_input')
  })
})

describe('retire', () => {
  beforeEach(() => ok('establish', mira))

  it('retires one Fact with a reason under the subject version', () => {
    const f = ok('add_fact', { subject: 'npc:mira-voss', version: 1, claim: 'Mira has a twin' })
    expect(
      ok('retire', { fact: f.fact, version: 2, reason: 'mistaken: no twin was ever played' })
    ).toMatchObject({ retired_facts: [{ id: f.fact, claim: 'Mira has a twin' }], version: 3 })
    expect(ok('open', { handle: 'npc:mira-voss' }).facts).toEqual([])
    expect(ok('open', { handle: 'npc:mira-voss', history: true }).facts).toEqual([
      expect.objectContaining({ id: f.fact, state: 'retired', retired_reason: expect.any(String) })
    ])
    expect(host.events(folder).at(-1)).toMatchObject({ tool: 'retire', dmOnly: true })
  })

  it('retiring an Entity retires its current Facts and returns them', () => {
    const a = ok('add_fact', { subject: 'npc:mira-voss', version: 1, claim: 'Mira limps' })
    const b = ok('add_fact', { subject: 'npc:mira-voss', version: 2, claim: 'Mira hums' })
    const c = ok('add_fact', {
      subject: 'npc:mira-voss',
      version: 3,
      claim: 'Mira sings',
      supersedes: [b.fact]
    })
    const retired = ok('retire', {
      handle: 'npc:mira-voss',
      version: 4,
      reason: 'cut from the story'
    })
    expect(retired.retired_facts.map((f: { id: number }) => f.id)).toEqual([a.fact, c.fact])

    const opened = ok('open', { handle: 'npc:mira-voss', history: true })
    expect(opened.retired).toMatchObject({ reason: 'cut from the story' })
    expect(opened.facts.map((f: { state: string }) => f.state)).toEqual([
      'retired',
      'superseded',
      'retired'
    ])
    expect(ok('search', { query: 'Mira' }).results).toEqual([])
    expect(
      refused('edit_page', { handle: 'npc:mira-voss', version: opened.version, text: 'x' }).code
    ).toBe('retired')
    // A retired name no longer blocks a new one.
    expect(ok('establish', { type: 'npc', name: 'Mira Voss' }).handle).toBe('npc:mira-voss-2')
  })

  it('needs exactly one of fact or handle', () => {
    expect(refused('retire', { version: 1, reason: 'x' }).code).toBe('invalid_input')
  })
})

describe('merge', () => {
  it('moves Facts, aliases and incoming links into the survivor and retires the source', () => {
    ok('establish', { ...mira, page: 'Runs the docks.' })
    ok('establish', {
      type: 'npc',
      name: 'The Grey Fox',
      aliases: ['Fox'],
      page: 'A masked fence.',
      distinct_from: []
    })
    ok('establish', { type: 'place', name: 'Salt Docks', page: 'The [[Grey Fox]] works here.' })
    const fact = ok('add_fact', {
      subject: 'npc:the-grey-fox',
      version: 1,
      claim: 'The Fox fences relics'
    })
    const about = ok('add_fact', {
      subject: 'place:salt-docks',
      version: 1,
      claim: 'Smugglers answer to [[Fox]]'
    })

    const merged = ok('merge', {
      from: 'npc:the-grey-fox',
      into: 'npc:mira-voss',
      versions: { from: 2, into: 1 }
    })
    expect(merged).toMatchObject({ from: 'npc:the-grey-fox', into: 'npc:mira-voss' })
    expect(host.events(folder).at(-1)).toMatchObject({ tool: 'merge', dmOnly: true })

    const into = ok('open', { handle: 'npc:mira-voss', history: true })
    expect(into.aliases).toEqual(expect.arrayContaining(['The Grey Fox', 'Fox']))
    expect(into.facts.map((f: { id: number }) => f.id)).toContain(fact.fact)
    expect(into.page).toBe('Runs the docks.\n\nA masked fence.')
    expect(into.revisions).toHaveLength(2)
    expect(into.backlinks).toEqual(
      expect.arrayContaining([
        { handle: 'place:salt-docks', name: 'Salt Docks', via: 'page' },
        { handle: 'place:salt-docks', name: 'Salt Docks', via: about.fact }
      ])
    )
    expect(ok('open', { handle: 'place:salt-docks' }).page).toBe('The [[Mira Voss]] works here.')

    const from = ok('open', { handle: 'npc:the-grey-fox', history: true })
    expect(from.retired).toMatchObject({ merged_into: 'npc:mira-voss' })
    expect(from.facts).toEqual([])
    expect(ok('search', { query: 'Fox' }).results.map((r: { handle: string }) => r.handle)).toEqual(
      ['npc:mira-voss']
    )
  })

  it('refuses stale versions and merging an Entity into itself', () => {
    ok('establish', mira)
    ok('establish', { type: 'npc', name: 'Odo Brask' })
    expect(
      refused('merge', {
        from: 'npc:odo-brask',
        into: 'npc:mira-voss',
        versions: { from: 1, into: 7 }
      })
    ).toMatchObject({ code: 'stale_version', next: 'open npc:mira-voss' })
    expect(
      refused('merge', {
        from: 'npc:mira-voss',
        into: 'npc:mira-voss',
        versions: { from: 1, into: 1 }
      }).code
    ).toBe('invalid_input')
  })
})
