import { describe, it, expect } from 'vitest'
import { createQueryClient } from './client'

describe('createQueryClient', () => {
  it('disables queries outside the browser', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().queries?.enabled).toBe(false)
  })

  it('merges overrides over the defaults', () => {
    const client = createQueryClient({ queries: { retry: false } })

    expect(client.getDefaultOptions().queries).toMatchObject({ retry: false, enabled: false })
  })

  it('returns an independent client on every call', () => {
    expect(createQueryClient()).not.toBe(createQueryClient())
  })
})
