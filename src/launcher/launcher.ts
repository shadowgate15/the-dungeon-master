import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { campaignDatabasePath, userStateDir } from '../lib/server/campaign/paths'
import { readRuntimeFile, runtimeFilePath, type Runtime } from '../lib/server/runtime'

/** The plugin's name: its agent, MCP tools and marketplace id are all keyed by it. */
export const PLUGIN_NAME = 'the-dungeon-master'

/** The oldest Node major the plugin runs on. */
export const NODE_MINIMUM = 26

/** The game server's known localhost port, unless overridden. */
const DEFAULT_PORT = 4777

/** How long a freshly started server gets to come up. */
const START_TIMEOUT_MS = 15_000

/** Where the browser reaches the server: the origin the server is told it has. */
const uiUrl = (port: number) => `http://localhost:${port}`

class LauncherError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Resolves true once something accepts connections on the localhost port. */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

type Context = {
  /** The plugin root this launcher runs from: `${CLAUDE_PLUGIN_ROOT}`. */
  pluginRoot: string
  /** The plugin's version, from its manifest. */
  version: string
  home: string
  port: number
  env: NodeJS.ProcessEnv
  /** Whether this run asked for LAN mode with `--lan`. */
  lan: boolean
}

type Mode = 'local' | 'lan'

function pluginVersion(pluginRoot: string): string {
  const manifest = path.join(pluginRoot, '.claude-plugin', 'plugin.json')
  return (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version: string }).version
}

/**
 * Starts the server from this plugin root, detached in its own process group so it outlives the
 * terminal and the `claude` session, and waits until it listens.
 */
async function startServer(ctx: Context, mode: Mode): Promise<Runtime> {
  const serverDir = path.join(ctx.pluginRoot, 'server')
  fs.mkdirSync(ctx.home, { recursive: true })
  const logFile = path.join(ctx.home, 'server.log')
  const log = fs.openSync(logFile, 'a')
  const child = spawn(process.execPath, [path.join(serverDir, 'index.js')], {
    // The server finds its migrations relative to its own directory.
    cwd: serverDir,
    detached: true,
    stdio: ['ignore', log, log],
    env: {
      ...ctx.env,
      DUNGEON_MASTER_LAN: '',
      DUNGEON_MASTER_HOME: ctx.home,
      DUNGEON_MASTER_PORT: String(ctx.port),
      DUNGEON_MASTER_VERSION: ctx.version,
      PORT: String(ctx.port),
      // LAN mode binds every interface, which still covers loopback for the launcher and bridge.
      HOST: mode === 'lan' ? '0.0.0.0' : '127.0.0.1',
      ...(mode === 'lan' ? { DUNGEON_MASTER_LAN: '1' } : {}),
      // adapter-node assumes https otherwise, and refuses the UI's form posts as cross-site.
      ORIGIN: uiUrl(ctx.port)
    }
  })
  fs.closeSync(log)
  let exited = false
  child.once('exit', () => (exited = true))
  child.unref()

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline && !exited) {
    const runtime = readRuntimeFile(ctx.home)
    if (runtime && runtime.pid === child.pid && (await listening(runtime.port))) return runtime
    await sleep(50)
  }
  throw new LauncherError(`The game server failed to start; see ${logFile}`)
}

/** Signals the server's process group, or just the process if it leads none. */
function signal(pid: number, name: NodeJS.Signals) {
  try {
    process.kill(-pid, name)
  } catch {
    try {
      process.kill(pid, name)
    } catch {
      // already gone
    }
  }
}

/** Stops a running server and removes its runtime file. */
async function stopServer(ctx: Context, runtime: Runtime) {
  signal(runtime.pid, 'SIGTERM')
  const deadline = Date.now() + 5_000
  while (alive(runtime.pid) && Date.now() < deadline) await sleep(50)
  if (alive(runtime.pid)) signal(runtime.pid, 'SIGKILL')
  while (alive(runtime.pid)) await sleep(20)
  if (readRuntimeFile(ctx.home)?.pid === runtime.pid) fs.rmSync(runtimeFilePath(ctx.home))
}

/**
 * The game server the runtime file names, if it is really running: the pid alone may have been
 * reused by another process after a crash or reboot, so the server must answer with its token.
 * A runtime file naming no live server is removed.
 */
async function runningServer(ctx: Context): Promise<Runtime | undefined> {
  const runtime = readRuntimeFile(ctx.home)
  if (!runtime) return undefined
  if (alive(runtime.pid)) {
    try {
      const res = await fetch(`http://127.0.0.1:${runtime.port}/api/bridge/tools`, {
        headers: { authorization: `Bearer ${runtime.token}` },
        signal: AbortSignal.timeout(2_000)
      })
      if (res.ok) return runtime
    } catch {
      // not our server
    }
  }
  if (readRuntimeFile(ctx.home)?.pid === runtime.pid) fs.rmSync(runtimeFilePath(ctx.home))
  return undefined
}

/**
 * The server for this plugin version and mode: the running one, or a fresh one replacing a stale
 * one. A fresh start is localhost-only unless `--lan` asked for LAN mode.
 * `beforeRestart` may refuse (by throwing) before a stale server is stopped.
 */
async function ensureServer(
  ctx: Context,
  beforeRestart?: (stale: Runtime) => Promise<void>
): Promise<Runtime> {
  const running = await runningServer(ctx)
  // A plain dm reuses a LAN server as-is, and a version restart keeps the mode; only --lan
  // switches a localhost server, through the same restart path.
  const current: Mode = running?.mode === 'lan' ? 'lan' : 'local'
  const wanted: Mode = ctx.lan ? 'lan' : current
  if (running) {
    if (running.version === ctx.version && current === wanted) return running
    await beforeRestart?.(running)
    await stopServer(ctx, running)
  }
  return startServer(ctx, wanted)
}

type InstalledPlugin = { id: string; enabled: boolean; installPath?: string }

/** `claude plugin list --json` for the current folder. */
function installedPlugins(): InstalledPlugin[] {
  const run = spawnSync('claude', ['plugin', 'list', '--json'], { encoding: 'utf8' })
  if (run.error || run.status !== 0) {
    throw new LauncherError('Could not run `claude plugin list --json`. Is Claude Code installed?')
  }
  const parsed = JSON.parse(run.stdout) as InstalledPlugin[] | { plugins: InstalledPlugin[] }
  return Array.isArray(parsed) ? parsed : parsed.plugins
}

/**
 * This plugin's `<name>@<marketplace>` id. Project-scope installs are per folder, so the plugin
 * can be listed here yet be off: it must be enabled for this folder, or the session has no tools.
 */
function enabledPluginId(): string {
  const ours = installedPlugins().filter((p) => p.id.startsWith(`${PLUGIN_NAME}@`))
  const enabled = ours.find((p) => p.enabled)
  if (enabled) return enabled.id
  if (ours.length > 0) {
    throw new LauncherError(
      `The Dungeon Master plugin is installed but not enabled for this folder. ` +
        `Enable it with \`claude plugin enable ${ours[0].id}\`, then run dm again.`
    )
  }
  throw new LauncherError(
    `The Dungeon Master plugin is not installed. Install it with ` +
      `\`claude plugin install ${PLUGIN_NAME}@${PLUGIN_NAME}\`, then run dm again.`
  )
}

type RegisteredCampaign = { id: string; name: string; attached: boolean }

/** Registers the Campaign folder with the server; resolves whether a session is attached. */
async function register(runtime: Runtime, folder: string): Promise<RegisteredCampaign> {
  const response = await fetch(`http://127.0.0.1:${runtime.port}/api/bridge/register`, {
    method: 'POST',
    headers: { authorization: `Bearer ${runtime.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ folder })
  })
  if (!response.ok) {
    throw new LauncherError(`The game server refused to register ${folder} (${response.status}).`)
  }
  return (await response.json()) as RegisteredCampaign
}

/** Refuses a restart that would cut a live Session off. */
function refuseRestartIfAttached(campaign: RegisteredCampaign) {
  if (campaign.attached) {
    throw new LauncherError(
      `${campaign.name} already has a DM session at the table. End the Session first.`
    )
  }
}

function refuseIfAttached(campaign: RegisteredCampaign) {
  if (campaign.attached) {
    throw new LauncherError(
      `${campaign.name} already has a DM session at the table. ` +
        `End that session before starting another.`
    )
  }
}

/**
 * Runs the DM's `claude` in this terminal, so its trust, MCP consent and dev-channels prompts
 * show where they work, and resolves to its exit code.
 */
function runClaude(pluginId: string, folder: string, extra: string[]): Promise<number> {
  const args = [
    '--agent',
    `${PLUGIN_NAME}:dm`,
    '--dangerously-load-development-channels',
    `plugin:${pluginId}`,
    ...extra
  ]
  const child = spawn('claude', args, { cwd: folder, stdio: 'inherit' })
  // Ctrl-C belongs to claude, which shares this terminal; the launcher just waits for it.
  const ignore = () => {}
  process.on('SIGINT', ignore)
  return new Promise((resolve) =>
    child.once('exit', (code, signal) => {
      process.off('SIGINT', ignore)
      resolve(code ?? (signal ? 1 : 0))
    })
  )
}

/**
 * The `dm` command for the user's terminal. `bin/` is only on Claude's own PATH, and the plugin
 * root changes with every update, so the shim looks up the current install on each run.
 */
const SHIM_MARKER = "# Written by The Dungeon Master plugin's SessionStart hook."

const SHIM = `#!/bin/sh
${SHIM_MARKER} Runs the installed plugin's launcher.
root=$(claude plugin list --json 2>/dev/null | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      const list = JSON.parse(s)
      const ours = (Array.isArray(list) ? list : list.plugins).filter((p) => p.id.startsWith("${PLUGIN_NAME}@"))
      const pick = ours.find((p) => p.enabled) ?? ours[0]
      if (pick) process.stdout.write(pick.installPath)
    } catch {}
  })
')
if [ -z "$root" ]; then
  echo "dm: The Dungeon Master plugin is not installed. Install it with: claude plugin install ${PLUGIN_NAME}@${PLUGIN_NAME}" >&2
  exit 1
fi
exec node "$root/bin/dm.mjs" "$@"
`

/**
 * Writes the `dm` shim to `~/.local/bin`, quietly: the SessionStart hook runs this every session.
 * A `dm` that isn't one of the plugin's shims is the user's own and is left alone.
 */
function installShim() {
  const dir = path.join(os.homedir(), '.local', 'bin')
  const shim = path.join(dir, 'dm')
  if (fs.existsSync(shim)) {
    const existing = fs.readFileSync(shim, 'utf8')
    if (existing === SHIM) return
    if (!existing.split('\n', 2)[1]?.startsWith(SHIM_MARKER)) {
      process.stderr.write(`dm: ${shim} is not The Dungeon Master's shim, so it was not written.\n`)
      return
    }
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(shim, SHIM, { mode: 0o755 })
  fs.chmodSync(shim, 0o755)
}

/** Where Players on the network reach the game, and what to check when they can't. */
const FIREWALL_HINT =
  'dm: if a device cannot connect, allow incoming connections for node in your firewall.'

/** Runs `dm [--lan] [stop | install-shim]` and resolves to the exit code. */
export async function runLauncher(
  args: string[],
  {
    env = process.env,
    cwd = process.cwd(),
    pluginRoot = path.resolve(import.meta.dirname, '..')
  } = {}
): Promise<number> {
  const node = process.versions.node
  if (Number(node.split('.')[0]) < NODE_MINIMUM) {
    return fail(`The Dungeon Master needs Node ${NODE_MINIMUM} or later; this is Node ${node}.`)
  }
  const lan = args.includes('--lan')
  // --lan is the launcher's: claude never sees it.
  args = args.filter((arg) => arg !== '--lan')
  const ctx: Context = {
    lan,
    pluginRoot,
    version: pluginVersion(pluginRoot),
    home: userStateDir(env),
    port: Number(env.DUNGEON_MASTER_PORT || DEFAULT_PORT),
    env
  }
  try {
    if (args[0] === 'install-shim') {
      installShim()
      return 0
    }
    if (args[0] === 'stop') {
      if (lan) return fail('dm stop does not take --lan: stopping the server ends LAN mode.')
      const running = await runningServer(ctx)
      if (!running) {
        process.stdout.write('dm: the game server is not running.\n')
        return 0
      }
      await stopServer(ctx, running)
      process.stdout.write('dm: the game server stopped.\n')
      return 0
    }
    if (!fs.existsSync(campaignDatabasePath(cwd))) {
      // A Campaign is only ever created in the UI, so make sure there is one to point to.
      const runtime = await ensureServer(ctx)
      if (lan) {
        printJoinUrls(runtime)
        process.stdout.write('dm: Players can join once a Session is live.\n')
      }
      return fail(
        `${cwd} is not a Campaign folder. Create or open a Campaign in the web UI at ` +
          `${uiUrl(runtime.port)}/campaigns, then run dm in its folder.`
      )
    }
    const pluginId = enabledPluginId()
    // A stale server may still hold this Campaign's live session: ask it before restarting, since
    // the session's bridge only reconnects after the restart.
    const runtime = await ensureServer(ctx, async (stale) =>
      refuseRestartIfAttached(await register(stale, cwd))
    )
    const campaign = await register(runtime, cwd)
    refuseIfAttached(campaign)
    process.stdout.write(
      `dm: ${campaign.name} is at ${uiUrl(runtime.port)}/campaigns/${campaign.id}\n`
    )
    printJoinUrls(runtime)
    return await runClaude(pluginId, cwd, args)
  } catch (e) {
    if (e instanceof LauncherError) return fail(e.message)
    throw e
  }
}

/** The join URLs one per line, then the firewall hint; nothing for a localhost-only server. */
function printJoinUrls(runtime: Runtime) {
  if (runtime.mode !== 'lan') return
  for (const url of runtime.joinUrls ?? []) process.stdout.write(`${url}\n`)
  process.stdout.write(`${FIREWALL_HINT}\n`)
}

function fail(message: string) {
  process.stderr.write(`dm: ${message}\n`)
  return 1
}
