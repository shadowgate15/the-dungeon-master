import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { conversationQueryKey, draftQueryKey, seedQueryKey } from '#lib/live/messages.ts'
import type { ConversationMessage, DraftWithMarks, SeedWithMarks } from './conversation.ts'

const api = (campaign: string) => `/api/campaigns/${encodeURIComponent(campaign)}`

/** A message the server refused to pass to the DM, with its reason for the Player. */
export class ConversationError extends Error {}

/** The creation conversation, oldest first; live updates add the DM's replies and writes. */
export function createConversationQuery(
  campaign: () => string,
  initial: () => ConversationMessage[]
) {
  return createQuery(() => ({
    queryKey: conversationQueryKey(campaign()),
    queryFn: async (): Promise<ConversationMessage[]> => {
      const res = await fetch(`${api(campaign())}/conversation`)
      if (!res.ok) throw new ConversationError('The conversation could not be loaded')
      return ((await res.json()) as { messages: ConversationMessage[] }).messages
    },
    initialData: initial()
  }))
}

/** Sends the Player's message to the DM, then refreshes the conversation. */
export function conversationActions(campaign: () => string) {
  const queryClient = useQueryClient()
  return {
    async send(text: string): Promise<void> {
      const res = await fetch(`${api(campaign())}/conversation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      })
      await queryClient.invalidateQueries({ queryKey: conversationQueryKey(campaign()) })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new ConversationError(body.error ?? 'The message could not be sent')
      }
    }
  }
}

/** The stored Seed and its "✎ DM" fields; a DM write refreshes it. */
export function createSeedQuery(campaign: () => string, initial: () => SeedWithMarks) {
  return createQuery(() => ({
    queryKey: seedQueryKey(campaign()),
    queryFn: async (): Promise<SeedWithMarks> => {
      const res = await fetch(`${api(campaign())}/seed`)
      if (!res.ok) throw new ConversationError('The Seed could not be loaded')
      return (await res.json()) as SeedWithMarks
    },
    initialData: initial()
  }))
}

/** One stored Character draft and its "✎ DM" fields; a DM write refreshes it. */
export function createDraftQuery(
  campaign: () => string,
  draft: () => string,
  initial: () => DraftWithMarks
) {
  return createQuery(() => ({
    queryKey: draftQueryKey(campaign(), draft()),
    queryFn: async (): Promise<DraftWithMarks> => {
      const res = await fetch(`${api(campaign())}/drafts/${encodeURIComponent(draft())}`)
      if (!res.ok) throw new ConversationError('The draft could not be loaded')
      return (await res.json()) as DraftWithMarks
    },
    initialData: initial()
  }))
}
