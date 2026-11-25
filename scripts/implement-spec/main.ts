// Runs a spec's tickets as a deterministic loop. See README.md beside this file.
//
//   pnpm implement-spec <spec#> [--explore]
//   pnpm implement-spec <spec#> --status
import { existsSync, readFileSync } from 'node:fs'
import { createLogUpdate } from 'log-update'
import { render } from './chart.ts'
import { createClaude, createGit, createTracker } from './ports.ts'
import { runPaths, runSpec, type RunState } from './run-spec.ts'

const USAGE = 'usage: pnpm implement-spec <spec#> [--explore | --status]'
const FLAGS = ['--explore', '--status']

const parse = (args: string[]) => {
  const positional = args.filter((arg) => !arg.startsWith('--'))
  const flags = args.filter((arg) => arg.startsWith('--'))
  const unknown = flags.filter((flag) => !FLAGS.includes(flag))
  const spec = Number(positional[0])
  const explore = flags.includes('--explore')
  const status = flags.includes('--status')
  if (positional.length !== 1 || !Number.isInteger(spec) || spec <= 0 || unknown.length > 0) {
    return null
  }
  if (explore && status) return null
  return { spec, explore, status }
}

/** Sleeps until `time`, in steps short enough for `setTimeout`'s 32-bit delay. */
const waitUntil = async (time: number) => {
  for (let left = time - Date.now(); left > 0; left = time - Date.now()) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(left, 60 * 60 * 1000)))
  }
}

const parsed = parse(process.argv.slice(2))
if (!parsed) {
  console.error(USAGE)
  process.exit(2)
}

const tty = process.stdout.isTTY === true
const color = tty && !('NO_COLOR' in process.env)

/**
 * The chart for `state`, sized to the terminal (unbounded when output isn't one). A run that is
 * `live` has its clocks ticking; one that isn't ends with its verdict.
 */
const frame = (state: RunState, live: boolean) =>
  render(state, state.graph ?? [], {
    now: Date.now(),
    width: tty ? Math.max(40, process.stdout.columns || 80) : 120,
    height: tty ? Math.max(8, (process.stdout.rows || 24) - 1) : Infinity,
    color,
    live,
    verdict: !live
  })

/** Whether process `pid` is still running (signal 0 only checks it exists). */
const alive = (pid: number | undefined) => {
  if (pid === undefined) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const root = await createGit(process.cwd()).repoRoot()
const tracker = createTracker(root)

if (parsed.status) {
  const path = runPaths(root, parsed.spec).state
  if (!existsSync(path)) {
    console.error(`spec #${parsed.spec} has no run yet`)
    process.exit(1)
  }
  const state = JSON.parse(readFileSync(path, 'utf8')) as RunState
  state.graph ??= await tracker.readSpec(parsed.spec)
  console.log(frame(state, alive(state.runs?.at(-1)?.pid)))
  process.exit(0)
}

// On a terminal the chart replaces the console lines once it is first drawn (run.log keeps them
// all); before that, such as for a spec with no open tickets, lines print as usual.
const chart = tty ? createLogUpdate(process.stdout) : undefined
let latest: RunState | undefined
const draw = () => {
  if (chart && latest) chart(frame(latest, true))
}
const ticker = chart ? setInterval(draw, 1000) : undefined
process.stdout.on('resize', draw)

/**
 * Leaves the last frame on screen, with the verdict, and restores the cursor. Sessions still open
 * (on Ctrl-C) show as interrupted, as a re-run will treat them.
 */
const settle = () => {
  if (ticker) clearInterval(ticker)
  if (chart && latest) chart(frame(latest, false))
  chart?.done()
}
process.on('SIGINT', () => {
  settle()
  process.exit(130)
})

try {
  const result = await runSpec(
    parsed.spec,
    { explore: parsed.explore },
    {
      tracker,
      git: createGit(root),
      claude: createClaude(),
      log: (line) => {
        if (!chart || !latest) console.log(line)
      },
      now: Date.now,
      pid: process.pid,
      progress: (state) => {
        latest = state
        draw()
      },
      waitUntil
    }
  )
  settle()
  process.exit(result.ok ? 0 : 1)
} catch (error) {
  settle()
  throw error
}
