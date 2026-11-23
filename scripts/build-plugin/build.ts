import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { buildBridge, buildLauncher } from '../build-bridge/build.ts'

const root = path.resolve(import.meta.dirname, '../..')

/** The committed adapter-node server build, inside the plugin root (files outside it aren't installed). */
export const SERVER_BUILD = path.join(root, 'plugin/server')

/** What better-sqlite3 needs at runtime: its JS and the N-API prebuilds, no install script. */
const BETTER_SQLITE3_FILES = ['package.json', 'LICENSE', 'README.md', 'lib', 'prebuilds']

/**
 * Builds everything the plugin runs, so a marketplace install needs no dependency install:
 * the bridge and launcher bundles in `bin/`, and the game server in `server/` with its
 * migrations and a vendored better-sqlite3 (the one dependency adapter-node leaves external).
 */
async function buildPlugin() {
  await buildBridge()
  await buildLauncher()

  const vite = spawnSync(path.join(root, 'node_modules/.bin/vite'), ['build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SERVER_OUT: path.relative(root, SERVER_BUILD) }
  })
  if (vite.status !== 0) process.exit(vite.status ?? 1)

  // The server runs with its own directory as cwd, where `migrateDatabase` looks for `drizzle/`.
  fs.cpSync(path.join(root, 'drizzle'), path.join(SERVER_BUILD, 'drizzle'), { recursive: true })

  const require = createRequire(import.meta.url)
  const source = path.dirname(require.resolve('better-sqlite3/package.json'))
  const target = path.join(SERVER_BUILD, 'node_modules/better-sqlite3')
  for (const file of BETTER_SQLITE3_FILES) {
    fs.cpSync(path.join(source, file), path.join(target, file), { recursive: true })
  }
}

if (import.meta.main) await buildPlugin()
