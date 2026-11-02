import { describe, expect, it } from 'vitest'
import { emptySeed } from '#lib/world/seed.ts'
import { compactRequestSchema, HISTORY_MAX, turnRequestSchema } from './request.ts'

const body = (over: object = {}) => ({
  seed: emptySeed(),
  history: [],
  dismissed: [],
  message: 'hello',
  ...over
})

const messages = (n: number, size = 400) =>
  Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: 'x'.repeat(size)
  }))

describe('turn request bounds', () => {
  it('accepts a long resent history with a summary and context', () => {
    const parsed = turnRequestSchema.safeParse(
      body({
        history: messages(HISTORY_MAX),
        summary: 'Gist.',
        summarizedCount: 10,
        context: { limit: 8192, lastUsedTokens: 6000 }
      })
    )

    expect(parsed.success).toBe(true)
  })

  it.each([
    ['too many history messages', { history: messages(HISTORY_MAX + 1) }],
    ['an oversized history message', { history: messages(1, 4001) }],
    ['an oversized summary', { summary: 'x'.repeat(5000) }],
    ['a summarized count beyond the history', { history: messages(2), summarizedCount: 3 }],
    ['a nonsense context limit', { context: { limit: 0 } }],
    ['an empty message', { message: '  ' }]
  ])('rejects %s', (_name, over) => {
    expect(turnRequestSchema.safeParse(body(over)).success).toBe(false)
  })

  it('compaction needs no message', () => {
    const rest: Partial<ReturnType<typeof body>> = body()
    delete rest.message

    expect(compactRequestSchema.safeParse(rest).success).toBe(true)
  })
})
