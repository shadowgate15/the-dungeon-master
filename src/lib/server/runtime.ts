import fs from 'node:fs'
import path from 'node:path'

/**
 * The running game server's runtime file, in the user-level state directory: how the bridge and
 * the launcher find the server and prove they may talk to it. `version` is the plugin version the
 * launcher started it from (none for a dev server), so a stale server can be restarted.
 */
export type Runtime = { port: number; token: string; pid: number; version?: string }

export function runtimeFilePath(home: string): string {
  return path.join(home, 'runtime.json')
}

export function writeRuntimeFile(home: string, runtime: Runtime) {
  fs.mkdirSync(home, { recursive: true })
  const file = runtimeFilePath(home)
  const tmp = `${file}.${process.pid}.tmp`
  // Owner-only: the token gates every prompt that reaches the DM.
  fs.writeFileSync(tmp, JSON.stringify(runtime) + '\n', { mode: 0o600 })
  fs.renameSync(tmp, file)
}

/** The runtime file, or undefined when no server has written one. */
export function readRuntimeFile(home: string): Runtime | undefined {
  try {
    return JSON.parse(fs.readFileSync(runtimeFilePath(home), 'utf8')) as Runtime
  } catch {
    return undefined
  }
}
