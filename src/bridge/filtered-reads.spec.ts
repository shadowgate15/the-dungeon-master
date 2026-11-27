import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOLO_PLAYER } from '../lib/character/enums'
import { addCharacter, fighterDraft } from '../lib/server/character/test-characters'
import { call } from '../lib/server/db/schema'
import { tempDir } from '../testing/temp-dir'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

vi.setConfig({ testTimeout: 20_000 })

const HOST = SOLO_PLAYER
const GUEST = 'guest-browser'
const STRANGER = 'no-claims-browser'

let server: TestGameServer
let dm: FakeDm
let folder: string
let campaignId: string
let wren: string
let ash: string

beforeEach(async () => {
  const tmp = tempDir('filtered-reads')
  const home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  campaignId = server.library.create({ name: 'Ember Road', folder }).id
  wren = addCharacter(server.library, campaignId, fighterDraft('Wren'))
  ash = addCharacter(server.library, campaignId, fighterDraft('Ash'))
  // The Host holds Wren, the guest holds Ash.
  server.play.letGo(campaignId, ash, HOST)
  server.play.claim(campaignId, ash, GUEST)
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)
})

afterEach(async () => {
  await dm.kill()
  await server.stop()
})

const texts = (browser: string) =>
  server.play.timeline(campaignId, browser).entries.flatMap((e) => ('text' in e ? [e.text] : []))
const check = {
  kind: 'check',
  character: 'char:ash',
  skill: 'perception',
  tier: 'easy',
  reason: 'listening'
}

describe('reads filtered by Claims', () => {
  it('keeps a passed note out of every other browser, and tags it in the Timeline', async () => {
    await dm.call('narrate', { text: 'Rain falls.' })
    await dm.call('narrate', { text: 'Psst, Ash.', to: ['char:ash'] })

    expect(texts(GUEST)).toEqual(['Rain falls.', 'Psst, Ash.'])
    expect(texts(HOST)).toEqual(['Rain falls.'])
    const entries = server.play.timeline(campaignId, GUEST).entries
    expect(entries.map((e) => ('audience' in e ? e.audience : undefined))).toEqual([
      undefined,
      ['Ash']
    ])
  })

  it('shows a Call only to a browser its Audience reaches', async () => {
    await dm.call('narrate', { text: 'Listen.', to: ['char:ash'], call: check })

    expect(server.play.timeline(campaignId, GUEST).call).not.toBeNull()
    expect(server.play.timeline(campaignId, HOST).call).toBeNull()
    expect(server.play.timeline(campaignId, STRANGER).call).toBeNull()
    const [open] = server.library.databaseFor(folder)!.select().from(call).all()
    expect(open.audience).toEqual([ash])
  })

  it('returns only Claimed Characters in the sheets', () => {
    expect(server.play.sheets(campaignId, HOST).map((s) => s.id)).toEqual([wren])
    expect(server.play.sheets(campaignId, GUEST).map((s) => s.id)).toEqual([ash])
  })

  it('filters the Journal to the Beliefs of Claimed Characters', async () => {
    const established = await dm.call('establish', {
      type: 'npc',
      name: 'Mira Voss',
      fields: { description: 'A smuggler', role: 'fence', status: 'alive' },
      facts: [{ claim: 'Mira owes money' }]
    })
    const fact = (established.payload.facts as number[])[0]
    await dm.call('reveal', { of: fact, holders: ['char:ash'] })

    expect(server.play.journal(campaignId, GUEST).entries).toHaveLength(1)
    expect(server.play.journal(campaignId, HOST).entries).toHaveLength(0)
  })

  it('shows a Session summary only to browsers its Audience reaches', async () => {
    await dm.call('narrate', { text: 'Rain falls.' })
    await dm.call('close_session', { summary: 'It rained.', threads: [] })
    expect(server.play.sessionHistory(campaignId, HOST).sessions).toHaveLength(1)

    const db = server.library.databaseFor(folder)!
    const { session } = await import('../lib/server/db/schema')
    db.update(session)
      .set({ summaryAudience: [ash] })
      .run()
    expect(server.play.sessionHistory(campaignId, HOST).sessions).toHaveLength(0)
    expect(server.play.sessionHistory(campaignId, GUEST).sessions).toHaveLength(1)
  })

  it('brings past passed notes on Claim and takes them away on Let go', async () => {
    await dm.call('narrate', { text: 'Psst, Ash.', to: ['char:ash'] })
    expect(texts(HOST)).toEqual([])

    server.play.letGo(campaignId, ash, GUEST)
    server.play.claim(campaignId, ash, HOST)
    expect(texts(GUEST)).toEqual([])
    expect(texts(HOST)).toEqual(['Psst, Ash.'])

    server.play.letGo(campaignId, ash, HOST)
    expect(texts(HOST)).toEqual([])
  })

  it('gives a browser with no Claims empty per-Player reads, not an error', async () => {
    await dm.call('narrate', { text: 'Rain falls.' })
    await dm.call('close_session', { summary: 'It rained.', threads: [] })

    expect(server.play.timeline(campaignId, STRANGER).entries).toEqual([])
    expect(server.play.journal(campaignId, STRANGER).entries).toEqual([])
    expect(server.play.sheets(campaignId, STRANGER)).toEqual([])
    expect(server.play.sessionHistory(campaignId, STRANGER).sessions).toEqual([])
  })
})
