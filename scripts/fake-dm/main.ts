import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { userStateDir } from '../../src/lib/server/campaign/paths.ts'
import { startFakeDm, type FakeDm, type Step } from '../../src/testing/fake-dm.ts'

/**
 * `pnpm fake-dm <folder> <script>`: attach the e2e fake DM to a running game server for a
 * Campaign folder and run a script, so the play screen can be driven without Claude.
 *
 * The script's default export is either `async (dm) => {…}`, given the fake DM handle (`call`,
 * `script`, `settled`, …), or a list of steps `{on, run?}` answered in order, as in e2e.
 */
const USAGE = `Usage: pnpm fake-dm <folder> <script> [--home <dir>] [--timeout <ms>]

  folder   a Campaign folder registered with the running game server
  script   a JS or TS module whose default export is async (dm) => {…} or a list of steps
  --home   the user state directory holding runtime.json (default: ${userStateDir()})
  --timeout  how long a list of steps may wait for its events (default: 10 minutes)`

type Script = ((dm: FakeDm) => unknown) | Step[]

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { home: { type: 'string' }, timeout: { type: 'string' } }
  })
  const [folder, scriptPath] = positionals
  if (!folder || !scriptPath) {
    console.error(USAGE)
    return 2
  }

  const script = await loadScript(scriptPath)
  const dm = await startFakeDm({
    folder: path.resolve(folder),
    home: values.home ?? userStateDir()
  })
  try {
    if (typeof script === 'function') {
      await script(dm)
    } else {
      dm.script(...script)
      await dm.settled(Number(values.timeout ?? 10 * 60_000))
    }
    await dm.close()
  } catch (error) {
    await dm.kill()
    throw error
  }
  return 0
}

async function loadScript(file: string): Promise<Script> {
  const module = await import(pathToFileURL(path.resolve(file)).href)
  const script = module.default
  if (typeof script === 'function' || Array.isArray(script)) return script
  throw new Error(`${file} must export default a function (dm) => {…} or a list of steps`)
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
)
