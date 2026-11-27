import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asc } from 'drizzle-orm'
import { addCharacter, fighterDraft } from '../lib/server/character/test-characters'
import { call, event, session } from '../lib/server/db/schema'
import { tempDir } from '../testing/temp-dir'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

vi.setConfig({ testTimeout: 20_000 })

let server: TestGameServer
let dm: FakeDm
let folder: string
let campaignId: string
let wren: string
let ash: string

beforeEach(async () => {
  const tmp = tempDir('audience')
  const home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  campaignId = server.library.create({ name: 'Ember Road', folder }).id
  wren = addCharacter(server.library, campaignId, fighterDraft('Wren'))
  ash = addCharacter(server.library, campaignId, fighterDraft('Ash'))
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)
})

afterEach(async () => {
  await dm.kill()
  await server.stop()
})

const db = () => server.library.databaseFor(folder)!
const entries = () => db().select().from(event).orderBy(asc(event.id)).all()
const narrations = () => entries().filter((e) => e.kind === 'narration')
const check = (character: string) => ({
  kind: 'check',
  character,
  skill: 'perception',
  tier: 'easy',
  reason: 'listening'
})

describe('Audience', () => {
  it('defaults a Narration to every Party Character, and a later Character is not added to it', async () => {
    await dm.call('narrate', { text: 'Rain falls.' })
    const late = addCharacter(server.library, campaignId, fighterDraft('Late'))
    await dm.call('narrate', { text: 'More rain.' })

    const [first, second] = narrations()
    expect([...first.audience].sort()).toEqual([wren, ash].sort())
    expect([...second.audience].sort()).toEqual([wren, ash, late].sort())
  })

  it('narrows a passed note to the Characters named in `to`', async () => {
    const out = await dm.call('narrate', { text: 'Psst.', to: ['char:ash'] })
    expect(out.isError).toBe(false)
    expect(narrations()[0].audience).toEqual([ash])
  })

  it('refuses an empty `to` and a non-Party Character', async () => {
    expect((await dm.call('narrate', { text: 'x', to: [] })).isError).toBe(true)
    expect((await dm.call('narrate', { text: 'x', to: ['npc:nobody'] })).isError).toBe(true)
    expect(narrations()).toHaveLength(0)
  })

  it('gives a Call the Audience of the Narration that raises it, and its rolls inherit it', async () => {
    await dm.call('narrate', { text: 'Listen.', to: ['char:ash'], call: check('char:ash') })
    const [open] = db().select().from(call).all()
    expect(open.audience).toEqual([ash])

    const part = server.play.timeline(campaignId, 'player').call!.parts[0]
    server.play.roll(campaignId, open.id, part.id, 'player')
    const rolls = entries().filter((e) => e.kind === 'roll')
    expect(rolls.length).toBeGreaterThan(0)
    for (const r of rolls) expect(r.audience).toEqual([ash])
  })

  it('refuses a Call that asks a Character its Narration leaves out', async () => {
    const out = await dm.call('narrate', {
      text: 'Listen.',
      to: ['char:ash'],
      call: check('char:wren')
    })
    expect(out.isError).toBe(true)
    expect(db().select().from(call).all()).toHaveLength(0)
    expect(narrations()).toHaveLength(0)
  })

  it('gives the Session summary the default Audience', async () => {
    await dm.call('narrate', { text: 'Rain falls.' })
    const out = await dm.call('close_session', { summary: 'It rained.', threads: [] })
    expect(out.isError).toBe(false)
    const [s] = db().select().from(session).all()
    expect([...s.summaryAudience!].sort()).toEqual([wren, ash].sort())
  })
})
