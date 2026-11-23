import type { QueryKey } from '@tanstack/svelte-query'

/** One message on the browser's live updates stream: a state change on the server. */
export type LiveMessage = { type: 'session'; campaign: string; attached: boolean }

/** The query listing the ids of Campaigns with a DM at the table. */
export const SESSIONS_QUERY_KEY = ['sessions'] as const

/** The cached queries a message makes stale. */
export function staleQueries(message: LiveMessage): QueryKey[] {
  switch (message.type) {
    case 'session':
      return [SESSIONS_QUERY_KEY]
  }
}
