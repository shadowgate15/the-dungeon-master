import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createToolHost } from '../tools/host'
import { gameTools } from '../tools/index'

let library: CampaignLibrary
let campaignId: string
let folder: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-core-block-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
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

  it('stays within about 300 tokens for a typical four-Character Party', () => {
    for (const name of ['Wren', 'Brannoch Ironfist', 'Seraphine of the Vale', 'Tobias Quill']) {
      addCharacter(library, campaignId, fighterDraft(name))
    }

    expect(tokens(library.record(campaignId).coreBlock())).toBeLessThanOrEqual(300)
  })
})
