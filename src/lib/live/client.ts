import { createQuery, type QueryClient } from '@tanstack/svelte-query'
import { SESSIONS_QUERY_KEY, staleQueries, type LiveMessage } from './messages'

/**
 * Follows the server's live updates stream, invalidating the cached queries each message makes
 * stale. After a reconnect (the server restarted, say) every query is invalidated, since messages
 * were missed. Returns the disconnect.
 */
export function connectLiveUpdates(queryClient: QueryClient, url = '/api/events'): () => void {
  const source = new EventSource(url)
  let opened = false
  source.onopen = () => {
    if (opened) void queryClient.invalidateQueries()
    opened = true
  }
  source.onmessage = (e: MessageEvent<string>) => {
    for (const queryKey of staleQueries(JSON.parse(e.data) as LiveMessage)) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
  return () => source.close()
}

/** The ids of the Campaigns with a DM at the table, starting from the server-rendered list. */
export function createSessionsQuery(initial: () => string[]) {
  return createQuery(() => ({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async (): Promise<string[]> => {
      const res = await fetch('/api/sessions')
      return ((await res.json()) as { attached: string[] }).attached
    },
    initialData: initial()
  }))
}
