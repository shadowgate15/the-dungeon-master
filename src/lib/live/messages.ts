import type { QueryKey } from '@tanstack/svelte-query'

/** One message on the browser's live updates stream: a state change on the server. */
export type LiveMessage =
  | { type: 'session'; campaign: string; attached: boolean }
  /** A Declaration was sent, edited or withdrawn on the Campaign's open Floor. */
  | { type: 'floor'; campaign: string }

/** The query listing the ids of Campaigns with a DM at the table. */
export const SESSIONS_QUERY_KEY = ['sessions'] as const

/** The query holding a Campaign's open Floor. */
export const floorQueryKey = (campaign: string) => ['floor', campaign] as const

/** The cached queries a message makes stale. */
export function staleQueries(message: LiveMessage): QueryKey[] {
  switch (message.type) {
    case 'session':
      return [SESSIONS_QUERY_KEY]
    case 'floor':
      return [floorQueryKey(message.campaign)]
  }
}
