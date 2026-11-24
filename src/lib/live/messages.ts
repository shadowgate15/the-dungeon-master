import type { QueryKey } from '@tanstack/svelte-query'

/** One message on the browser's live updates stream: a state change on the server. */
export type LiveMessage =
  | { type: 'session'; campaign: string; attached: boolean }
  /** A Declaration was sent, edited or withdrawn on the Campaign's open Floor. */
  | { type: 'floor'; campaign: string }
  /** The Campaign's timeline or awaiting Narration changed (a Floor closed, the DM called a tool). */
  /** Also any DM write, so the Journal (fed by DM-only Reveals) refreshes with it. */
  | { type: 'timeline'; campaign: string }
  /** A permission prompt from the DM's session appeared or cleared. */
  | { type: 'permission'; campaign: string }

/** The query listing the ids of Campaigns with a DM at the table. */
export const SESSIONS_QUERY_KEY = ['sessions'] as const

/** The query holding a Campaign's open Floor. */
export const floorQueryKey = (campaign: string) => ['floor', campaign] as const

/** The query holding a Campaign's timeline. */
export const timelineQueryKey = (campaign: string) => ['timeline', campaign] as const

/** The query holding the Player's Journal: what their Characters believe. */
export const journalQueryKey = (campaign: string) => ['journal', campaign] as const

/** The query holding the permission prompt a Campaign's session is waiting on. */
export const permissionQueryKey = (campaign: string) => ['permission', campaign] as const

/** The cached queries a message makes stale. */
export function staleQueries(message: LiveMessage): QueryKey[] {
  switch (message.type) {
    case 'session':
      return [SESSIONS_QUERY_KEY]
    case 'floor':
      return [floorQueryKey(message.campaign)]
    case 'timeline':
      return [timelineQueryKey(message.campaign), journalQueryKey(message.campaign)]
    case 'permission':
      return [permissionQueryKey(message.campaign)]
  }
}
