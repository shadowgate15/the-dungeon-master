import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { addCharacter, fighterDraft } from '../lib/server/character/test-characters'
import { startFakeDm, type FakeDm } from '../testing/fake-dm'
import { startTestGameServer, type TestGameServer } from '../testing/game-server'

// Each test spawns a real bridge process; give it room when the whole suite is running.
vi.setConfig({ testTimeout: 20_000 })

let home: string
let server: TestGameServer
let folder: string
let campaignId: string
let dm: FakeDm | undefined

beforeEach(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-turn-'))
  home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  campaignId = server.library.create({ name: 'Ember Road', folder }).id
})

afterEach(async () => {
  await dm?.kill()
  await server.stop()
})

it('a DM attaching opens a Session, and one play turn runs Floor to Narration within it', async () => {
  const wren = addCharacter(server.library, campaignId, fighterDraft('Wren'))
  dm = await startFakeDm({ folder, home })
  await server.whenListening(folder)

  server.library.floor(campaignId).send({ character: wren, text: 'I pick the lock.' })
  dm.script({
    on: 'floor',
    run: async (event) => {
      expect(event.content).toBe('[d1 Wren · player] I pick the lock.')
      expect((await dm!.call('narrate', { text: 'The lock clicks open.' })).isError).toBe(false)
    }
  })
  server.play.done(campaignId)
  await dm.settled()

  // The offline Character save is logged with no Session; the turn is in the Session.
  const [added, ...logged] = server.host.events(folder)
  expect(added).toMatchObject({ kind: 'change', session: null })
  expect(logged.map((e) => e.kind)).toEqual(['declaration', 'narration'])
  expect(logged.every((e) => e.session !== null && e.session === logged[0].session)).toBe(true)
  expect(server.play.timeline(campaignId).awaitingSince).toBeNull()
  await dm.close()
})
