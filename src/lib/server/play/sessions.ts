import { and, desc, eq, gt, isNotNull, sql, type SQL } from 'drizzle-orm'
import type { SessionHistory } from '#lib/play/sessions.ts'
import type { Queryable } from '../db/connect'
import { event, session } from '../db/schema'
import { ToolError } from '../tools/contract'
import { currentSession, hasNarration } from './log'

type SessionRow = typeof session.$inferSelect

/** The in-fiction span of a Session: the clock minutes of its first and last Events. */
function span(db: Queryable, sessionId: string): { from: number; to: number } | null {
  const row = db.get<{ from: number | null; to: number | null }>(
    sql`SELECT min(${event.minute}) AS "from", max(${event.minute}) AS "to" FROM ${event}
        WHERE ${event.sessionId} = ${sessionId}`
  )
  return row?.from == null || row.to == null ? null : { from: row.from, to: row.to }
}

/** Whether the Session closed with no summary (it had no Narration): it is left out of lists. */
const empty = (s: SessionRow) => s.closedAt !== null && s.summary === null

/**
 * Closes a Session with its summary, in the caller's transaction: the current Session, or the
 * numbered one for a catch-up close. A Session with no Narration closes with no summary.
 */
export function closeSession(
  db: Queryable,
  {
    summary,
    threads,
    session: number,
    at
  }: {
    summary: string
    threads: string[]
    session?: number
    at: number
  }
) {
  const target =
    number === undefined
      ? currentSession(db)
      : db.select().from(session).where(eq(session.number, number)).get()
  if (!target) {
    throw number === undefined
      ? new ToolError(
          'no_open_session',
          'No Session is open',
          'Call sessions to see which Sessions exist'
        )
      : new ToolError(
          'unknown_session',
          `There is no Session ${number}`,
          'Call sessions for the Session numbers'
        )
  }
  if (target.closedAt !== null) {
    throw new ToolError(
      'session_closed',
      `Session ${target.number} is already closed; summaries are not rewritten`,
      'Fix anything wrong in play through the ordinary tools'
    )
  }
  const written = hasNarration(db, target.id)
  db.update(session)
    .set({
      closedAt: at,
      summary: written ? summary : null,
      threads: written ? threads : null
    })
    .where(eq(session.id, target.id))
    .run()
  return written
    ? { session: target.number, summarised: true }
    : {
        session: target.number,
        summarised: false,
        note: 'The Session had no Narration, so it closed with no summary'
      }
}

/**
 * What the DM recalls of earlier sittings: Session summaries newest first (none for empty
 * Sessions), the current Session, older unclosed ones awaiting a catch-up close, and whether a
 * recap is due (an earlier sitting has a summary, or will once its catch-up close writes one,
 * and no recap was given this one).
 */
export function sessionsView(db: Queryable, last?: number) {
  const all = db.select().from(session).orderBy(desc(session.number)).all()
  const current = currentSession(db)
  const listed = all.filter((s) => !empty(s) && s.id !== current?.id)
  const recapGiven =
    current !== undefined &&
    db
      .select({ id: event.id })
      .from(event)
      .where(
        and(
          eq(event.sessionId, current.id),
          eq(event.kind, 'narration'),
          sql`json_extract(${event.data}, '$.recap') = 1`
        )
      )
      .get() !== undefined
  return {
    current: current?.number ?? null,
    unclosed: all
      .filter((s) => s.closedAt === null && s.id !== current?.id)
      .map((s) => s.number)
      .reverse(),
    recap_due:
      current !== undefined &&
      !recapGiven &&
      all.some(
        (s) =>
          s.number < current.number &&
          (s.summary !== null || (s.closedAt === null && hasNarration(db, s.id)))
      ),
    sessions: listed.slice(0, last).map((s) => ({
      number: s.number,
      closed: s.closedAt !== null,
      started_at: new Date(s.startedAt).toISOString(),
      span: span(db, s.id),
      summary: s.summary,
      threads: s.threads ?? []
    }))
  }
}

/**
 * The Player's Session history: each closed Session with a summary, newest first. It reads only
 * summaries, which are Player-safe, so it cannot leak.
 */
export function sessionHistory(db: Queryable): SessionHistory {
  return {
    sessions: db
      .select()
      .from(session)
      .where(and(isNotNull(session.closedAt), isNotNull(session.summary)))
      .orderBy(desc(session.number))
      .all()
      .map((s) => ({
        number: s.number,
        startedAt: s.startedAt,
        span: span(db, s.id),
        summary: s.summary!,
        threads: s.threads ?? []
      }))
  }
}

/** Indexes a Narration's text for `history`'s full-text query. Recaps are never indexed. */
export function indexNarration(db: Queryable, eventId: number, text: string) {
  db.run(sql`INSERT INTO narration_search (event_id, text) VALUES (${eventId}, ${text})`)
}

/**
 * The Event log for the DM, newest first: every Event (DM-only ones too) but recaps, which never
 * feed later summaries. `query` is full-text over Narration.
 */
export function history(
  db: Queryable,
  {
    about,
    session: number,
    since,
    query,
    limit = 50
  }: { about?: string; session?: number; since?: number; query?: string; limit?: number }
) {
  const numbers = new Map(
    db
      .select({ id: session.id, number: session.number })
      .from(session)
      .all()
      .map((s) => [s.id, s.number])
  )
  const where: (SQL | undefined)[] = [
    sql`NOT (${event.kind} = 'narration' AND coalesce(json_extract(${event.data}, '$.recap'), 0) = 1)`
  ]
  if (number !== undefined) {
    const id = [...numbers].find(([, n]) => n === number)?.[0]
    where.push(id === undefined ? sql`0` : eq(event.sessionId, id))
  }
  if (since !== undefined) where.push(gt(event.id, since))
  if (about !== undefined) {
    where.push(
      sql`(instr(${event.summary}, ${about}) > 0 OR instr(coalesce(${event.data}, ''), ${about}) > 0)`
    )
  }
  if (query !== undefined) {
    const words = query.match(/[\p{L}\p{N}]+/gu) ?? []
    if (!words.length) return []
    const match = words.map((w) => `"${w}"*`).join(' OR ')
    where.push(
      sql`${event.id} IN (SELECT event_id FROM narration_search WHERE narration_search MATCH ${match})`
    )
  }
  return db
    .select()
    .from(event)
    .where(and(...where))
    .orderBy(desc(event.id))
    .limit(limit)
    .all()
    .map((e) => ({
      id: e.id,
      session: e.sessionId === null ? null : (numbers.get(e.sessionId) ?? null),
      minute: e.minute,
      tool: e.tool,
      kind: e.kind,
      summary: e.summary,
      ...(e.dmOnly ? { dm_only: true } : {})
    }))
}
