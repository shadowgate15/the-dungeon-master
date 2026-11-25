import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildLauncher } from '../../scripts/build-bridge/build'

/**
 * The launcher, run as the user runs it: the bundled `bin/dm.mjs` inside a plugin root, in a
 * child process, with a stub `claude` first on PATH and a temporary user-level state directory.
 */

const PLUGIN_ID = 'the-dungeon-master@the-dungeon-master'

let launcher: string

beforeAll(async () => {
  launcher = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dm-launcher-build-')), 'dm.mjs')
  await buildLauncher(launcher)
})

const fixtures: { cleanup(): void }[] = []

afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup()
})

/** A plugin root, a stub `claude`, a state directory and a folder to run `dm` in. */
async function setup({ version = '1.0.0' } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dm-launcher-')))
  const plugin = path.join(tmp, 'plugin')
  const home = path.join(tmp, 'home')
  const folder = path.join(tmp, 'campaign')
  const stubBin = path.join(tmp, 'stub-bin')
  for (const dir of [home, folder, stubBin, path.join(plugin, 'bin'), path.join(plugin, 'server')])
    fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(launcher, path.join(plugin, 'bin', 'dm.mjs'))
  fs.mkdirSync(path.join(plugin, '.claude-plugin'))
  fs.writeFileSync(
    path.join(plugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'the-dungeon-master', version })
  )

  fs.writeFileSync(path.join(plugin, 'server', 'index.js'), FAKE_SERVER)

  const claudeLog = path.join(tmp, 'claude-argv.log')
  const pluginList = path.join(tmp, 'plugin-list.json')
  fs.writeFileSync(
    pluginList,
    JSON.stringify([{ id: PLUGIN_ID, version, scope: 'user', enabled: true, installPath: plugin }])
  )
  // The stub records every argv (one JSON array per line) and answers `plugin list --json`.
  fs.writeFileSync(
    path.join(stubBin, 'claude'),
    `#!/bin/sh
node -e 'require("fs").appendFileSync(process.argv[1], JSON.stringify({argv: process.argv.slice(2), cwd: process.cwd()}) + "\\n")' "${claudeLog}" "$@"
if [ "$1" = "plugin" ] && [ "$2" = "list" ]; then cat "${pluginList}"; exit 0; fi
exit \${STUB_CLAUDE_EXIT:-0}
`,
    { mode: 0o755 }
  )

  const port = await freePort()
  const pids: number[] = []
  const fixture = {
    tmp,
    plugin,
    home,
    folder,

    /** Makes the folder a Campaign folder. */
    makeCampaign() {
      fs.mkdirSync(path.join(folder, '.dm'), { recursive: true })
      fs.writeFileSync(path.join(folder, '.dm', 'campaign.db'), '')
    },

    /** Replaces the canned `claude plugin list --json` answer. */
    pluginList(entries: unknown[]) {
      fs.writeFileSync(pluginList, JSON.stringify(entries))
    },

    /** Runs `dm` with the given args; `node` lets a test pretend to be an older Node. */
    dm(args: string[] = [], { node = [] as string[], cwd = folder, env = {} } = {}) {
      const result = spawnSync(
        process.execPath,
        [...node, path.join(plugin, 'bin', 'dm.mjs'), ...args],
        {
          cwd,
          encoding: 'utf8',
          timeout: 20_000,
          env: {
            ...process.env,
            PATH: `${stubBin}${path.delimiter}${process.env.PATH}`,
            DUNGEON_MASTER_HOME: home,
            DUNGEON_MASTER_PORT: String(port),
            ...env
          }
        }
      )
      return { code: result.status, stdout: result.stdout, stderr: result.stderr }
    },

    /** Every `claude` invocation the stub saw, oldest first. */
    claudeCalls(): { argv: string[]; cwd: string }[] {
      if (!fs.existsSync(claudeLog)) return []
      return fs
        .readFileSync(claudeLog, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    },

    /** The game server's runtime file, if one is written. */
    runtime(): { port: number; token: string; pid: number; version?: string } | undefined {
      const file = path.join(home, 'runtime.json')
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined
    },

    /** What the fake server recorded about how it was started. */
    serverStart(): { cwd: string; argv: string[]; origin?: string } {
      return JSON.parse(fs.readFileSync(path.join(home, 'fake-server-start.json'), 'utf8'))
    },

    /** Updates the plugin in place, as a plugin update would. */
    setVersion(next: string) {
      fs.writeFileSync(
        path.join(plugin, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: 'the-dungeon-master', version: next })
      )
    },

    /** Remembers a pid to kill when the test ends. */
    track(pid: number) {
      pids.push(pid)
    },

    cleanup() {
      const running = fixture.runtime()?.pid
      for (const pid of running ? [...pids, running] : pids) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          // already gone
        }
      }
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
  fixtures.push(fixture)
  return fixture
}

/**
 * A stand-in for the adapter-node server: listens on PORT, writes the runtime file with the
 * version it was given and answers `POST /api/bridge/register`. A file `attached` in the state
 * directory makes it report a live session.
 */
const FAKE_SERVER = `
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
const home = process.env.DUNGEON_MASTER_HOME
const token = 'fake-' + process.pid
fs.writeFileSync(path.join(home, 'fake-server-start.json'), JSON.stringify({ cwd: process.cwd(), argv: process.argv, origin: process.env.ORIGIN }))
const server = http.createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + token) return res.writeHead(401).end()
  if (req.method === 'GET' && req.url === '/api/bridge/tools') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ tools: [] }))
  }
  if (req.method === 'POST' && req.url === '/api/bridge/register') {
    let body = ''
    for await (const chunk of req) body += chunk
    const { folder } = JSON.parse(body)
    fs.appendFileSync(path.join(home, 'registered.log'), folder + '\\n')
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ id: 'c1', name: 'Fixture', attached: fs.existsSync(path.join(home, 'attached')) }))
  }
  res.writeHead(404).end()
})
server.listen(Number(process.env.PORT), process.env.HOST, () => {
  fs.writeFileSync(path.join(home, 'runtime.json'), JSON.stringify({
    port: Number(process.env.DUNGEON_MASTER_PORT), token, pid: process.pid, version: process.env.DUNGEON_MASTER_VERSION
  }))
})
`

/** A free localhost port for one test's server. */
async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const processGroup = (pid: number) =>
  Number(spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim())

const pretendNode = (version: string) => [
  '--import',
  `data:text/javascript,Object.defineProperty(process.versions,"node",{value:"${version}"})`
]

describe('dm', () => {
  it('refuses on a Node older than the minimum and names the minimum', async () => {
    const f = await setup()
    f.makeCampaign()
    const run = f.dm([], { node: pretendNode('22.12.0') })
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/Node 26 or later/)
    expect(run.stderr).toMatch(/22\.12\.0/)
    expect(f.claudeCalls()).toEqual([])
  })

  it('starts the game server detached, in its own process group, with the plugin version', async () => {
    const f = await setup({ version: '1.2.3' })
    f.makeCampaign()
    const run = f.dm()
    expect(run.code).toBe(0)
    const runtime = f.runtime()!
    expect(runtime.version).toBe('1.2.3')
    expect(alive(runtime.pid)).toBe(true)
    expect(processGroup(runtime.pid)).toBe(runtime.pid)
    expect(f.serverStart().cwd).toBe(path.join(f.plugin, 'server'))
    // adapter-node assumes https without it, and refuses the UI's form posts as cross-site.
    expect(f.serverStart().origin).toBe(`http://localhost:${runtime.port}`)
  })

  it('registers the folder, then runs claude with the dm agent and the dev-channels flag in it', async () => {
    const f = await setup()
    f.makeCampaign()
    const run = f.dm(['--resume'], { env: { STUB_CLAUDE_EXIT: '7' } })
    expect(run.code).toBe(7)
    expect(fs.readFileSync(path.join(f.home, 'registered.log'), 'utf8')).toBe(`${f.folder}\n`)
    expect(f.claudeCalls().at(-1)).toEqual({
      argv: [
        '--agent',
        'the-dungeon-master:dm',
        '--dangerously-load-development-channels',
        `plugin:${PLUGIN_ID}`,
        '--resume'
      ],
      cwd: f.folder
    })
  })

  it('refuses when the plugin is installed but not enabled for this folder', async () => {
    const f = await setup()
    f.makeCampaign()
    f.pluginList([
      { id: 'other@market', enabled: true, scope: 'user', installPath: '/x' },
      {
        id: PLUGIN_ID,
        enabled: false,
        scope: 'project',
        projectPath: '/somewhere/else',
        installPath: f.plugin
      }
    ])
    const run = f.dm()
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/not enabled for this folder/)
    expect(run.stderr).toContain(`claude plugin enable ${PLUGIN_ID}`)
    expect(f.runtime()).toBeUndefined()
    expect(f.claudeCalls().map((c) => c.argv.slice(0, 2))).toEqual([['plugin', 'list']])
  })

  it('refuses when the plugin is not installed at all', async () => {
    const f = await setup()
    f.makeCampaign()
    f.pluginList([])
    const run = f.dm()
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/not installed/)
    expect(run.stderr).toContain('claude plugin install')
    expect(f.runtime()).toBeUndefined()
  })

  it('refuses outside a Campaign folder and points to the web UI, which it starts', async () => {
    const f = await setup()
    const run = f.dm()
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/not a Campaign folder/)
    expect(run.stderr).toContain(`http://localhost:${f.runtime()!.port}/campaigns`)
    expect(alive(f.runtime()!.pid)).toBe(true)
    expect(fs.existsSync(path.join(f.home, 'registered.log'))).toBe(false)
    expect(f.claudeCalls()).toEqual([])
  })

  it('refuses up front when the Campaign already has a live session', async () => {
    const f = await setup()
    f.makeCampaign()
    fs.writeFileSync(path.join(f.home, 'attached'), '')
    const run = f.dm()
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/Fixture already has a DM session/)
    expect(f.claudeCalls().map((c) => c.argv.slice(0, 2))).toEqual([['plugin', 'list']])
  })

  it('reuses a server already running this plugin version', async () => {
    const f = await setup()
    f.makeCampaign()
    f.dm()
    const first = f.runtime()!.pid
    expect(f.dm().code).toBe(0)
    expect(f.runtime()!.pid).toBe(first)
  })

  it('restarts a server still running from a stale plugin version', async () => {
    const f = await setup({ version: '1.0.0' })
    f.makeCampaign()
    f.dm()
    const stale = f.runtime()!.pid
    f.track(stale)
    f.setVersion('1.1.0')
    expect(f.dm().code).toBe(0)
    const fresh = f.runtime()!
    expect(fresh.version).toBe('1.1.0')
    expect(fresh.pid).not.toBe(stale)
    expect(alive(fresh.pid)).toBe(true)
    expect(alive(stale)).toBe(false)
  })

  it('refuses before restarting a stale server whose Campaign has a live session', async () => {
    const f = await setup({ version: '1.0.0' })
    f.makeCampaign()
    f.dm()
    const stale = f.runtime()!.pid
    f.track(stale)
    fs.writeFileSync(path.join(f.home, 'attached'), '')
    f.setVersion('1.1.0')
    const run = f.dm()
    expect(run.code).toBe(1)
    expect(run.stderr).toMatch(/Fixture already has a DM session/)
    // The live session's server is left running.
    expect(alive(stale)).toBe(true)
    expect(f.runtime()!.pid).toBe(stale)
  })

  it('never signals a process that only reuses a dead server pid', async () => {
    const f = await setup()
    const stranger = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' })
    f.track(stranger.pid!)
    fs.writeFileSync(
      path.join(f.home, 'runtime.json'),
      JSON.stringify({ port: 1, token: 'old', pid: stranger.pid, version: '0.9.0' })
    )
    const stop = f.dm(['stop'], { cwd: f.tmp })
    expect(stop.code).toBe(0)
    expect(stop.stdout).toMatch(/not running/)
    expect(alive(stranger.pid!)).toBe(true)
    expect(f.runtime()).toBeUndefined()

    fs.writeFileSync(
      path.join(f.home, 'runtime.json'),
      JSON.stringify({ port: 1, token: 'old', pid: stranger.pid, version: '0.9.0' })
    )
    f.makeCampaign()
    expect(f.dm().code).toBe(0)
    expect(alive(stranger.pid!)).toBe(true)
    expect(f.runtime()!.pid).not.toBe(stranger.pid)
  })

  it('leaves the server running after claude exits, until dm stop', async () => {
    const f = await setup()
    f.makeCampaign()
    expect(f.dm().code).toBe(0)
    const { pid } = f.runtime()!
    expect(alive(pid)).toBe(true)

    const stop = f.dm(['stop'], { cwd: f.tmp })
    expect(stop.code).toBe(0)
    expect(stop.stdout).toMatch(/stopped/)
    expect(alive(pid)).toBe(false)
    expect(f.runtime()).toBeUndefined()
  })

  it('dm stop says so when no server is running', async () => {
    const f = await setup()
    const stop = f.dm(['stop'])
    expect(stop.code).toBe(0)
    expect(stop.stdout).toMatch(/not running/)
  })

  it('installs a dm shim on the terminal PATH that runs the installed plugin', async () => {
    const f = await setup()
    const user = path.join(f.tmp, 'user')
    const install = f.dm(['install-shim'], { env: { HOME: user } })
    expect(install.code).toBe(0)
    expect(install.stdout).toBe('')

    const shim = path.join(user, '.local', 'bin', 'dm')
    fs.accessSync(shim, fs.constants.X_OK)
    const viaShim = spawnSync(shim, ['stop'], {
      cwd: f.folder,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${path.join(f.tmp, 'stub-bin')}${path.delimiter}${process.env.PATH}`,
        DUNGEON_MASTER_HOME: f.home
      }
    })
    expect(viaShim.stderr).toBe('')
    expect(viaShim.stdout).toMatch(/not running/)
  })

  it('leaves a dm of the user own on the PATH alone, and says so', async () => {
    const f = await setup()
    const user = path.join(f.tmp, 'user')
    const shim = path.join(user, '.local', 'bin', 'dm')
    fs.mkdirSync(path.dirname(shim), { recursive: true })
    fs.writeFileSync(shim, '#!/bin/sh\necho mine\n', { mode: 0o755 })
    const install = f.dm(['install-shim'], { env: { HOME: user } })
    expect(install.code).toBe(0)
    expect(install.stderr).toMatch(/not written/)
    expect(fs.readFileSync(shim, 'utf8')).toBe('#!/bin/sh\necho mine\n')
  })

  it('replaces an older shim of its own', async () => {
    const f = await setup()
    const user = path.join(f.tmp, 'user')
    const shim = path.join(user, '.local', 'bin', 'dm')
    fs.mkdirSync(path.dirname(shim), { recursive: true })
    fs.writeFileSync(
      shim,
      "#!/bin/sh\n# Written by The Dungeon Master plugin's SessionStart hook. old\n",
      { mode: 0o755 }
    )
    expect(f.dm(['install-shim'], { env: { HOME: user } }).code).toBe(0)
    expect(fs.readFileSync(shim, 'utf8')).toContain('bin/dm.mjs')
  })
})
