import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let folder: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-world-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
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
    const names = ['search', 'open', 'establish', 'edit_page', 'set_field']
    for (const name of names) {
      expect(host.list().find((t) => t.name === name)?.inputSchema).toMatchObject({
        type: 'object'
      })
    }
  })
})
