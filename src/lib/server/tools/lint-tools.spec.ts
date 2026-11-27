import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import type { ToolResult } from './contract'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string

beforeEach(() => {
  const tmp = tempDir('lint')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools })
})

afterEach(() => library.close())

function payload(result: ToolResult) {
  expect(result.content).toHaveLength(1)
  return JSON.parse(result.content[0].text)
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return payload(result)
}

describe('lint findings', () => {
  it('reports Entities with near-duplicate names', () => {
    ok('establish', { type: 'npc', name: 'Mira Voss' })
    ok('establish', { type: 'place', name: 'Salt Docks' })
    const second = ok('establish', { type: 'npc', name: 'Mira', distinct_from: ['npc:mira-voss'] })
    // A deliberate distinction at establish is not reported, but a rename that collides is.
    ok('establish', { type: 'faction', name: 'Grey Hand' })
    ok('set_field', { handle: 'place:salt-docks', version: 1, field: 'name', value: 'Grey Hands' })

    const lint = ok('lint')

    expect(lint.findings.filter((f: { kind: string }) => f.kind === 'near_duplicate')).toEqual([
      {
        kind: 'near_duplicate',
        entities: [
          { handle: 'faction:grey-hand', name: 'Grey Hand' },
          { handle: 'place:salt-docks', name: 'Grey Hands' }
        ]
      }
    ])
    expect(second.handle).toBe('npc:mira')
  })

  it('reports broken links in Pages and current Facts', () => {
    ok('establish', { type: 'place', name: 'Salt Docks' })
    ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      page: 'Works the [[Salt Docks]] for the [[Ghost Guild]].',
      facts: [{ claim: 'Owes money to [[Captain Rourke]].' }]
    })

    const lint = ok('lint')

    expect(lint.findings.filter((f: { kind: string }) => f.kind === 'broken_link')).toEqual([
      { kind: 'broken_link', handle: 'npc:mira-voss', in: 'page', link: 'Ghost Guild' },
      { kind: 'broken_link', handle: 'npc:mira-voss', in: 1, link: 'Captain Rourke' }
    ])
  })

  it('reports Pages linking to retired Entities, but not to merged ones', () => {
    ok('establish', { type: 'place', name: 'Salt Docks' })
    ok('establish', { type: 'place', name: 'Old Mill' })
    ok('establish', { type: 'place', name: 'Lantern Inn' })
    ok('establish', {
      type: 'place',
      name: 'Drowned Lantern',
      distinct_from: ['place:lantern-inn']
    })
    ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      page: 'Works the [[Salt Docks]], sleeps at the [[Old Mill]], drinks at the [[Lantern Inn]].'
    })
    ok('retire', { handle: 'place:old-mill', version: 1, reason: 'Burned down off-screen' })
    ok('merge', {
      from: 'place:lantern-inn',
      into: 'place:drowned-lantern',
      versions: { from: 1, into: 1 }
    })

    const lint = ok('lint')

    expect(lint.findings.filter((f: { kind: string }) => f.kind === 'retired_link')).toEqual([
      {
        kind: 'retired_link',
        handle: 'npc:mira-voss',
        retired: { handle: 'place:old-mill', name: 'Old Mill', reason: 'Burned down off-screen' }
      }
    ])
  })

  it('reports current Facts that restate a typed field', () => {
    ok('establish', { type: 'place', name: 'Salt Docks' })
    ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: { status: 'alive', whereabouts: 'place:salt-docks' },
      facts: [
        { claim: 'She owes a debt to the harbourmaster.' },
        { claim: 'She hides out at the [[Salt Docks]].' },
        { claim: 'Mira is alive, against the odds.' }
      ]
    })

    const lint = ok('lint')

    expect(lint.findings.filter((f: { kind: string }) => f.kind === 'restated_field')).toEqual([
      {
        kind: 'restated_field',
        handle: 'npc:mira-voss',
        fact: 2,
        claim: 'She hides out at the [[Salt Docks]].',
        field: 'whereabouts'
      },
      {
        kind: 'restated_field',
        handle: 'npc:mira-voss',
        fact: 3,
        claim: 'Mira is alive, against the odds.',
        field: 'status'
      }
    ])
  })

  it('reports current Beliefs pointing at retired Facts', () => {
    ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      facts: [{ claim: 'She keeps a ledger.' }, { claim: 'She hates the Guild.' }]
    })
    const odo = ok('establish', { type: 'npc', name: 'Odo', knows: [{ of: 1 }, { of: 2 }] })
    ok('retire', { fact: 1, version: 1, reason: 'Contradicted the Arc' })

    const lint = ok('lint')

    expect(lint.findings.filter((f: { kind: string }) => f.kind === 'retired_fact_belief')).toEqual(
      [
        {
          kind: 'retired_fact_belief',
          belief: odo.beliefs[0],
          holder: 'npc:odo',
          fact: 1,
          reason: 'Contradicted the Arc'
        }
      ]
    )
  })
})

describe('the changed-Pages packet', () => {
  it('holds the Pages of Entities changed since the last lint, and points to lint-review', () => {
    ok('establish', { type: 'place', name: 'Salt Docks', page: 'A rotten wharf.' })
    ok('establish', { type: 'npc', name: 'Mira Voss', fields: { status: 'alive' }, page: 'Alive.' })
    ok('establish', { type: 'npc', name: 'Odo', page: 'A ferryman.' })
    ok('establish', { type: 'faction', name: 'Grey Hand' })

    const first = ok('lint')
    expect(first.skill).toBe('the-dungeon-master:lint-review')
    expect(first.pages.map((p: { handle: string }) => p.handle)).toEqual([
      'npc:mira-voss',
      'npc:odo',
      'place:salt-docks'
    ])

    ok('set_field', { handle: 'npc:mira-voss', version: 1, field: 'status', value: 'dead' })
    ok('add_fact', { subject: 'npc:odo', version: 1, claim: 'He ferries smugglers.' })
    ok('add_fact', { subject: 'faction:grey-hand', version: 1, claim: 'They run the docks.' })

    const second = ok('lint')
    expect(second.pages).toEqual([
      {
        handle: 'npc:mira-voss',
        type: 'npc',
        name: 'Mira Voss',
        version: 2,
        fields: { status: 'dead' },
        page: 'Alive.'
      },
      {
        handle: 'npc:odo',
        type: 'npc',
        name: 'Odo',
        version: 2,
        fields: { status: 'alive' },
        page: 'A ferryman.'
      }
    ])
    expect(ok('lint').pages).toEqual([])
  })
})

describe('lint itself', () => {
  it('changes no World or Knowledge state, and logs one DM-only event the Player never sees', () => {
    ok('establish', { type: 'place', name: 'Salt Docks', page: 'See [[Nowhere]].' })
    ok('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: { whereabouts: 'place:salt-docks' },
      page: 'Lives at the [[Salt Docks]].',
      facts: [{ claim: 'She hides at the [[Salt Docks]].' }, { claim: 'She keeps a ledger.' }]
    })
    ok('establish', {
      type: 'npc',
      name: 'Mira',
      distinct_from: ['npc:mira-voss'],
      knows: [{ of: 2 }]
    })
    ok('retire', { fact: 2, version: 1, reason: 'Never true' })
    const handles = ['place:salt-docks', 'npc:mira-voss', 'npc:mira']
    const snapshot = () => ({
      open: handles.map((handle) => ok('open', { handle, history: true })),
      beliefs: ok('beliefs_of', { holder: 'npc:mira', history: true }),
      search: ok('search', { query: 'Salt Docks' })
    })
    const before = snapshot()
    const timeline = library.record(campaignId).timeline()
    const eventsBefore = host.events(folder).length

    const lint = ok('lint')

    expect(lint.findings.length).toBeGreaterThan(0)
    expect(library.record(campaignId).timeline()).toEqual(timeline)
    expect(snapshot()).toEqual(before)
    expect(host.events(folder).slice(eventsBefore)).toMatchObject([
      { tool: 'lint', kind: 'lint_ran', dmOnly: true }
    ])
  })
})

describe('Reveals outside the Narration Audience', () => {
  beforeEach(() => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    addCharacter(library, campaignId, fighterDraft('Ash'))
  })

  const outside = (lint: { findings: { kind: string }[] }) =>
    lint.findings.filter((f) => f.kind === 'reveal_outside_audience')

  it('hints at a Reveal to a Character the turn’s Narration did not reach', () => {
    ok('establish', { type: 'npc', name: 'Odo' })
    ok('narrate', { text: 'Odo slips Wren a note.', to: ['char:wren'] })
    ok('reveal', {
      claim: 'Odo is a spy',
      about: 'npc:odo',
      holders: ['char:wren', 'char:ash']
    })

    expect(outside(ok('lint'))).toEqual([
      {
        kind: 'reveal_outside_audience',
        holder: 'char:ash',
        belief: expect.any(Number)
      }
    ])
  })

  it('stays quiet when the Reveal stays inside the Audience, and still reveals to the Scene by default', () => {
    ok('establish', { type: 'npc', name: 'Odo' })
    ok('narrate', { text: 'Odo slips Wren a note.', to: ['char:wren'] })
    ok('reveal', { claim: 'Odo is a spy', about: 'npc:odo', holders: ['char:wren'] })

    expect(outside(ok('lint'))).toEqual([])
  })
})
