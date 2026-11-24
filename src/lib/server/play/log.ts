import { asc, desc, isNull, sql } from 'drizzle-orm'
import type { Timeline, TimelineEntry } from '#lib/play/timeline.ts'
import type { Queryable } from '../db/connect'
import type { Stamp } from '../tools/contract'
import { activityLine, campaign, event, session } from '../db/schema'

export type { Stamp }

/** One Event to append to the log; the stamp comes from code, never from input. */
export type NewEvent = {
  /** The game tool (or Player action) that logged it. */
  tool: string
  kind: string
  summary: string
  data?: Record<string, unknown> | null
  dmOnly?: boolean
}

/**
 * The Campaign's current stamp: the open Session (null offline) and the in-fiction minute (0 until
 * the clock exists).
 */
export function currentStamp(db: Queryable): Stamp {
  const open = db.select({ id: session.id }).from(session).where(isNull(session.closedAt)).get()
  return { sessionId: open?.id ?? null, minute: 0 }
}

/** The id the next Event will get. The log is append-only, so ids are never reused. */
export function nextEventId(db: Queryable): number {
  const last = db.get<{ id: number | null }>(sql`SELECT max(${event.id}) AS id FROM ${event}`)
  return (last?.id ?? 0) + 1
}

/** Appends one Event, stamped with `stamp`; returns its id. */
export function logEvent(
  db: Queryable,
  entry: NewEvent,
  { stamp = currentStamp(db), at, id = nextEventId(db) }: { stamp?: Stamp; at: number; id?: number }
): number {
  db.insert(event)
    .values({
      id,
      sessionId: stamp.sessionId,
      minute: stamp.minute,
      tool: entry.tool,
      kind: entry.kind,
      summary: entry.summary,
      data: entry.data ?? null,
      dmOnly: entry.dmOnly ?? false,
      createdAt: at
    })
    .run()
  return id
}

/** Writes a Player-safe DM activity line after the Event `afterEvent` (the latest one by default). */
export function logActivity(
  db: Queryable,
  text: string,
  { at, afterEvent = nextEventId(db) - 1 }: { at: number; afterEvent?: number }
) {
  db.insert(activityLine)
    .values({ text, afterEvent, sessionId: currentStamp(db).sessionId, createdAt: at })
    .run()
}

/** The open Session, opened now (numbered after the last) if none is. */
export function openSession(db: Queryable, at: number): { id: string; number: number } {
  const open = db
    .select({ id: session.id, number: session.number })
    .from(session)
    .where(isNull(session.closedAt))
    .get()
  if (open) return open
  const last = db
    .select({ number: session.number })
    .from(session)
    .orderBy(desc(session.number))
    .get()
  return db
    .insert(session)
    .values({ number: (last?.number ?? 0) + 1, startedAt: at })
    .returning({ id: session.id, number: session.number })
    .get()
}

/** When the open turn started waiting on the DM, or null when nothing awaits Narration. */
export function awaitingNarrationSince(db: Queryable): number | null {
  return db.select({ at: campaign.awaitingNarrationSince }).from(campaign).get()?.at ?? null
}

/** Sets (a timestamp) or clears (null) the Campaign's awaiting Narration flag. */
export function setAwaitingNarration(db: Queryable, since: number | null) {
  db.update(campaign).set({ awaitingNarrationSince: since }).run()
}

/** Event kinds the Player's timeline shows. */
const SHOWN = new Set(['declaration', 'narration', 'turn_error'])

/** One logged Event as a timeline entry, or null for one the timeline does not show. */
function entryFor(e: typeof event.$inferSelect): TimelineEntry | null {
  if (e.dmOnly || !SHOWN.has(e.kind)) return null
  const data = e.data ?? {}
  const id = `e${e.id}`
  if (e.kind === 'declaration') {
    return {
      type: 'declaration',
      id,
      character: String(data.characterName),
      player: String(data.player),
      text: String(data.text)
    }
  }
  if (e.kind === 'turn_error') return { type: 'error', id, text: String(data.text) }
  return {
    type: 'narration',
    id,
    text: String(data.text),
    voice: typeof data.voiceName === 'string' ? data.voiceName : null
  }
}

/**
 * The Player's timeline: Declarations and Narrations from the Event log (never DM-only Events),
 * with each DM activity line after the Event it follows, plus the awaiting Narration flag. Every
 * entry is built here from Player-safe fields; nothing raw passes through.
 */
export function timeline(db: Queryable): Timeline {
  const lines = db.select().from(activityLine).orderBy(asc(activityLine.id)).all()
  const entries: TimelineEntry[] = []
  let next = 0
  const flushUntil = (eventId: number) => {
    while (next < lines.length && lines[next].afterEvent < eventId) {
      const line = lines[next++]
      entries.push({ type: 'activity', id: `a${line.id}`, text: line.text })
    }
  }
  for (const e of db.select().from(event).orderBy(asc(event.id)).all()) {
    flushUntil(e.id)
    const entry = entryFor(e)
    if (entry) entries.push(entry)
  }
  flushUntil(Infinity)
  return { entries, awaitingSince: awaitingNarrationSince(db) }
}
