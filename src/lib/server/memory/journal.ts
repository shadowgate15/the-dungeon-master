/**
 * The Journal: the player's read-only view of World memory, pure code with no model call. It is
 * Campaign-scoped and grouped by the Session a record was created in, newest first. An NPC shows
 * only once the player has met them (in a Scene) or read their name in narration, and only as
 * name, role, status and stance toward the playing Character: never what they know.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Journal, JournalGroup } from '#lib/memory/journal.ts'
import { normalizeName } from '#lib/memory/validate.ts'
import type { Database } from '../db/connect.ts'
import { disposition, fact, npc, place, session, sessionEvent, sessionScene } from '../db/schema.ts'

export function createJournal(db: Database) {
  /** NPC ids the player has met: in any Scene of the Campaign, or voicing an event. */
  function metNpcIds(campaignId: string): Set<string> {
    const ids = new Set<string>()
    const sessionIds = db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.campaignId, campaignId))
      .all()
      .map((s) => s.id)
    if (sessionIds.length === 0) return ids
    for (const row of db
      .select()
      .from(sessionScene)
      .where(inArray(sessionScene.sessionId, sessionIds))
      .all()) {
      row.npcs.forEach((id) => ids.add(id))
    }
    for (const row of db
      .select({ npcId: sessionEvent.npcId })
      .from(sessionEvent)
      .where(inArray(sessionEvent.sessionId, sessionIds))
      .all()) {
      if (row.npcId) ids.add(row.npcId)
    }
    return ids
  }

  function narrationKey(campaignId: string): string {
    const sessionIds = db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.campaignId, campaignId))
      .all()
      .map((s) => s.id)
    if (sessionIds.length === 0) return ''
    const texts = db
      .select({ text: sessionEvent.text })
      .from(sessionEvent)
      .where(and(inArray(sessionEvent.sessionId, sessionIds), eq(sessionEvent.kind, 'narration')))
      .all()
    return ` ${normalizeName(texts.map((t) => t.text ?? '').join(' '))} `
  }

  return {
    read(campaignId: string, characterId: string): Journal {
      const numbers = new Map(
        db
          .select()
          .from(session)
          .where(eq(session.campaignId, campaignId))
          .orderBy(asc(session.startedAt))
          .all()
          .map((s, i) => [s.id, i + 1] as const)
      )

      /** Groups rows by creating Session, newest Session first, keeping row order within. */
      function group<R extends { createdSessionId: string }, T>(
        rows: R[],
        entry: (row: R) => T
      ): JournalGroup<T>[] {
        const groups = new Map<string, JournalGroup<T>>()
        for (const row of rows) {
          const g = groups.get(row.createdSessionId) ?? {
            sessionId: row.createdSessionId,
            sessionNumber: numbers.get(row.createdSessionId) ?? 0,
            entries: []
          }
          g.entries.push(entry(row))
          groups.set(row.createdSessionId, g)
        }
        return [...groups.values()].sort((a, b) => b.sessionNumber - a.sessionNumber)
      }

      const met = metNpcIds(campaignId)
      const narration = narrationKey(campaignId)
      const stances = new Map(
        db
          .select()
          .from(disposition)
          .where(eq(disposition.characterId, characterId))
          .all()
          .map((d) => [d.npcId, d.stance] as const)
      )
      const people = db
        .select()
        .from(npc)
        .where(and(eq(npc.campaignId, campaignId), isNull(npc.retiredAt)))
        .orderBy(asc(npc.name))
        .all()
        .filter((n) => met.has(n.id) || narration.includes(` ${n.nameKey.replace(/-/g, ' ')} `))

      return {
        people: group(people, (n) => ({
          id: n.id,
          name: n.name,
          role: n.role,
          status: n.status,
          stance: stances.get(n.id) ?? 'neutral'
        })),
        places: group(
          db
            .select()
            .from(place)
            .where(and(eq(place.campaignId, campaignId), isNull(place.retiredAt)))
            .orderBy(asc(place.name))
            .all(),
          (p) => ({ id: p.id, name: p.name, description: p.description })
        ),
        facts: group(
          db
            .select()
            .from(fact)
            .where(
              and(
                eq(fact.campaignId, campaignId),
                isNull(fact.retiredAt),
                isNull(fact.supersededById)
              )
            )
            .orderBy(asc(fact.title))
            .all(),
          (f) => ({ id: f.id, title: f.title, detail: f.detail })
        )
      }
    }
  }
}

export type JournalReader = ReturnType<typeof createJournal>
