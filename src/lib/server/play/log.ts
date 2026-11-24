import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { HpState } from '#lib/play/hp-state.ts'
import type { RollOutcome, Timeline, TimelineEntry } from '#lib/play/timeline.ts'
import type { Queryable } from '../db/connect'
import type { Stamp } from '../tools/contract'
import { activityLine, campaign, event, session } from '../db/schema'
import { openCallView } from './calls'
import { currentMinute } from './scene'

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
 * The Campaign's current stamp: the open Session (null offline) and the Campaign clock's minute.
 */
export function currentStamp(db: Queryable): Stamp {
  return { sessionId: currentSession(db)?.id ?? null, minute: currentMinute(db) }
}

/**
 * The current Session: the newest one still open, or undefined offline. An older open one is a
 * sitting that stopped without End Session, waiting for its catch-up close.
 */
export function currentSession(db: Queryable) {
  return db
    .select()
    .from(session)
    .where(isNull(session.closedAt))
    .orderBy(desc(session.number))
    .get()
}

/** Whether any non-recap Narration was logged in the Session. */
export function hasNarration(db: Queryable, sessionId: string): boolean {
  return (
    db
      .select({ id: event.id })
      .from(event)
      .where(
        and(
          eq(event.sessionId, sessionId),
          eq(event.kind, 'narration'),
          sql`coalesce(json_extract(${event.data}, '$.recap'), 0) = 0`
        )
      )
      .get() !== undefined
  )
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

/**
 * The Session for a DM attaching through `bridge` (one per Claude Code session). A reconnect of
 * the same bridge keeps its Session, even one End Session closed. A new bridge opens the next
 * Session; an older open one stays open for its catch-up close, unless it has no Narration, in
 * which case it closes now with no summary. With no bridge, the current Session is reused.
 */
export function openSession(
  db: Queryable,
  at: number,
  bridge?: string
): { id: string; number: number } {
  const pick = { id: session.id, number: session.number }
  if (bridge !== undefined) {
    const own = db.select(pick).from(session).where(eq(session.bridge, bridge)).get()
    if (own) return own
  } else {
    const current = currentSession(db)
    if (current) return { id: current.id, number: current.number }
  }
  for (const stale of db.select().from(session).where(isNull(session.closedAt)).all()) {
    if (!hasNarration(db, stale.id)) {
      db.update(session).set({ closedAt: at }).where(eq(session.id, stale.id)).run()
    }
  }
  const last = db
    .select({ number: session.number })
    .from(session)
    .orderBy(desc(session.number))
    .get()
  return db
    .insert(session)
    .values({ number: (last?.number ?? 0) + 1, bridge: bridge ?? null, startedAt: at })
    .returning(pick)
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
const SHOWN = new Set(['declaration', 'narration', 'turn_error', 'roll', 'rolls', 'answer'])

/** One roll in the dice log: a Player's click on a Call, or one of an NPC's rolls. */
function rollEntry(id: string, data: Record<string, unknown>): TimelineEntry {
  const mode = data.mode === 'advantage' || data.mode === 'disadvantage' ? data.mode : 'normal'
  return {
    type: 'roll',
    id,
    character: String(data.characterName),
    what: String(data.what),
    dice: (data.dice as number[]).map(Number),
    modifier: Number(data.modifier),
    total: Number(data.total),
    outcome:
      'outcome' in data
        ? (data.outcome as RollOutcome | null)
        : data.success
          ? 'success'
          : 'failure',
    mode,
    reason: mode === 'normal' ? null : String(data.reason ?? ''),
    target: (data.target as { name: string; state: HpState } | null | undefined) ?? null
  }
}

/** One logged Event as timeline entries: none, one, or one per roll of an NPC's `rolls`. */
function entriesFor(e: typeof event.$inferSelect): TimelineEntry[] {
  if (e.kind === 'rolls' && !e.dmOnly) {
    const rolls = (e.data?.rolls ?? []) as Record<string, unknown>[]
    return rolls.map((r, i) => rollEntry(`e${e.id}-${i}`, r))
  }
  const entry = entryFor(e)
  return entry ? [entry] : []
}

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
  if (e.kind === 'roll') return rollEntry(id, data)
  if (e.kind === 'answer') {
    return {
      type: 'answer',
      id,
      player: String(data.player),
      question: String(data.question ?? ''),
      text: String(data.text)
    }
  }
  return {
    type: 'narration',
    id,
    text: String(data.text),
    voice: typeof data.voiceName === 'string' ? data.voiceName : null,
    ...(data.recap === true ? { recap: true as const } : {})
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
    entries.push(...entriesFor(e))
  }
  flushUntil(Infinity)
  return { entries, awaitingSince: awaitingNarrationSince(db), call: openCallView(db) }
}
