import type { QueryKey } from '@tanstack/svelte-query'

/** One message on the browser's live updates stream: a state change on the server. */
export type LiveMessage =
  | { type: 'session'; campaign: string; attached: boolean }
  /** A Declaration was sent, edited or withdrawn on the Campaign's open Floor. */
  | { type: 'floor'; campaign: string }
  /** The Campaign's timeline or awaiting Narration changed (a Floor closed, the DM called a tool). */
  | { type: 'timeline'; campaign: string }
  /** The Campaign Seed or its "✎ DM" markers changed. */
  | { type: 'seed'; campaign: string }
  /** A Character draft changed outside the wizard showing it (the DM wrote into it). */
  | { type: 'draft'; campaign: string; draft: string }
  /** A message was added to the creation conversation. */
  | { type: 'conversation'; campaign: string }

/** The query listing the ids of Campaigns with a DM at the table. */
export const SESSIONS_QUERY_KEY = ['sessions'] as const

/** The query holding a Campaign's open Floor. */
export const floorQueryKey = (campaign: string) => ['floor', campaign] as const

/** The query holding a Campaign's timeline. */
export const timelineQueryKey = (campaign: string) => ['timeline', campaign] as const

/** The query holding a Campaign's Seed and its "✎ DM" markers. */
export const seedQueryKey = (campaign: string) => ['seed', campaign] as const

/** The query holding one stored Character draft. */
export const draftQueryKey = (campaign: string, draft: string) =>
  ['draft', campaign, draft] as const

/** The query holding a Campaign's creation conversation. */
export const conversationQueryKey = (campaign: string) => ['conversation', campaign] as const

/** The cached queries a message makes stale. */
export function staleQueries(message: LiveMessage): QueryKey[] {
  switch (message.type) {
    case 'session':
      return [SESSIONS_QUERY_KEY]
    case 'floor':
      return [floorQueryKey(message.campaign)]
    case 'timeline':
      return [timelineQueryKey(message.campaign)]
    case 'seed':
      return [seedQueryKey(message.campaign)]
    case 'draft':
      return [draftQueryKey(message.campaign, message.draft)]
    case 'conversation':
      return [conversationQueryKey(message.campaign)]
  }
}
