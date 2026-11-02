import { describe, expect, it } from 'vitest'
import { unavailableFailure } from './availability.ts'

describe('unavailableFailure', () => {
  it('is null when the model is ready', () => {
    expect(unavailableFailure({ state: 'ready', model: 'm', contextLength: null })).toBeNull()
  })

  it('maps an unreachable LM Studio to not-connected', () => {
    expect(unavailableFailure({ state: 'unreachable', model: 'm' })).toMatchObject({
      kind: 'not-connected'
    })
  })

  it('maps a missing model to model-unavailable, naming it', () => {
    const failure = unavailableFailure({ state: 'model-unavailable', model: 'qwen' })
    expect(failure).toMatchObject({ kind: 'model-unavailable' })
    expect(failure?.message).toContain('qwen')
  })
})
