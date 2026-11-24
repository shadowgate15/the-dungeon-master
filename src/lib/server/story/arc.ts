import { and, asc, count, desc, eq, gt, inArray, lt, ne } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { act, arc, beat, event } from '../db/schema'
import { expectVersion, ToolError, type ToolContext } from '../tools/contract'
import { slug } from '../world/names'

/** A new Arc as `builder` plans it: Acts in order, each with its Beats in order. */
export type NewArc = {
  title: string
  premise: string
  stakes: string
  resolution: string
  acts: { name: string; purpose: string; beats: { title: string; description: string }[] }[]
}

/** There is already a current Arc; a Campaign has at most one. */
export class CurrentArcError extends Error {}

/** The current Arc in full, as the DM reads it, or null in a gap between Arcs. */
export function currentArc(db: Queryable) {
  const found = currentRow(db)
  return found ? arcView(db, found) : null
}

/** The Arcs that have left current (concluded or retired), oldest first. */
export function pastArcs(db: Queryable) {
  return db
    .select()
    .from(arc)
    .where(ne(arc.state, 'current'))
    .orderBy(asc(arc.createdAt))
    .all()
    .map((found) => arcView(db, found))
}

const currentRow = (db: Queryable) => db.select().from(arc).where(eq(arc.state, 'current')).get()

function arcView(db: Queryable, found: typeof arc.$inferSelect) {
  const acts = db.select().from(act).where(eq(act.arcId, found.id)).orderBy(asc(act.position)).all()
  const beats = acts.length
    ? db
        .select()
        .from(beat)
        .where(
          inArray(
            beat.actId,
            acts.map((a) => a.id)
          )
        )
        .orderBy(asc(beat.position))
        .all()
    : []
  return {
    title: found.title,
    premise: found.premise,
    stakes: found.stakes,
    resolution: found.resolution,
    state: found.state,
    version: found.version,
    ...(found.state === 'current' ? {} : { endReason: found.endReason }),
    acts: acts.map((a) => ({
      name: a.name,
      purpose: a.purpose,
      beats: beats
        .filter((b) => b.actId === a.id)
        .map((b) => ({
          handle: b.handle,
          title: b.title,
          description: b.description,
          state: b.state,
          reason: b.reason
        }))
    }))
  }
}

/** A Beat handle from its title, unique across every Arc the Campaign has had. */
function beatHandle(db: Queryable, title: string, taken: Set<string>): string {
  const base = `beat:${slug(title)}`
  for (let n = 1; ; n++) {
    const handle = n === 1 ? base : `${base}-${n}`
    if (taken.has(handle)) continue
    if (db.select({ handle: beat.handle }).from(beat).where(eq(beat.handle, handle)).get()) continue
    taken.add(handle)
    return handle
  }
}

/** Creates the current Arc; refused (`CurrentArcError`) while one exists. */
export function createArc(db: Queryable, input: NewArc, at: number) {
  if (db.select({ id: arc.id }).from(arc).where(eq(arc.state, 'current')).get()) {
    throw new CurrentArcError('A current Arc already exists')
  }
  const created = db
    .insert(arc)
    .values({
      title: input.title,
      premise: input.premise,
      stakes: input.stakes,
      resolution: input.resolution,
      createdAt: at
    })
    .returning()
    .get()
  const taken = new Set<string>()
  input.acts.forEach((a, position) => {
    const { id } = db
      .insert(act)
      .values({ arcId: created.id, position, name: a.name, purpose: a.purpose })
      .returning({ id: act.id })
      .get()
    a.beats.forEach((b, i) => {
      db.insert(beat)
        .values({
          handle: beatHandle(db, b.title, taken),
          actId: id,
          position: i,
          title: b.title,
          description: b.description
        })
        .run()
    })
  })
  return arcView(db, created)
}

/** Discards every Arc (Start over, before the story has a Narration). */
export function discardArcs(db: Queryable) {
  db.delete(arc).run()
}

/** The Event kinds that change the Arc; the drift count restarts at the latest of them. */
const ARC_CHANGES = ['arc_created', 'beat_resolved', 'arc_revised', 'arc_retired']

/**
 * The drift count: Player Declarations since the last Arc change (`create_arc`, `resolve_beat`,
 * `revise_arc`, or the Arc ending), or since the log began.
 */
export function driftCount(db: Queryable): number {
  const last = db
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.kind, ARC_CHANGES))
    .orderBy(desc(event.id))
    .limit(1)
    .get()
  const where = [eq(event.kind, 'declaration')]
  if (last) where.push(gt(event.id, last.id))
  return (
    db
      .select({ n: count() })
      .from(event)
      .where(and(...where))
      .get()?.n ?? 0
  )
}

type ArcRow = typeof arc.$inferSelect
type BeatRow = typeof beat.$inferSelect

const READ_ARC = 'Read arc() for the current version and call again'

/** The current Arc at `version`, or a refusal the DM can act on. */
function writableArc(db: Queryable, version: number): ArcRow {
  const found = currentRow(db)
  if (!found) {
    throw new ToolError(
      'no_current_arc',
      'There is no current Arc',
      'Read arc(); in a gap, have builder draft the next Arc with create_arc'
    )
  }
  expectVersion({ handle: 'The Arc', version: found.version, read: READ_ARC }, version)
  return found
}

/** A Beat of the current Arc by handle, with the position of its Act. */
function beatOf(db: Queryable, arcId: string, handle: string) {
  const found = db
    .select({ beat, actPosition: act.position })
    .from(beat)
    .innerJoin(act, eq(beat.actId, act.id))
    .where(and(eq(beat.handle, handle), eq(act.arcId, arcId)))
    .get()
  if (!found) {
    throw new ToolError(
      'unknown_beat',
      `The current Arc has no Beat ${handle}`,
      'Check the handle against arc() and call again'
    )
  }
  return found
}

/** Refuses a change to a Beat that has left pending. */
function expectPending(b: BeatRow) {
  if (b.state !== 'pending') {
    throw new ToolError(
      'beat_not_pending',
      `${b.handle} is ${b.state}; a Beat leaves pending once and stays as history`,
      'Add a new Beat with revise_arc instead'
    )
  }
}

const beatSummary = (b: BeatRow) => ({ handle: b.handle, title: b.title, state: b.state })

/** Abandons Beats with a reason and stamp; returns them. */
function abandon(ctx: ToolContext, beats: BeatRow[], reason: string) {
  return beats.map((b) => stampBeat(ctx, b, 'abandoned', reason))
}

function stampBeat(
  { db, stamp, now }: ToolContext,
  b: BeatRow,
  state: 'reached' | 'abandoned',
  reason: string
) {
  return db
    .update(beat)
    .set({
      state,
      reason,
      resolvedAt: now,
      resolvedEvent: stamp.eventId,
      resolvedSession: stamp.sessionId,
      resolvedMinute: stamp.minute
    })
    .where(eq(beat.handle, b.handle))
    .returning()
    .get()
}

/** The pending Beats of an Arc, Act by Act. */
function pendingBeats(db: Queryable, arcId: string) {
  return db
    .select({ beat })
    .from(beat)
    .innerJoin(act, eq(beat.actId, act.id))
    .where(and(eq(act.arcId, arcId), eq(beat.state, 'pending')))
    .orderBy(asc(act.position), asc(beat.position))
    .all()
    .map((r) => r.beat)
}

/** Ends the current Arc (concluded or retired) and bumps its version. */
function endArc(
  db: Queryable,
  found: ArcRow,
  state: 'concluded' | 'retired',
  reason: string,
  at: number
) {
  return db
    .update(arc)
    .set({ state, endedAt: at, endReason: reason, version: found.version + 1 })
    .where(eq(arc.id, found.id))
    .returning()
    .get()
}

const bump = (db: Queryable, found: ArcRow) =>
  db
    .update(arc)
    .set({ version: found.version + 1 })
    .where(eq(arc.id, found.id))
    .returning()
    .get()

/**
 * Settles a pending Beat. Reaching a Beat in a later Act abandons every pending Beat of the earlier
 * Acts (the cascade); when no Beat is left pending, the Arc concludes.
 */
export function resolveBeat(
  ctx: ToolContext,
  input: { beat: string; version: number; to: 'reached' | 'abandoned'; reason: string }
) {
  const { db } = ctx
  const found = writableArc(db, input.version)
  const target = beatOf(db, found.id, input.beat)
  expectPending(target.beat)
  const resolved = stampBeat(ctx, target.beat, input.to, input.reason)
  const passed =
    input.to === 'reached'
      ? db
          .select({ beat })
          .from(beat)
          .innerJoin(act, eq(beat.actId, act.id))
          .where(
            and(
              eq(act.arcId, found.id),
              eq(beat.state, 'pending'),
              lt(act.position, target.actPosition)
            )
          )
          .all()
          .map((r) => r.beat)
      : []
  const cascaded = abandon(
    ctx,
    passed,
    `Play moved past its Act when ${resolved.handle} was reached`
  )
  const concluded = pendingBeats(db, found.id).length === 0
  const after = concluded ? endArc(db, found, 'concluded', input.reason, ctx.now) : bump(db, found)
  return {
    resolved: beatSummary(resolved),
    abandoned: cascaded.map(beatSummary),
    arc: { state: after.state, version: after.version }
  }
}

/** Retires the current Arc: every pending Beat is abandoned with the reason. */
export function retireArc(ctx: ToolContext, input: { version: number; reason: string }) {
  const found = writableArc(ctx.db, input.version)
  const abandoned = abandon(ctx, pendingBeats(ctx.db, found.id), input.reason)
  const after = endArc(ctx.db, found, 'retired', input.reason, ctx.now)
  return {
    title: after.title,
    abandoned: abandoned.map(beatSummary),
    arc: { state: after.state, version: after.version }
  }
}
