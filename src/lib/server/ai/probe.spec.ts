import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startFakeLmStudio, type FakeLmStudio } from '#lib/testing/fake-lm-studio/server.ts'
import { probeAi } from './probe.ts'

let fake: FakeLmStudio

beforeEach(async () => {
  fake = await startFakeLmStudio({ model: 'qwen3-4b-2507', contextLength: 8192 })
})

afterEach(async () => {
  await fake.close()
})

describe('AI availability probe', () => {
  it('reports ready with the loaded context length', async () => {
    const status = await probeAi({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' })

    expect(status).toEqual({ state: 'ready', model: 'qwen3-4b-2507', contextLength: 8192 })
  })

  it('reports not configured, without contacting LM Studio, when no model is set', async () => {
    expect(await probeAi({ baseUrl: fake.baseUrl, model: null })).toEqual({
      state: 'not-configured'
    })
    expect(fake.requests).toHaveLength(0)
  })

  it('reports unreachable when LM Studio does not answer', async () => {
    fake.setScenario('unreachable')

    const status = await probeAi({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' })

    expect(status).toEqual({ state: 'unreachable', model: 'qwen3-4b-2507' })
  })

  it('reports unreachable when nothing is listening at all', async () => {
    const baseUrl = fake.baseUrl
    await fake.close()

    expect(await probeAi({ baseUrl, model: 'qwen3-4b-2507' })).toMatchObject({
      state: 'unreachable'
    })
    // afterEach closes again; make that harmless
    fake = await startFakeLmStudio()
  })

  it('reports model-unavailable when the configured model is not installed', async () => {
    fake.setScenario('model-missing')

    const status = await probeAi({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' })

    expect(status).toEqual({ state: 'model-unavailable', model: 'qwen3-4b-2507' })
  })

  it('recovers on a later probe once LM Studio is back', async () => {
    fake.setScenario('unreachable')
    expect((await probeAi({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' })).state).toBe(
      'unreachable'
    )

    fake.setScenario('ready')

    expect((await probeAi({ baseUrl: fake.baseUrl, model: 'qwen3-4b-2507' })).state).toBe('ready')
  })

  it('gives up on a server that hangs instead of waiting forever', async () => {
    const hang = await startFakeLmStudio({ scenario: 'ready' })
    const status = await probeAi({
      baseUrl: hang.baseUrl,
      model: 'fake-model',
      fetch: () => new Promise<Response>(() => {}),
      timeoutMs: 20
    })
    await hang.close()

    expect(status.state).toBe('unreachable')
  })
})
