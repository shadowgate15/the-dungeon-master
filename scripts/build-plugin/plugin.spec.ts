import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SERVER_BUILD } from './build'

const root = path.resolve(import.meta.dirname, '../..')
const plugin = path.join(root, 'plugin')
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

/** Every `${CLAUDE_PLUGIN_ROOT}/…` path a manifest names, resolved inside the plugin. */
function pluginPaths(text: string): string[] {
  return [...text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s\\]+)/g)].map((m) =>
    path.join(plugin, m[1])
  )
}

const listFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort()

describe('the plugin as a marketplace installs it', () => {
  it('is the marketplace plugin of the same name, sourced from plugin/', () => {
    const marketplace = readJson(path.join(root, '.claude-plugin/marketplace.json'))
    const manifest = readJson(path.join(plugin, '.claude-plugin/plugin.json'))
    expect(marketplace.plugins).toEqual([
      expect.objectContaining({ name: manifest.name, source: './plugin' })
    ])
    expect(manifest.name).toBe('the-dungeon-master')
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('has no package.json or lockfile at its root, so no dependency install runs', () => {
    for (const file of [
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lock'
    ])
      expect(fs.existsSync(path.join(plugin, file))).toBe(false)
  })

  it('ships every file its manifest and hooks run', () => {
    const named = [
      ...pluginPaths(fs.readFileSync(path.join(plugin, '.claude-plugin/plugin.json'), 'utf8')),
      ...pluginPaths(fs.readFileSync(path.join(plugin, 'hooks/hooks.json'), 'utf8'))
    ]
    expect(named.length).toBeGreaterThan(0)
    for (const file of named) expect(fs.existsSync(file), file).toBe(true)
  })

  it('ships the server build with the current migrations (run pnpm build:plugin)', () => {
    expect(fs.existsSync(path.join(SERVER_BUILD, 'index.js'))).toBe(true)
    const migrations = path.join(root, 'drizzle')
    const shipped = path.join(SERVER_BUILD, 'drizzle')
    expect(listFiles(shipped)).toEqual(listFiles(migrations))
    for (const file of listFiles(migrations)) {
      expect(fs.readFileSync(path.join(shipped, file), 'utf8'), file).toBe(
        fs.readFileSync(path.join(migrations, file), 'utf8')
      )
    }
  })

  it('vendors better-sqlite3 with prebuilt binaries, nothing to compile', () => {
    const vendored = path.join(SERVER_BUILD, 'node_modules/better-sqlite3')
    expect(readJson(path.join(vendored, 'package.json')).version).toMatch(/^13\./)
    expect(
      fs.existsSync(path.join(vendored, `prebuilds/${process.platform}-${process.arch}.node`))
    ).toBe(true)
  })
})
