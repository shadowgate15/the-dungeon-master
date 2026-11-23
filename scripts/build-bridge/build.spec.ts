import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRIDGE_BUNDLE, buildBridge, buildLauncher, LAUNCHER_BUNDLE } from './build'

describe('the bridge bundle', () => {
  it('is committed and up to date with src/bridge (run pnpm build:bridge)', async () => {
    const fresh = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dm-bridge-build-')), 'out.mjs')
    await buildBridge(fresh)
    expect(fs.readFileSync(BRIDGE_BUNDLE, 'utf8') === fs.readFileSync(fresh, 'utf8')).toBe(true)
  })

  it('the launcher bundle is committed and up to date with src/launcher (run pnpm build:bridge)', async () => {
    const fresh = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dm-launcher-build-')), 'out.mjs')
    await buildLauncher(fresh)
    expect(fs.readFileSync(LAUNCHER_BUNDLE, 'utf8') === fs.readFileSync(fresh, 'utf8')).toBe(true)
  })

  it('is one self-contained file: the plugin has no package.json to install', () => {
    const plugin = path.dirname(path.dirname(BRIDGE_BUNDLE))
    expect(fs.existsSync(path.join(plugin, 'package.json'))).toBe(false)
    expect(fs.readFileSync(BRIDGE_BUNDLE, 'utf8')).not.toMatch(/^import .* from ["'](?!node:)/m)
  })
})
