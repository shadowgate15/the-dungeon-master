import type { QueryKey } from '@tanstack/svelte-query'

/** One message on the browser's live updates stream: a state change on the server. */
export type LiveMessage =
  | { type: 'session'; campaign: string; attached: boolean }
  /** A Declaration was sent, edited or withdrawn on the Campaign's open Floor. */
  | { type: 'floor'; campaign: string }
  /**
   * The DM called a tool or a Floor closed: the timeline and awaiting Narration changed, and with
   * them possibly the Scene and the open Floor (`move`, `set_scene`, `advance_time`) and the
   * Journal (fed by DM-only Reveals).
   */
  | { type: 'timeline'; campaign: string }
  /** The Campaign Seed or its "✎ DM" markers changed. */
  | { type: 'seed'; campaign: string }
  /** A Character draft changed outside the wizard showing it (the DM wrote into it). */
  | { type: 'draft'; campaign: string; draft: string }
  /** A message was added to the creation conversation. */
  | { type: 'conversation'; campaign: string }
  /** A permission prompt from the DM's session appeared or cleared. */
  | { type: 'permission'; campaign: string }
  /** A Claim was made or given up: content-free, every browser refetches what it sees per Player. */
  | { type: 'claims'; campaign: string }

/** The query listing the ids of Campaigns with a DM at the table. */
export const SESSIONS_QUERY_KEY = ['sessions'] as const

/** The query holding the Party's Claims as this browser sees them: yours, taken or free. */
export const claimsQueryKey = (campaign: string) => ['claims', campaign] as const

/** The query holding a Campaign's open Floor. */
export const floorQueryKey = (campaign: string) => ['floor', campaign] as const

/** The query holding a Campaign's timeline. */
export const timelineQueryKey = (campaign: string) => ['timeline', campaign] as const

/** The query holding a Campaign's Scene, as the rail shows it. */
export const sceneQueryKey = (campaign: string) => ['scene', campaign] as const

/** The query holding a Campaign's Seed and its "✎ DM" markers. */
export const seedQueryKey = (campaign: string) => ['seed', campaign] as const

/** The query holding one stored Character draft. */
export const draftQueryKey = (campaign: string, draft: string) =>
  ['draft', campaign, draft] as const

/** The query holding a Campaign's creation conversation. */
export const conversationQueryKey = (campaign: string) => ['conversation', campaign] as const

/** The query holding the Player's Journal: what their Characters believe. */
export const journalQueryKey = (campaign: string) => ['journal', campaign] as const

/** The query holding the Player's read-only Session history (`close_session` is a DM write). */
export const sessionHistoryQueryKey = (campaign: string) => ['session-history', campaign] as const

/** The query holding the Party's play sheets: tools change them, so every write stales them. */
export const sheetsQueryKey = (campaign: string) => ['sheets', campaign] as const

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
      return [
        timelineQueryKey(message.campaign),
        sceneQueryKey(message.campaign),
        floorQueryKey(message.campaign),
        journalQueryKey(message.campaign),
        sessionHistoryQueryKey(message.campaign),
        sheetsQueryKey(message.campaign)
      ]
    case 'claims':
      return [
        claimsQueryKey(message.campaign),
        floorQueryKey(message.campaign),
        timelineQueryKey(message.campaign),
        sceneQueryKey(message.campaign),
        journalQueryKey(message.campaign),
        sessionHistoryQueryKey(message.campaign),
        sheetsQueryKey(message.campaign)
      ]
    case 'permission':
      return [permissionQueryKey(message.campaign)]
    case 'seed':
      return [seedQueryKey(message.campaign)]
    case 'draft':
      return [draftQueryKey(message.campaign, message.draft)]
    case 'conversation':
      return [conversationQueryKey(message.campaign)]
  }
}
