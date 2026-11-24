import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { permissionQueryKey } from '#lib/live/messages.ts'
import type { PendingPermission, PermissionBehavior } from './permission'

const url = (campaign: string) => `/api/campaigns/${encodeURIComponent(campaign)}/permission`

/** The permission prompt the Campaign's session is waiting on, starting from the server-rendered one. */
export function createPermissionQuery(
  campaign: () => string,
  initial: () => PendingPermission | null
) {
  return createQuery(() => ({
    queryKey: permissionQueryKey(campaign()),
    queryFn: async (): Promise<PendingPermission | null> => {
      const res = await fetch(url(campaign()))
      if (!res.ok) return null
      return ((await res.json()) as { request: PendingPermission | null }).request
    },
    initialData: initial()
  }))
}

/**
 * Answers the prompt. When the terminal answered first the server refuses it, and the card clears
 * either way.
 */
export function permissionActions(campaign: () => string) {
  const queryClient = useQueryClient()
  return {
    async answer(requestId: string, behavior: PermissionBehavior): Promise<void> {
      await fetch(url(campaign()), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, behavior })
      })
      await queryClient.invalidateQueries({ queryKey: permissionQueryKey(campaign()) })
    }
  }
}
