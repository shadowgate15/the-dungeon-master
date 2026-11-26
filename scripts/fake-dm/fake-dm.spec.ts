import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tempDir } from '../../src/testing/temp-dir'
import { startTestGameServer, type TestGameServer } from '../../src/testing/game-server'

// The CLI spawns a real bridge process; give it room when the whole suite is running.
vi.setConfig({ testTimeout: 20_000 })

const CLI = path.resolve(import.meta.dirname, 'main.ts')

let tmp: string
let home: string
let server: TestGameServer
let folder: string

beforeEach(async () => {
  tmp = tempDir('fake-cli')
  home = path.join(tmp, 'home')
  server = await startTestGameServer({ home })
  folder = path.join(tmp, 'ember-road')
  server.library.create({ name: 'Ember Road', folder })
})

afterEach(async () => {
  await server.stop()
})

/** Runs `pnpm fake-dm` as a child process, so the in-process test server keeps answering. */
function fakeDm(...args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, DUNGEON_MASTER_HOME: home }
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function writeScript(name: string, source: string) {
  const file = path.join(tmp, name)
  fs.writeFileSync(file, source)
  return file
}

describe('pnpm fake-dm', () => {
  it('attaches to the running server for the folder and runs a script function', async () => {
    const script = writeScript(
      'narrate.mjs',
      `export default async (dm) => {
        const { isError } = await dm.call('narrate', { text: 'Rain drums on the inn roof.' })
        if (isError) throw new Error('narrate refused')
      }`
    )

    const run = await fakeDm(folder, script)

    expect(run).toMatchObject({ code: 0 })
    expect(server.requests()).toContain('POST /api/bridge/call')
    const campaign = server.library.list().find((c) => c.name === 'Ember Road')!
    expect(server.play.timeline(campaign.id).entries).toContainEqual(
      expect.objectContaining({ type: 'narration', text: 'Rain drums on the inn roof.' })
    )
  })

  it('runs a list of steps against channel events', async () => {
    const script = writeScript(
      'begin.mjs',
      `export default [{ on: 'begin', run: (event) => console.log('heard', event.content) }]`
    )

    const running = fakeDm(folder, script)
    await server.whenListening(folder)
    server.channels.send(folder, { content: 'The Player pressed Begin', meta: { kind: 'begin' } })

    expect(await running).toMatchObject({ code: 0, stdout: expect.stringContaining('heard') })
  })

  it('fails with the reason when the script throws', async () => {
    const script = writeScript('boom.mjs', `export default async () => { throw new Error('boom') }`)

    const run = await fakeDm(folder, script)

    expect(run.code).not.toBe(0)
    expect(run.stderr).toContain('boom')
  })

  it('prints usage without a folder and a script', async () => {
    const run = await fakeDm()

    expect(run.code).not.toBe(0)
    expect(run.stderr).toContain('Usage: pnpm fake-dm <folder> <script>')
  })
})
