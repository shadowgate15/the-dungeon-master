/**
 * What the Narrator's context reads beyond the Event log and Scene: the Rolling summary and the
 * Campaign's World memory records. A port with a database-backed reader, so pipeline tests can
 * leave it out and the Narrator then sees history and Scene only.
 */
import { and, eq, inArray, isNull, max } from 'drizzle-orm'
import type { Database } from '../../db/connect'
import { fact, npc, npcFact, place, session, sessionEvent } from '../../db/schema'
import type { WorldRecords } from './world-selection.ts'

/** A record changed within this many events of the Session's latest counts as recent. Tunable. */
export const RECENT_CHANGE_EVENTS = 20

export interface ContextSources {
  /** The Session's Rolling summary and the last event seq it covers. */
  summary(sessionId: string): { text: string | null; throughSeq: number }
  /** The Session's Campaign World memory, with retired records marked; null for an unknown Session. */
  world(sessionId: string): WorldRecords | null
}

export function createWorldReader(db: Database) {
  return (sessionId: string): WorldRecords | null => {
    const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
    if (!owner) return null
    const latest =
      db
        .select({ seq: max(sessionEvent.seq) })
        .from(sessionEvent)
        .where(eq(sessionEvent.sessionId, sessionId))
        .get()?.seq ?? 0
    const recent = (r: { changedSessionId: string | null; changedSeq: number | null }) =>
      r.changedSessionId === sessionId &&
      r.changedSeq !== null &&
      r.changedSeq > latest - RECENT_CHANGE_EVENTS

    const places = db.select().from(place).where(eq(place.campaignId, owner.campaignId)).all()
    const npcs = db.select().from(npc).where(eq(npc.campaignId, owner.campaignId)).all()
    const facts = db
      .select()
      .from(fact)
      .where(
        and(
          eq(fact.campaignId, owner.campaignId),
          isNull(fact.retiredAt),
          isNull(fact.supersededById)
        )
      )
      .all()
    const links = facts.length
      ? db
          .select()
          .from(npcFact)
          .where(
            inArray(
              npcFact.factId,
              facts.map((f) => f.id)
            )
          )
          .all()
      : []
    return {
      places: places.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        retired: p.retiredAt !== null,
        recent: recent(p)
      })),
      npcs: npcs.map((n) => ({
        id: n.id,
        name: n.name,
        role: n.role,
        description: n.description,
        status: n.status,
        retired: n.retiredAt !== null,
        recent: recent(n)
      })),
      facts: facts.map((f) => ({
        id: f.id,
        title: f.title,
        detail: f.detail,
        worldChanging: f.worldChanging,
        recent: recent(f),
        npcIds: links.filter((l) => l.factId === f.id).map((l) => l.npcId)
      }))
    }
  }
}
