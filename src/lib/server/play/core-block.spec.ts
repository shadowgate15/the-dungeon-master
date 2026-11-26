import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createToolHost } from '../tools/host'
import { gameTools } from '../tools/index'

let library: CampaignLibrary
let campaignId: string
let folder: string

beforeEach(() => {
  const tmp = tempDir('core-block')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
})

afterEach(() => library.close())

/** A rough token count: about four characters a token. */
const tokens = (text: string) => Math.ceil(text.length / 4)

describe('the core block', () => {
  it('lists each Party member with handle, HP, conditions, status and whereabouts', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))

    const block = library.record(campaignId).coreBlock()

    // A level 1 Human Fighter with Con 13 (+1 racial = 14) has 10 + 2 = 12 HP.
    expect(block).toContain(
      '- Wren (char:wren): HP 12/12, conditions none, alive, whereabouts unknown'
    )
  })

  it('names the Scene, the NPCs present and when lint last ran', () => {
    const block = library.record(campaignId).coreBlock()

    expect(block).toMatch(/^Scene: /m)
    expect(block).toMatch(/^NPCs present: /m)
    expect(block).toMatch(/^Lint last ran: never/m)
    expect(block).toContain('Party: no Characters yet')
  })

  it('names the Scene with its time, the NPCs present and each Character’s whereabouts', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    const host = createToolHost({ library, tools: gameTools })
    const call = (name: string, args: Record<string, unknown>) =>
      expect(host.call(folder, name, args).isError ?? false).toBe(false)
    call('establish', { type: 'place', name: 'Drowned Lantern', fields: { exits: [] } })
    call('establish', {
      type: 'npc',
      name: 'Marrow',
      fields: { role: 'fence', description: 'A wary fence', whereabouts: 'place:drowned-lantern' }
    })
    call('move', { who: ['char:wren'], to: 'place:drowned-lantern' })
    call('set_scene', { place: 'place:drowned-lantern' })
    call('advance_time', { hours: 6, minutes: 20 })

    const block = library.record(campaignId).coreBlock()

    expect(block).toContain('Scene: Drowned Lantern (place:drowned-lantern), day 1, 14:20.')
    expect(block).toContain('- Marrow (npc:marrow): fence, A wary fence')
    expect(block).toContain('whereabouts place:drowned-lantern')
  })

  it('names the open Call with who has yet to answer, and the pending Calls', () => {
    addCharacter(library, campaignId, fighterDraft('Wren'))
    addCharacter(library, campaignId, fighterDraft('Bram'))
    const host = createToolHost({ library, tools: gameTools })
    const ok = (name: string, args: Record<string, unknown>) => {
      const result = host.call(folder, name, args)
      expect(result.isError ?? false).toBe(false)
      return JSON.parse(result.content[0].text)
    }
    const grik = ok('establish', {
      type: 'npc',
      name: 'Grik',
      fields: { stat_block: 'monster:goblin' }
    }).handle
    const { pending_call: pending } = ok('attack', {
      actor: 'char:wren',
      target: grik,
      with: 'crossbow'
    })
    const { call: open } = ok('narrate', {
      text: 'The door groans.',
      call: [
        {
          kind: 'check',
          character: 'char:wren',
          skill: 'athletics',
          tier: 'easy',
          reason: 'Shove'
        },
        { kind: 'check', character: 'char:bram', skill: 'athletics', tier: 'easy', reason: 'Shove' }
      ]
    })

    const block = library.record(campaignId).coreBlock()

    expect(block).toContain(
      `Open Call: ${open}, check, waiting on Wren (char:wren), Bram (char:bram).`
    )
    expect(block).toContain(`Pending Calls: ${pending}.`)
  })

  it('says when lint last ran', () => {
    const host = createToolHost({ library, tools: gameTools })
    host.call(folder, 'advance_time', { hours: 2 })
    expect(host.call(folder, 'lint', {}).isError ?? false).toBe(false)
    host.call(folder, 'advance_time', { hours: 1 })

    expect(library.record(campaignId).coreBlock()).toMatch(/^Lint last ran: day 1, 10:00\.$/m)
  })

  it('stays within about 300 tokens for a typical four-Character Party', () => {
    for (const name of ['Wren', 'Brannoch Ironfist', 'Seraphine of the Vale', 'Tobias Quill']) {
      addCharacter(library, campaignId, fighterDraft(name))
    }

    expect(tokens(library.record(campaignId).coreBlock())).toBeLessThanOrEqual(300)
  })
})

describe('the Arc line', () => {
  let call: (name: string, args?: Record<string, unknown>) => Record<string, unknown>
  let declare: (...texts: string[]) => void

  beforeEach(() => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    const host = createToolHost({ library, tools: gameTools })
    call = (name, args = {}) => {
      const result = host.call(folder, name, args)
      expect(result.isError ?? false).toBe(false)
      return JSON.parse(result.content[0].text)
    }
    declare = (...texts) => {
      const floor = library.floor(campaignId)
      for (const text of texts) floor.send({ character: wren, text })
      floor.done()
      call('narrate', { text: 'The world answers.' })
    }
  })

  const arcLine = () => {
    const block = library.record(campaignId).coreBlock()
    return block.slice(block.indexOf('\nArc:') + 1, block.indexOf('Lint last ran'))
  }

  const relicArc = {
    title: 'The Ember Relic',
    premise: 'A cult wants the relic.',
    stakes: 'The hills burn.',
    acts: [
      {
        name: 'The Road Out',
        purpose: 'Learn the relic is hunted.',
        beats: [
          { title: 'The Vizier Is the Patron', description: 'Secret one.' },
          { title: 'Ambush at the Ford', description: 'Secret two.' }
        ]
      },
      {
        name: 'The Burning Hills',
        purpose: 'Reach the shrine.',
        beats: [{ title: 'The Shrine Falls', description: 'Secret three.' }]
      }
    ],
    resolution: 'The relic is sealed.'
  }

  it('says there is no current Arc, with the drift since the log began', () => {
    declare('I look around.', 'I check my pack.')

    expect(arcLine()).toBe('Arc: No current Arc. Declarations since the last Beat change: 2.\n')
  })

  it('names the current Act, its pending Beats, the next Act and the drift', () => {
    call('create_arc', relicArc)
    call('resolve_beat', {
      beat: 'beat:the-vizier-is-the-patron',
      version: 1,
      to: 'reached',
      reason: 'Learned.'
    })
    declare('I ride for the ford.')

    expect(arcLine()).toBe(
      [
        'Arc: Act 1, The Road Out: Learn the relic is hunted.',
        '- Pending: beat:ambush-at-the-ford (Ambush at the Ford)',
        '- Next Act: The Burning Hills',
        '- Declarations since the last Beat change: 1.',
        ''
      ].join('\n')
    )
    expect(arcLine()).not.toContain('Secret')
  })

  it('counts only Player Declarations, and restarts on each Arc change', () => {
    declare('Before the Arc.')
    call('create_arc', relicArc)
    declare('One.', 'Two.')
    call('roll', { expr: '1d20' })
    call('advance_time', { minutes: 10 })
    expect(arcLine()).toContain('Declarations since the last Beat change: 2.')

    call('revise_arc', { version: 1, ops: [{ op: 'edit_arc', stakes: 'Ashford burns.' }] })
    expect(arcLine()).toContain('Declarations since the last Beat change: 0.')

    declare('Three.')
    call('retire_arc', { version: 2, reason: 'It no longer fits.' })
    declare('Four.')
    expect(arcLine()).toBe('Arc: No current Arc. Declarations since the last Beat change: 1.\n')
  })
})
