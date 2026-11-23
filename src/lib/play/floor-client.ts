import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { floorQueryKey } from '#lib/live/messages.ts'
import type { OpenFloor, PendingDeclaration } from './floor'

/** A Floor change the server refused, with its message for the Player. */
export class FloorChangeError extends Error {}

/** The Campaign's open Floor, starting from the server-rendered one; live updates keep it fresh. */
export function createFloorQuery(campaign: () => string, initial: () => OpenFloor) {
  return createQuery(() => ({
    queryKey: floorQueryKey(campaign()),
    queryFn: async (): Promise<OpenFloor> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/floor`)
      if (!res.ok) throw new FloorChangeError('The Floor could not be loaded')
      return (await res.json()) as OpenFloor
    },
    initialData: initial()
  }))
}

/** Send, edit and withdraw on the Campaign's open Floor; each refreshes the Floor query. */
export function floorActions(campaign: () => string) {
  const queryClient = useQueryClient()
  const base = () => `/api/campaigns/${encodeURIComponent(campaign())}/floor/declarations`

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined
    })
    await queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new FloorChangeError(body.error ?? 'The Floor could not be changed')
    }
    return res
  }

  return {
    async send(character: string, text: string): Promise<PendingDeclaration> {
      const res = await call(base(), {
        method: 'POST',
        body: JSON.stringify({ character, text })
      })
      return (await res.json()) as PendingDeclaration
    },
    async edit(id: string, text: string): Promise<void> {
      await call(`${base()}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ text })
      })
    },
    async withdraw(id: string): Promise<void> {
      await call(`${base()}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }
  }
}
