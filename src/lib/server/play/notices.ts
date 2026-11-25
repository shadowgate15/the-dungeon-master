import { handleKind } from '#lib/world/entity-types.ts'
import { and, eq, gt, isNull, max } from 'drizzle-orm'
import type { CampaignLibrary } from '../campaign/library'
import type { Queryable } from '../db/connect'
import { campaign, event } from '../db/schema'
import { createChannels, type ChannelEvent } from '../bridge/channels'
import { partyPart } from './core-block'
import { awaitingNarrationSince, currentStamp, logEvent } from './log'

/** What changed outside the DM: one Entity's handle, its new version and a one-line summary. */
export type Change = { handle: string; version: number; summary: string }

const TOOL = 'player'
const KIND = 'change'

/**
 * Logs a change the Player made outside the DM (a UI edit), so the DM hears of it next. An
 * `offline` edit (no DM at the table) belongs to no Session, even while an earlier Session's
 * Session is still open for its catch-up close.
 */
export function logChange(
  db: Queryable,
  change: Change,
  { at, offline = false }: { at: number; offline?: boolean }
) {
  logEvent(
    db,
    {
      tool: TOOL,
      kind: KIND,
      summary: change.summary,
      data: { handle: change.handle, version: change.version }
    },
    offline ? { at, stamp: { ...currentStamp(db), sessionId: null } } : { at }
  )
}

/**
 * The changes the DM has not heard about yet, marking them heard: each Player edit logged in the
 * open Session since the last channel event. Offline edits belong to no Session; they reach the DM
 * at the next Session's opening instead.
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

/** The latest version of each changed handle, in the order they changed, as notice lines. */
function changeLines(changes: Change[]): string[] {
  const latest = new Map(changes.map((c) => [c.handle, c]))
  return [...latest.values()].map((c) => `- ${c.handle} v${c.version}: ${c.summary}`)
}

/**
 * The offline edits no opening has told the DM about yet, marking them told: each Player edit
 * logged in no Session since the last opening.
 */
export function takeOfflineChanges(db: Queryable): Change[] {
  const through = db.select({ at: campaign.offlineNoticedThrough }).from(campaign).get()?.at ?? 0
  const rows = db
    .select()
    .from(event)
    .where(
      and(
        gt(event.id, through),
        isNull(event.sessionId),
        eq(event.tool, TOOL),
        eq(event.kind, KIND)
      )
    )
    .orderBy(event.id)
    .all()
  if (rows.length > 0) {
    db.update(campaign)
      .set({ offlineNoticedThrough: rows.at(-1)!.id })
      .run()
  }
  return rows.map((e) => ({
    handle: String(e.data?.handle),
    version: Number(e.data?.version),
    summary: e.summary
  }))
}

/**
 * What a Session's opening adds to the core block, in the caller's transaction: the "changed since
 * last Session" notice for offline edits (told once), and a turn left awaiting Narration, to answer
 * after the recap. Empty when neither applies.
 */
export function openingNotice(db: Queryable): string {
  const parts: string[] = []
  const changes = takeOfflineChanges(db)
  if (changes.length > 0) {
    parts.push(['Changed since last Session:', ...changeLines(changes)].join('\n'))
  }
  if (awaitingNarrationSince(db) !== null) {
    parts.push(
      'A turn awaits Narration: the last Session ended before the DM answered it. Read it with history and answer it with narrate after the recap.'
    )
  }
  return parts.join('\n\n')
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
      const parts = ['Changed outside the DM:', ...changeLines(changes)]
      if (changes.some((c) => handleKind(c.handle) === 'char')) {
        parts.push('', partyPart({ party: library.party(entry.id), db }))
      }
      const notice = parts.join('\n')
      return { ...sent, content: sent.content ? `${sent.content}\n\n${notice}` : notice }
    }
  })
}
