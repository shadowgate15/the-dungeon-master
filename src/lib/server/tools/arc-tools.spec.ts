import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCampaignLibrary, type CampaignLibrary } from '../campaign/library'
import { gameTools } from '.'
import { createToolHost, type ToolHost } from './host'

let library: CampaignLibrary
let host: ToolHost
let folder: string
let campaignId: string

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-arc-'))
  library = createCampaignLibrary({ home: path.join(tmp, 'home') })
  folder = path.join(tmp, 'campaigns', 'ember-road')
  campaignId = library.create({ name: 'Ember Road', folder }).id
  host = createToolHost({ library, tools: gameTools, publish: () => {} })
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
    expect(JSON.stringify(library.record(campaignId).timeline())).not.toMatch(/Ember Relic|vizier/i)
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
