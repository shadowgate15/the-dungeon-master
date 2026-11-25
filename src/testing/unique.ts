import { randomUUID } from 'node:crypto'

/**
 * A Campaign name no other e2e test uses, even one running at the same moment in another worker:
 * each test gets its own Campaign folder, so specs run in parallel.
 */
export const unique = (name: string) => `${name} ${randomUUID().slice(0, 8)}`
