import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTEXT_LIMIT,
  DEFAULT_LM_STUDIO_BASE_URL,
  resolveAiConfig,
  withContextFallback
} from './config.ts'

describe('AI config', () => {
  it('defaults the base URL to the local LM Studio endpoint', () => {
    expect(resolveAiConfig({ model: 'qwen3-4b-2507' }).baseUrl).toBe(DEFAULT_LM_STUDIO_BASE_URL)
    expect(DEFAULT_LM_STUDIO_BASE_URL).toBe('http://localhost:1234/v1')
  })

  it('uses a configured base URL and model', () => {
    expect(resolveAiConfig({ baseUrl: 'http://box:9/v1', model: 'm' })).toEqual({
      baseUrl: 'http://box:9/v1',
      model: 'm',
      contextLimit: DEFAULT_CONTEXT_LIMIT
    })
  })

  it('treats an unset or blank model as not configured', () => {
    expect(resolveAiConfig({}).model).toBeNull()
    expect(resolveAiConfig({ model: '' }).model).toBeNull()
    expect(resolveAiConfig({ model: '   ' }).model).toBeNull()
  })

  it('treats a blank base URL as unset', () => {
    expect(resolveAiConfig({ baseUrl: '', model: 'm' }).baseUrl).toBe(DEFAULT_LM_STUDIO_BASE_URL)
  })

  it('reads the fallback context limit, ignoring blank or invalid values', () => {
    expect(resolveAiConfig({ contextLimit: '8192' }).contextLimit).toBe(8192)
    expect(resolveAiConfig({ contextLimit: ' ' }).contextLimit).toBe(DEFAULT_CONTEXT_LIMIT)
    expect(resolveAiConfig({ contextLimit: 'lots' }).contextLimit).toBe(DEFAULT_CONTEXT_LIMIT)
    expect(resolveAiConfig({ contextLimit: '-5' }).contextLimit).toBe(DEFAULT_CONTEXT_LIMIT)
  })
})

describe('withContextFallback', () => {
  it('adds the configured limit to a ready status', () => {
    expect(withContextFallback({ state: 'ready', model: 'm', contextLength: null }, 8192)).toEqual({
      state: 'ready',
      model: 'm',
      contextLength: null,
      fallbackContextLength: 8192
    })
  })

  it('leaves other states alone', () => {
    expect(withContextFallback({ state: 'unreachable', model: 'm' }, 8192)).toEqual({
      state: 'unreachable',
      model: 'm'
    })
  })
})
