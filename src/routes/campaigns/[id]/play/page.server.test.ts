import { describe, expect, it, vi } from 'vitest'

vi.mock('#lib/server/campaign/index.ts', () => ({
  library: { get: () => ({ id: 'abc', name: 'A', path: '/x', status: 'active' }) },
  sessions: { list: () => [] }
}))
vi.mock('#lib/server/bridge/index.ts', () => ({
  permissions: { pending: () => ({ requestId: 'r1' }) },
  play: {
    claims: () => [],
    sheets: () => [],
    openFloor: () => ({}),
    timeline: () => ({}),
    scene: () => ({}),
    journal: () => ({})
  }
}))

const { load } = await import('./+page.server.ts')
const run = (browser: string) =>
  load({ params: { id: 'abc' }, locals: { browser } } as never) as unknown as {
    permission: unknown
  }

describe('the play page permission prompt', () => {
  it('goes to the Host', () => {
    expect(run('player').permission).toEqual({ requestId: 'r1' })
  })
  it('never goes to a remote browser', () => {
    expect(run('123e4567-e89b-12d3-a456-426614174000').permission).toBeNull()
  })
})
