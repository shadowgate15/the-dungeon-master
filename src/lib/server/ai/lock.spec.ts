import { describe, expect, it } from 'vitest'
import type { AiStatus } from '#lib/ai/status.ts'
import { createReasoningLock } from './lock.ts'

const ready: AiStatus = { state: 'ready', model: 'm', contextLength: null }

describe('reasoning model lock', () => {
  it('passes the probe through until a reasoning model is detected', async () => {
    const lock = createReasoningLock(async () => ready)

    expect(await lock.status()).toEqual(ready)
    expect(lock.locked).toBe(false)
  })

  it('reports reasoning-model without probing, and survives plain status reads', async () => {
    let probes = 0
    const lock = createReasoningLock(async () => (probes++, ready))
    lock.engage('m')

    expect(await lock.status()).toEqual({ state: 'reasoning-model', model: 'm' })
    expect(await lock.status()).toEqual({ state: 'reasoning-model', model: 'm' })
    expect(probes).toBe(0)
    expect(lock.locked).toBe(true)
  })

  it('a re-probe that succeeds releases the lock', async () => {
    const lock = createReasoningLock(async () => ready)
    lock.engage('m')

    expect(await lock.status({ recheck: true })).toEqual(ready)
    expect(lock.locked).toBe(false)
    expect(await lock.status()).toEqual(ready)
  })

  it('a re-probe that fails keeps the lock', async () => {
    const lock = createReasoningLock(async () => ({ state: 'unreachable', model: 'm' }))
    lock.engage('m')

    expect(await lock.status({ recheck: true })).toEqual({ state: 'reasoning-model', model: 'm' })
    expect(lock.locked).toBe(true)
  })
})
