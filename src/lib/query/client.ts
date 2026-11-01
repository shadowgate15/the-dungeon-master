import { browser } from '$app/env'
import { QueryClient, type DefaultOptions } from '@tanstack/svelte-query'

/**
 * Builds a QueryClient with the app defaults. Queries only run in the browser,
 * so the server never fetches or shares cache between requests.
 */
export function createQueryClient(overrides: DefaultOptions = {}) {
  return new QueryClient({
    defaultOptions: {
      ...overrides,
      queries: { enabled: browser, ...overrides.queries }
    }
  })
}
