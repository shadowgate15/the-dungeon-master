import {
  createQuery,
  useQueryClient,
  type DefinedCreateQueryResult,
  type DefinedInitialDataOptions,
  type NonUndefinedGuard
} from '@tanstack/svelte-query'
import {
  claimsQueryKey,
  floorQueryKey,
  journalQueryKey,
  sessionHistoryQueryKey,
  sceneQueryKey,
  sheetsQueryKey,
  timelineQueryKey
} from '#lib/live/messages.ts'
import type { ClaimRow } from './claims'
import type { OpenFloor, PendingDeclaration } from './floor'
import type { Journal } from './journal'
import type { PlaySheet } from './sheet'
import type { SessionHistory } from './sessions'
import type { SceneView } from './scene'
import type { Timeline } from './timeline'

/** A play request the server refused or failed, with its message for the Player. */
export class PlayRequestError extends Error {}

/** The server's refusal of a request as a `PlayRequestError`: its `{ error }`, else `fallback`. */
export async function refusal(res: Response, fallback: string): Promise<PlayRequestError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return new PlayRequestError(body.error ?? fallback)
}

const campaignPath = (campaign: string, path: string) =>
  `/api/campaigns/${encodeURIComponent(campaign)}/${path}`

/**
 * A query of one Campaign read the play console shows, starting from the server-rendered value;
 * live updates invalidate its key to keep it fresh.
 */
function campaignQuery<T>(
  key: (campaign: string) => readonly unknown[],
  path: string,
  failure: string,
  campaign: () => string,
  initial: () => T
): DefinedCreateQueryResult<T, Error> {
  return createQuery((): DefinedInitialDataOptions<T, Error, T, readonly unknown[]> => ({
    queryKey: key(campaign()),
    queryFn: async (): Promise<T> => {
      const res = await fetch(campaignPath(campaign(), path))
      if (!res.ok) throw await refusal(res, failure)
      return (await res.json()) as T
    },
    initialData: initial() as NonUndefinedGuard<T>
  }))
}

/** The Campaign's open Floor. */
export const createFloorQuery = (campaign: () => string, initial: () => OpenFloor) =>
  campaignQuery(floorQueryKey, 'floor', 'The Floor could not be loaded', campaign, initial)

/** The Campaign's timeline and awaiting Narration. */
export const createTimelineQuery = (campaign: () => string, initial: () => Timeline) =>
  campaignQuery(timelineQueryKey, 'timeline', 'The timeline could not be loaded', campaign, initial)

/** The Party's play sheets; every DM write refreshes them. */
export const createSheetsQuery = (campaign: () => string, initial: () => PlaySheet[]) =>
  campaignQuery(sheetsQueryKey, 'sheets', 'The sheets could not be loaded', campaign, initial)

/** The Campaign's Scene for the rail. */
export const createSceneQuery = (campaign: () => string, initial: () => SceneView) =>
  campaignQuery(sceneQueryKey, 'scene', 'The Scene could not be loaded', campaign, initial)

/** The Player's Journal. */
export const createJournalQuery = (campaign: () => string, initial: () => Journal) =>
  campaignQuery(journalQueryKey, 'journal', 'The Journal could not be loaded', campaign, initial)

/** The Player's read-only Session history. */
export const createSessionHistoryQuery = (campaign: () => string, initial: () => SessionHistory) =>
  campaignQuery(
    sessionHistoryQueryKey,
    'sessions',
    'The Session history could not be loaded',
    campaign,
    initial
  )

/** Takes the level the DM awarded with the picked spells; throws the server's refusal. */
export async function levelUp(
  campaign: string,
  character: string,
  picks: { cantrips: string[]; spells: string[] }
): Promise<void> {
  const res = await fetch(
    campaignPath(campaign, `characters/${encodeURIComponent(character)}/level-up`),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(picks) }
  )
  if (!res.ok) throw await refusal(res, 'The level-up was refused')
}

/**
 * Saves a Character's notes, personality and appearance; works with the DM away. Throws the
 * server's refusal.
 */
export async function saveDetails(
  campaign: string,
  character: string,
  details: { notes: string | null; personality: string | null; appearance: string | null }
): Promise<void> {
  const res = await fetch(campaignPath(campaign, `characters/${encodeURIComponent(character)}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(details)
  })
  if (!res.ok) throw await refusal(res, 'The details could not be saved')
}

/** End Session: asks the DM to close the Session. */
export async function endSession(campaign: string): Promise<void> {
  const res = await fetch(campaignPath(campaign, 'end-session'), {
    method: 'POST'
  })
  if (!res.ok) throw await refusal(res, 'The session could not be ended')
}

/** Send, edit, withdraw and Done on the Campaign's open Floor; each refreshes the Floor and timeline. */
export function floorActions(campaign: () => string) {
  const queryClient = useQueryClient()
  const base = () => campaignPath(campaign(), 'floor/declarations')

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json' } : undefined
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: floorQueryKey(campaign()) }),
      queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })
    ])
    if (!res.ok) throw await refusal(res, 'The Floor could not be changed')
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
        await call(campaignPath(campaign(), `floor/returned/${encodeURIComponent(id)}`), {
          method: 'DELETE'
        })
      }
    },
    /** "Cut to <Name>": a spotlight request to the DM. Doesn't make the DM answer a turn. */
    async cut(character: string): Promise<void> {
      await call(campaignPath(campaign(), 'spotlight'), {
        method: 'POST',
        body: JSON.stringify({ character })
      })
    },
    /** Done: closes the Floor (once every Player has pressed it) and wakes the DM. */
    async done(): Promise<void> {
      await call(campaignPath(campaign(), 'floor/done'), {
        method: 'POST'
      })
    },
    /** Not done yet: takes Done back until the Floor closes. */
    async undone(): Promise<void> {
      await call(campaignPath(campaign(), 'floor/done'), {
        method: 'DELETE'
      })
    }
  }
}

/** Rolling and answering the open Call; each refreshes the timeline, which holds the Call. */
export function callActions(campaign: () => string) {
  const queryClient = useQueryClient()

  async function post(call: string, part: string, body: Record<string, unknown>) {
    const res = await fetch(
      campaignPath(
        campaign(),
        `calls/${encodeURIComponent(call)}/parts/${encodeURIComponent(part)}`
      ),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }
    )
    await queryClient.invalidateQueries({ queryKey: timelineQueryKey(campaign()) })
    if (!res.ok) throw await refusal(res, 'The Call could not be answered')
  }

  return {
    /** Rolls one Check of the Call; the server rolls the dice. */
    roll: (call: string, part: string) => post(call, part, { roll: true }),
    /** Answers a question Call. */
    answer: (call: string, part: string, answer: string) => post(call, part, { answer })
  }
}

/** The Party's Claims as this browser sees them; a `claims` live message refreshes them. */
export const createClaimsQuery = (campaign: () => string, initial: () => ClaimRow[]) =>
  campaignQuery(claimsQueryKey, 'claims', 'The Claims could not be loaded', campaign, initial)

/** Claim and Let go from the Take a seat dialog; throws the server's refusal. */
export function claimActions(campaign: () => string) {
  const queryClient = useQueryClient()
  async function change(url: string, init: RequestInit) {
    const res = await fetch(url, init)
    // A refused Claim (taken meanwhile) still needs the fresh listing.
    await queryClient.invalidateQueries({ queryKey: claimsQueryKey(campaign()) })
    if (!res.ok) throw await refusal(res, 'The Claim could not be changed')
  }
  return {
    claim: (character: string) =>
      change(campaignPath(campaign(), 'claims'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character })
      }),
    letGo: (character: string) =>
      change(campaignPath(campaign(), `claims/${encodeURIComponent(character)}`), {
        method: 'DELETE'
      }),
    depart: (character: string) =>
      change(campaignPath(campaign(), `claims/${encodeURIComponent(character)}/depart`), {
        method: 'POST'
      }),
    rejoin: (character: string) =>
      change(campaignPath(campaign(), `claims/${encodeURIComponent(character)}/rejoin`), {
        method: 'POST'
      }),
    /** The Host frees a Character another browser holds. */
    release: (character: string) =>
      change(campaignPath(campaign(), `claims/${encodeURIComponent(character)}/release`), {
        method: 'POST'
      })
  }
}
