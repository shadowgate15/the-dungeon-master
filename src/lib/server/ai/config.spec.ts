import { describe, expect, it } from 'vitest'
import { DEFAULT_LM_STUDIO_BASE_URL, resolveAiConfig } from './config.ts'

describe('AI config', () => {
  it('defaults the base URL to the local LM Studio endpoint', () => {
    expect(resolveAiConfig({ model: 'qwen3-4b-2507' }).baseUrl).toBe(DEFAULT_LM_STUDIO_BASE_URL)
    expect(DEFAULT_LM_STUDIO_BASE_URL).toBe('http://localhost:1234/v1')
  })

  it('uses a configured base URL and model', () => {
    expect(resolveAiConfig({ baseUrl: 'http://box:9/v1', model: 'm' })).toEqual({
      baseUrl: 'http://box:9/v1',
      model: 'm'
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
})
