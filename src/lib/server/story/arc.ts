import { asc, eq, inArray } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { act, arc, beat } from '../db/schema'
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
  const found = db.select().from(arc).where(eq(arc.state, 'current')).get()
  return found ? arcView(db, found) : null
}

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
