import { describe, expect, it } from 'vitest'
import {
  contextMeter,
  estimatePromptTokens,
  estimateTokens,
  exceedsLimit,
  shouldCompact
} from './context.ts'
import { emptySeed } from './seed.ts'

const base = { seed: emptySeed(), history: [], dismissed: [], pending: [] }

describe('contextMeter', () => {
  it('reports used against the limit as a percentage', () => {
    expect(contextMeter({ used: 1024, limit: 4096 })).toEqual({
      used: 1024,
      limit: 4096,
      percent: 25,
      warn: false
    })
  })

  it('warns at 80% and above, and caps the percentage at 100', () => {
    expect(contextMeter({ used: 3276, limit: 4096 }).warn).toBe(false)
    expect(contextMeter({ used: 3277, limit: 4096 }).warn).toBe(true)
    expect(contextMeter({ used: 9000, limit: 4096 }).percent).toBe(100)
  })
})

describe('estimatePromptTokens', () => {
  it('estimates roughly three characters per token', () => {
    expect(estimateTokens('x'.repeat(300))).toBe(100)
  })

  it('grows with history, the summary, dismissed notes and the message', () => {
    const empty = estimatePromptTokens(base)
    const history = [{ role: 'user' as const, content: 'x'.repeat(300) }]

    expect(estimatePromptTokens({ ...base, history })).toBe(empty + 100)
    expect(estimatePromptTokens({ ...base, summary: 'y'.repeat(300) })).toBe(empty + 100)
    expect(estimatePromptTokens({ ...base, message: 'z'.repeat(300) })).toBe(empty + 100)
    expect(
      estimatePromptTokens({ ...base, dismissed: [{ field: 'name', value: 'w'.repeat(300) }] })
    ).toBeGreaterThan(empty)
  })

  it('counts only the messages after the summarized ones', () => {
    const history = [
      { role: 'user' as const, content: 'x'.repeat(3000) },
      { role: 'assistant' as const, content: 'ok' }
    ]
    const full = estimatePromptTokens({ ...base, history })

    expect(estimatePromptTokens({ ...base, history, summarizedCount: 1 })).toBeLessThan(full - 900)
  })
})

describe('shouldCompact / exceedsLimit', () => {
  it('compacts once the projected size reaches 80% of the limit', () => {
    expect(shouldCompact({ projected: 799, limit: 1000 })).toBe(false)
    expect(shouldCompact({ projected: 800, limit: 1000 })).toBe(true)
  })

  it('exceeds the limit only above it', () => {
    expect(exceedsLimit({ projected: 1000, limit: 1000 })).toBe(false)
    expect(exceedsLimit({ projected: 1001, limit: 1000 })).toBe(true)
  })
})
