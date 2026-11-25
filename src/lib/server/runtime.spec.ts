import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readRuntimeFile, stopServer, writeRuntimeFile } from './runtime'

let home: string
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-runtime-'))
})

describe('stopServer', () => {
  it('takes down its own runtime file, so nothing finds a stopped server, then exits', () => {
    writeRuntimeFile(home, { port: 1, token: 't', pid: 42 })
    const exit = vi.fn()
    stopServer({ home, pid: 42, exit })
    expect(readRuntimeFile(home)).toBeUndefined()
    expect(exit).toHaveBeenCalledOnce()
  })

  it("leaves another server's runtime file alone", () => {
    writeRuntimeFile(home, { port: 1, token: 't', pid: 7 })
    const exit = vi.fn()
    stopServer({ home, pid: 42, exit })
    expect(readRuntimeFile(home)).toMatchObject({ pid: 7 })
    expect(exit).toHaveBeenCalledOnce()
  })
})
