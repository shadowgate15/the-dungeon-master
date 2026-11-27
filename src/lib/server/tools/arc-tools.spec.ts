import { SOLO_PLAYER } from '#lib/character/enums.ts'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tempDir } from '../../../testing/temp-dir'
import { testLibrary } from '../../../testing/library'
import type { LiveMessage } from '#lib/live/messages.ts'
import type { CampaignLibrary } from '../campaign/library'
import { addCharacter, fighterDraft } from '../character/test-characters'
import { gameTools } from '.'
import { createToolHost, type ToolHost } from './host'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string
let pushed: LiveMessage[]

beforeEach(() => {
  const tmp = tempDir('arc')
  library = testLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  pushed = []
  host = createToolHost({ library, tools: gameTools, publish: (m) => pushed.push(m) })
})

afterEach(() => library.close())

function call(name: string, args: unknown = {}) {
  const result = host.call(folder, name, args)
  return { isError: result.isError ?? false, payload: JSON.parse(result.content[0].text) }
}

/** An Arc as `builder` would write it at Begin. */
const relicArc = {
  title: 'The Ember Relic',
  premise: 'A cult wants the relic the Party escorts.',
  stakes: 'If the cult wins, the hills burn for a generation.',
  acts: [
    {
      name: 'The Road Out',
      purpose: 'Leave Ashford and learn the relic is hunted.',
      beats: [
        { title: 'The Vizier Is the Patron', description: 'The Party learns who hired them.' },
        { title: 'Ambush at the Ford', description: 'The cult strikes first.' }
      ]
    },
    {
      name: 'The Burning Hills',
      purpose: 'Reach the shrine before the cult.',
      beats: [{ title: 'The Shrine Falls', description: 'The cult takes or loses the shrine.' }]
    }
  ],
  resolution: 'The relic is sealed, or the hills burn.'
}

describe('create_arc', () => {
  it('creates the current Arc with readable Beat handles and one version', () => {
    const { isError, payload } = call('create_arc', relicArc)
    expect(isError).toBe(false)
    expect(payload).toMatchObject({
      title: 'The Ember Relic',
      state: 'current',
      version: 1,
      acts: [
        {
          name: 'The Road Out',
          beats: [
            { handle: 'beat:the-vizier-is-the-patron', state: 'pending' },
            { handle: 'beat:ambush-at-the-ford', state: 'pending' }
          ]
        },
        { name: 'The Burning Hills', beats: [{ handle: 'beat:the-shrine-falls' }] }
      ]
    })
  })

  it('is refused while a current Arc exists', () => {
    call('create_arc', relicArc)
    const second = call('create_arc', { ...relicArc, title: 'Another Arc' })
    expect(second).toMatchObject({ isError: true, payload: { code: 'current_arc' } })
  })

  it('logs a DM-only event and nothing the Player sees', () => {
    call('create_arc', relicArc)
    expect(host.events(folder)).toEqual([
      expect.objectContaining({ kind: 'arc_created', dmOnly: true })
    ])
    expect(JSON.stringify(library.record(campaignId).timeline('player'))).not.toMatch(
      /Ember Relic|vizier/i
    )
  })

  it('refuses an Arc with no Acts, or an Act with no Beats', () => {
    expect(call('create_arc', { ...relicArc, acts: [] }).isError).toBe(true)
    const empty = { ...relicArc, acts: [{ name: 'Act', purpose: 'Purpose', beats: [] }] }
    expect(call('create_arc', empty).isError).toBe(true)
  })
})

/** The current Arc's version, read the way the DM must before any Arc write. */
const version = () => call('arc').payload.current.version as number

describe('arc', () => {
  it('reads the current Arc, or null in a gap', () => {
    expect(call('arc').payload).toEqual({ current: null })
    call('create_arc', relicArc)
    expect(call('arc').payload.current).toMatchObject({ title: 'The Ember Relic', version: 1 })
  })

  it('with history, also returns the concluded and retired Arcs', () => {
    call('create_arc', relicArc)
    call('retire_arc', { version: version(), reason: 'The relic was destroyed.' })
    call('create_arc', { ...relicArc, title: 'The Ashen Crown' })

    const { payload } = call('arc', { history: true })

    expect(payload.current.title).toBe('The Ashen Crown')
    expect(payload.history).toEqual([
      expect.objectContaining({ title: 'The Ember Relic', state: 'retired' })
    ])
    expect(call('arc').payload).not.toHaveProperty('history')
  })
})

describe('resolve_beat', () => {
  beforeEach(() => call('create_arc', relicArc))

  const resolve = (beat: string, to: 'reached' | 'abandoned', reason = 'Play settled it.') =>
    call('resolve_beat', { beat, version: version(), to, reason })

  it('stamps a pending Beat with its reason, the Event and the Session', () => {
    const { isError, payload } = resolve('beat:the-vizier-is-the-patron', 'reached')

    expect(isError).toBe(false)
    expect(payload).toMatchObject({
      resolved: { handle: 'beat:the-vizier-is-the-patron', state: 'reached' },
      abandoned: [],
      arc: { state: 'current', version: 2 }
    })
    const [, logged] = host.events(folder)
    expect(logged).toMatchObject({ kind: 'beat_resolved', dmOnly: true })
    const read = call('arc').payload.current.acts[0].beats[0]
    expect(read).toMatchObject({
      state: 'reached',
      reason: 'Play settled it.',
      event: logged.id
    })
  })

  it('reaching a later-Act Beat abandons the earlier Acts’ pending Beats', () => {
    resolve('beat:the-vizier-is-the-patron', 'reached')

    const { payload } = resolve('beat:the-shrine-falls', 'reached')

    expect(payload.abandoned).toEqual([
      { handle: 'beat:ambush-at-the-ford', title: 'Ambush at the Ford', state: 'abandoned' }
    ])
  })

  it('abandoning a later-Act Beat cascades nothing', () => {
    const { payload } = resolve('beat:the-shrine-falls', 'abandoned')
    expect(payload.abandoned).toEqual([])
    expect(payload.arc.state).toBe('current')
  })

  it('concludes the Arc when no Beat is left pending and points at arc-review', () => {
    resolve('beat:the-vizier-is-the-patron', 'reached')
    resolve('beat:ambush-at-the-ford', 'abandoned')

    const { payload } = resolve('beat:the-shrine-falls', 'reached')

    expect(payload).toMatchObject({
      arc: { state: 'concluded' },
      skill: 'the-dungeon-master:arc-review'
    })
    expect(call('arc').payload.current).toBeNull()
  })

  it('refuses a Beat that is no longer pending, an unknown Beat and a stale version', () => {
    resolve('beat:ambush-at-the-ford', 'abandoned')

    expect(resolve('beat:ambush-at-the-ford', 'reached').payload.code).toBe('beat_not_pending')
    expect(resolve('beat:nope', 'reached').payload.code).toBe('unknown_beat')
    const stale = call('resolve_beat', {
      beat: 'beat:the-shrine-falls',
      version: 1,
      to: 'reached',
      reason: 'Too late.'
    })
    expect(stale.payload.code).toBe('stale_version')
  })

  it('is refused in a gap between Arcs', () => {
    call('retire_arc', { version: version(), reason: 'Gone.' })
    const gap = call('resolve_beat', { beat: 'beat:x', version: 2, to: 'reached', reason: 'r' })
    expect(gap.payload.code).toBe('no_current_arc')
  })
})

describe('retire_arc', () => {
  it('abandons every pending Beat, returns them and points at arc-review', () => {
    call('create_arc', relicArc)
    call('resolve_beat', {
      beat: 'beat:the-vizier-is-the-patron',
      version: 1,
      to: 'reached',
      reason: 'Learned.'
    })

    const { payload } = call('retire_arc', { version: 2, reason: 'The relic was destroyed.' })

    expect(payload).toMatchObject({
      abandoned: [{ handle: 'beat:ambush-at-the-ford' }, { handle: 'beat:the-shrine-falls' }],
      arc: { state: 'retired' },
      skill: 'the-dungeon-master:arc-review'
    })
    expect(host.events(folder).at(-1)).toMatchObject({ kind: 'arc_retired', dmOnly: true })
  })
})

describe('revise_arc', () => {
  beforeEach(() => call('create_arc', relicArc))

  const revise = (ops: unknown[]) => call('revise_arc', { version: version(), ops })
  const titles = () =>
    call('arc').payload.current.acts.map((a: { name: string; beats: { title: string }[] }) => [
      a.name,
      a.beats.map((b) => b.title)
    ])

  it('applies every op at once as one DM-only Event and one new version', () => {
    const { isError, payload } = revise([
      { op: 'edit_arc', stakes: 'If the cult wins, Ashford burns first.' },
      { op: 'edit_beat', beat: 'beat:ambush-at-the-ford', title: 'Ambush at the Mill' },
      { op: 'add_act', before: 2, name: 'The Long Night', purpose: 'Survive the siege.' },
      { op: 'add_beat', act: 2, title: 'The Siege Breaks', description: 'Dawn comes, or not.' },
      { op: 'move_beat', beat: 'beat:the-vizier-is-the-patron', act: 3, position: 1 },
      { op: 'edit_act', act: 3, purpose: 'Reach the shrine with the vizier unmasked.' }
    ])

    expect(isError).toBe(false)
    expect(payload).toMatchObject({
      version: 2,
      stakes: 'If the cult wins, Ashford burns first.',
      added: ['beat:the-siege-breaks']
    })
    expect(titles()).toEqual([
      ['The Road Out', ['Ambush at the Mill']],
      ['The Long Night', ['The Siege Breaks']],
      ['The Burning Hills', ['The Vizier Is the Patron', 'The Shrine Falls']]
    ])
    expect(call('arc').payload.current.acts[2].purpose).toBe(
      'Reach the shrine with the vizier unmasked.'
    )
    expect(host.events(folder).at(-1)).toMatchObject({ kind: 'arc_revised', dmOnly: true })
  })

  it('refuses to edit or move a reached or abandoned Beat, and applies none of the ops', () => {
    call('resolve_beat', {
      beat: 'beat:ambush-at-the-ford',
      version: version(),
      to: 'abandoned',
      reason: 'The ford flooded.'
    })
    const before = titles()

    for (const op of [
      { op: 'edit_beat', beat: 'beat:ambush-at-the-ford', description: 'Changed.' },
      { op: 'move_beat', beat: 'beat:ambush-at-the-ford', act: 2 }
    ]) {
      const refused = revise([{ op: 'edit_arc', title: 'Renamed' }, op])
      expect(refused.payload.code).toBe('beat_not_pending')
    }
    expect(titles()).toEqual(before)
    expect(call('arc').payload.current).toMatchObject({ title: 'The Ember Relic', version: 2 })
  })

  it('refuses anything after the final Act', () => {
    for (const op of [
      { op: 'add_act', before: 3, name: 'Epilogue', purpose: 'Aftermath.' },
      { op: 'add_beat', act: 3, title: 'Later', description: 'After the end.' },
      { op: 'move_beat', beat: 'beat:the-shrine-falls', act: 3 },
      { op: 'edit_act', act: 3, name: 'Epilogue' }
    ]) {
      expect(revise([op]).payload.code).toBe('after_final_act')
    }
  })

  it('has no delete op: a dropped Beat is abandoned instead', () => {
    expect(revise([{ op: 'delete_beat', beat: 'beat:the-shrine-falls' }]).payload.code).toBe(
      'invalid_input'
    )
  })

  it('refuses a stale version', () => {
    call('revise_arc', { version: 1, ops: [{ op: 'edit_arc', title: 'Once' }] })
    const stale = call('revise_arc', { version: 1, ops: [{ op: 'edit_arc', title: 'Twice' }] })
    expect(stale.payload.code).toBe('stale_version')
  })
})

describe('what the Player sees', () => {
  it('holds no Arc event, Arc tool result or Arc text, after every Arc tool', () => {
    const wren = addCharacter(library, campaignId, fighterDraft('Wren'))
    call('create_arc', relicArc)
    library
      .floor(campaignId)
      .send({ character: wren, text: 'I ride for the ford.', player: SOLO_PLAYER })
    library.floor(campaignId).done(SOLO_PLAYER)
    call('arc', { history: true })
    call('resolve_beat', {
      beat: 'beat:the-vizier-is-the-patron',
      version: 1,
      to: 'reached',
      reason: 'The vizier slipped.'
    })
    call('revise_arc', {
      version: 2,
      ops: [{ op: 'add_beat', act: 2, title: 'A Hidden Turn', description: 'Hidden.' }]
    })
    call('narrate', { text: 'The road out of Ashford is quiet.' })
    call('retire_arc', { version: 3, reason: 'The relic was destroyed.' })

    const record = library.record(campaignId)
    const payloads = JSON.stringify([record.timeline('player'), record.journal('player'), pushed])

    expect(payloads).toContain('The road out of Ashford is quiet.')
    expect(payloads).not.toMatch(/Ember Relic|vizier|Hidden|beat:|arc|relic/i)
  })
})
