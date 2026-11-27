import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { createChannels } from '../bridge/channels'
import { createDice } from '../dice'
import { createPlay, type Play } from '../play/play'
import { createToolHost, type ToolHost } from './host'
import { gameTools } from './index'

/**
 * The names the Player sees for NPCs and Places come from what their Characters believe
 * (ADR 0007), never from the World layer: an unknown NPC is "a stranger" and an unknown Place
 * "an unfamiliar place".
 */
let library: CampaignLibrary
let host: ToolHost
let play: Play
let folder: string
let campaignId: string

const dice = createDice({ random: () => 0.5 })

beforeEach(() => {
  const tmp = tempDir('player-names')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  const publish = () => {}
  host = createToolHost({ library, tools: gameTools, publish, dice: () => dice })
  play = createPlay({ library, channels: createChannels(), publish, dice: () => dice })
  addCharacter(library, campaignId, fighterDraft('Wren'))
  addCharacter(library, campaignId, fighterDraft('Bram'))
  ok('establish', { type: 'place', name: 'The Docks', fields: { exits: [] } })
  ok('establish', { type: 'place', name: 'Drowned Lantern', fields: { exits: [] } })
  ok('establish', {
    type: 'npc',
    name: 'Vizier Maul',
    fields: { stat_block: 'monster:goblin', whereabouts: 'place:the-docks' }
  })
  ok('move', { who: ['char:wren', 'npc:vizier-maul'], to: 'place:the-docks' })
  ok('move', { who: ['char:bram'], to: 'place:drowned-lantern' })
  ok('set_scene', { place: 'place:the-docks' })
})

afterEach(() => library.close())

/* eslint-disable @typescript-eslint/no-explicit-any */
function ok(name: string, args: Record<string, unknown> = {}): any {
  const result = host.call(folder, name, args)
  expect(result.isError ?? false, result.content[0]?.text).toBe(false)
  return JSON.parse(result.content[0].text)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const lastNarration = () =>
  play
    .timeline(campaignId, SOLO_PLAYER)
    .entries.filter((e) => e.type === 'narration')
    .at(-1)

describe('an NPC’s voice', () => {
  it('is unnamed until a Character knows the NPC, then shows the name they know', () => {
    ok('narrate', { text: '“Move along.”', voice: 'npc:vizier-maul' })
    expect(lastNarration()).toMatchObject({ voice: null })
    expect(JSON.stringify(play.timeline(campaignId, SOLO_PLAYER))).not.toContain('Vizier Maul')

    ok('reveal', { of: 'npc:vizier-maul', holders: ['char:wren'] })
    ok('narrate', { text: '“I said move.”', voice: 'npc:vizier-maul' })
    expect(lastNarration()).toMatchObject({ voice: 'Vizier Maul' })
  })

  it('takes a label the DM gives for an NPC the Characters do not know', () => {
    ok('narrate', {
      text: '“Move along.”',
      voice: 'npc:vizier-maul',
      voice_label: 'the hooded man'
    })
    expect(lastNarration()).toMatchObject({ voice: 'the hooded man' })
  })
})

describe('the Scene', () => {
  it('names a Place only once a Character knows it', () => {
    expect(play.scene(campaignId, SOLO_PLAYER)).toMatchObject({
      place: { name: 'an unfamiliar place' },
      elsewhere: [{ name: 'Bram', whereabouts: 'an unfamiliar place' }]
    })
    expect(JSON.stringify(play.timeline(campaignId, SOLO_PLAYER))).not.toContain('The Docks')

    ok('reveal', { of: 'place:the-docks', holders: ['char:wren'] })
    ok('reveal', { of: 'place:drowned-lantern', holders: ['char:bram'] })
    expect(play.scene(campaignId, SOLO_PLAYER)).toMatchObject({
      place: { name: 'The Docks' },
      elsewhere: [{ whereabouts: 'Drowned Lantern' }]
    })
  })
})

describe('the initiative order', () => {
  it('shows an unknown NPC as a stranger', () => {
    const started = ok('start_combat', { combatants: ['char:wren', 'npc:vizier-maul'] })
    ok('narrate', { text: 'Steel rings out.', call: started.pending_call })

    const combat = play.scene(campaignId, SOLO_PLAYER).combat!
    expect(combat.order.map((c) => c.name)).toEqual(['a stranger'])
    expect(JSON.stringify(play.scene(campaignId, SOLO_PLAYER))).not.toContain('Vizier Maul')
    expect(JSON.stringify(play.timeline(campaignId, SOLO_PLAYER))).not.toContain('Vizier Maul')

    ok('reveal', { of: 'npc:vizier-maul', holders: ['char:wren'] })
    expect(play.scene(campaignId, SOLO_PLAYER).combat!.order.map((c) => c.name)).toEqual([
      'Vizier Maul'
    ])
  })
})
