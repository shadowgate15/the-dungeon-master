import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeEach } from 'vitest'

const made: string[] = []
let testStart = 0

/**
 * A new temporary directory, deleted after the test that made it, or after the file when made in
 * `beforeAll`. The server project's setup file registers the cleanup.
 */
export function tempDir(prefix = 'test'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dm-${prefix}-`))
  made.push(dir)
  return dir
}

function removeFrom(index: number) {
  for (const dir of made.splice(index)) fs.rmSync(dir, { recursive: true, force: true })
}

/** Registers the cleanup; called once, from the server project's setup file. */
export function cleanUpTempDirs() {
  beforeEach(() => {
    testStart = made.length
  })
  afterEach(() => removeFrom(testStart))
  afterAll(() => removeFrom(0))
}
