import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import {
  floorQueryKey,
  journalQueryKey,
  sessionHistoryQueryKey,
  sceneQueryKey,
  sheetsQueryKey,
  timelineQueryKey
} from '#lib/live/messages.ts'
import type { OpenFloor, PendingDeclaration } from './floor'
import type { Journal } from './journal'
import type { PlaySheet } from './sheet'
import type { SessionHistory } from './sessions'
import type { SceneView } from './scene'
import type { Timeline } from './timeline'

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

/** The Campaign's timeline and awaiting Narration, starting from the server-rendered one. */
export function createTimelineQuery(campaign: () => string, initial: () => Timeline) {
  return createQuery(() => ({
    queryKey: timelineQueryKey(campaign()),
    queryFn: async (): Promise<Timeline> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/timeline`)
      if (!res.ok) throw new FloorChangeError('The timeline could not be loaded')
      return (await res.json()) as Timeline
    },
    initialData: initial()
  }))
}

/** The Party's play sheets, starting from the server-rendered ones; every DM write refreshes them. */
export function createSheetsQuery(campaign: () => string, initial: () => PlaySheet[]) {
  return createQuery(() => ({
    queryKey: sheetsQueryKey(campaign()),
    queryFn: async (): Promise<PlaySheet[]> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/sheets`)
      if (!res.ok) throw new Error('The sheets could not be loaded')
      return (await res.json()) as PlaySheet[]
    },
    initialData: initial()
  }))
}

/** Takes the level the DM awarded with the picked spells; throws the server's refusal. */
export async function levelUp(
  campaign: string,
  character: string,
  picks: { cantrips: string[]; spells: string[] }
): Promise<void> {
  const res = await fetch(
    `/api/campaigns/${encodeURIComponent(campaign)}/characters/${encodeURIComponent(character)}/level-up`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(picks) }
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new FloorChangeError(body.error ?? 'The level-up was refused')
  }
}

/** The Campaign's Scene for the rail, starting from the server-rendered one. */
export function createSceneQuery(campaign: () => string, initial: () => SceneView) {
  return createQuery(() => ({
    queryKey: sceneQueryKey(campaign()),
    queryFn: async (): Promise<SceneView> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/scene`)
      if (!res.ok) throw new FloorChangeError('The Scene could not be loaded')
      return (await res.json()) as SceneView
    },
    initialData: initial()
  }))
}

/** The Player's Journal, starting from the server-rendered one; live updates keep it fresh. */
export function createJournalQuery(campaign: () => string, initial: () => Journal) {
  return createQuery(() => ({
    queryKey: journalQueryKey(campaign()),
    queryFn: async (): Promise<Journal> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/journal`)
      if (!res.ok) throw new Error('The Journal could not be loaded')
      return (await res.json()) as Journal
    },
    initialData: initial()
  }))
}

/** The Player's read-only Session history, starting from the server-rendered one. */
export function createSessionHistoryQuery(campaign: () => string, initial: () => SessionHistory) {
  return createQuery(() => ({
    queryKey: sessionHistoryQueryKey(campaign()),
    queryFn: async (): Promise<SessionHistory> => {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign())}/sessions`)
      if (!res.ok) throw new Error('The Session history could not be loaded')
      return (await res.json()) as SessionHistory
    },
    initialData: initial()
  }))
}

/** End Session: asks the DM to close the sitting. */
export async function endSession(campaign: string): Promise<void> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign)}/end-session`, {
    method: 'POST'
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new FloorChangeError(body.error ?? 'The session could not be ended')
  }
}

/** Send, edit, withdraw and Done on the Campaign's open Floor; each refreshes the Floor and timeline. */
export function floorActions(campaign: () => string) {
  const queryClient = useQueryClient()
  const base = () => `/api/campaigns/${encodeURIComponent(campaign())}/floor/declarations`

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) }),
      queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })
    ])
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
    },
    /** The composer loaded drafts a cut sent back; the server stops holding them. */
    async clearReturned(ids: string[]): Promise<void> {
      for (const id of ids) {
        await call(
          `/api/campaigns/${encodeURIComponent(campaign())}/floor/returned/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        )
      }
    },
    /** "Cut to <Name>": a spotlight request to the DM. Doesn't make the DM answer a turn. */
    async cut(character: string): Promise<void> {
      await call(`/api/campaigns/${encodeURIComponent(campaign())}/spotlight`, {
        method: 'POST',
        body: JSON.stringify({ character })
      })
    },
    /** Done: closes the Floor (once every Player has pressed it) and wakes the DM. */
    async done(): Promise<void> {
      await call(`/api/campaigns/${encodeURIComponent(campaign())}/floor/done`, {
        method: 'POST'
      })
    }
  }
}

/** Rolling and answering the open Call; each refreshes the timeline, which holds the Call. */
export function callActions(campaign: () => string) {
  const queryClient = useQueryClient()

  async function post(call: string, part: string, body: Record<string, unknown>) {
    const res = await fetch(
      `/api/campaigns/${encodeURIComponent(campaign())}/calls/${encodeURIComponent(call)}/parts/${encodeURIComponent(part)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }
    )
    await queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })
    if (!res.ok) {
      const failure = (await res.json().catch(() => ({}))) as { error?: string }
      throw new FloorChangeError(failure.error ?? 'The Call could not be answered')
    }
  }

  return {
    /** Rolls one Check of the Call; the server rolls the dice. */
    roll: (call: string, part: string) => post(call, part, { roll: true }),
    /** Answers a question Call. */
    answer: (call: string, part: string, answer: string) => post(call, part, { answer })
  }
}
