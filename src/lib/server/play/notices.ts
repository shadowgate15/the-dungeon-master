import { and, eq, gt, max } from 'drizzle-orm'
import type { CampaignLibrary } from '../campaign/library'
import type { Queryable } from '../db/connect'
import { campaign, event } from '../db/schema'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { partyPart } from './core-block'
import { currentStamp, logEvent } from './log'

/** What changed outside the DM: one Entity's handle, its new version and a one-line summary. */
export type Change = { handle: string; version: number; summary: string }

const TOOL = 'player'
const KIND = 'change'

/** Logs a change the Player made outside the DM (a UI edit), so the DM hears of it next. */
export function logChange(db: Queryable, change: Change, { at }: { at: number }) {
  logEvent(
    db,
    {
      tool: TOOL,
      kind: KIND,
      summary: change.summary,
      data: { handle: change.handle, version: change.version }
    },
    { at }
  )
}

/**
 * The changes the DM has not heard about yet, marking them heard: each Player edit logged in the
 * open Session since the last channel event. Offline edits belong to no Session; they reach the DM
 * at the next sitting's opening instead.
 */
export function takeChanges(db: Queryable): Change[] {
  const through = db.select({ at: campaign.noticedThrough }).from(campaign).get()?.at ?? 0
  const { sessionId } = currentStamp(db)
  if (!sessionId) return []
  const rows = db
    .select()
    .from(event)
    .where(
      and(
        gt(event.id, through),
        eq(event.sessionId, sessionId),
        eq(event.tool, TOOL),
        eq(event.kind, KIND)
      )
    )
    .orderBy(event.id)
    .all()
  const last =
    db
      .select({ id: max(event.id) })
      .from(event)
      .get()?.id ?? through
  db.update(campaign).set({ noticedThrough: last }).run()
  return rows.map((e) => ({
    handle: String(e.data?.handle),
    version: Number(e.data?.version),
    summary: e.summary
  }))
}

/**
 * The DM's channel: every channel event carries the changes made outside the DM since the last
 * one, as `handle vN: summary` lines; a changed core-block part is re-sent whole. Notices are
 * never an event of their own.
 */
export function createDmChannels(library: CampaignLibrary) {
  return createChannels({
    annotate(folder: string, sent: ChannelEvent): ChannelEvent {
      const entry = library.entryAt(folder)
      const db = library.databaseFor(folder)
      if (!entry || !db) return sent
      const changes = db.transaction((tx) => takeChanges(tx))
      if (changes.length === 0) return sent
      // Keep the latest version of each handle, in the order they changed.
      const latest = new Map(changes.map((c) => [c.handle, c]))
      const parts = [
        'Changed outside the DM:',
        ...[...latest.values()].map((c) => `- ${c.handle} v${c.version}: ${c.summary}`)
      ]
      if ([...latest.keys()].some((h) => h.startsWith('char:'))) {
        parts.push('', partyPart({ party: library.party(entry.id) }))
      }
      const notice = parts.join('\n')
      return { ...sent, content: sent.content ? `${sent.content}\n\n${notice}` : notice }
    }
  })
}
