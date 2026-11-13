import { and, eq, isNull, sql } from 'drizzle-orm'
import type { MemoryKind } from '#lib/memory/enums.ts'
import type {
  JournalChip,
  JournalEntry,
  JournalPosition,
  JournalView
} from '#lib/memory/journal.ts'
import type { Database } from '../db/connect'
import {
  disposition,
  event,
  faction,
  fact,
  journalMarker,
  npc,
  npcFact,
  place,
  session
} from '../db/schema'

/**
 * The player's read-only Journal: the Campaign's World memory as entries, plus the "last looked"
 * marker per (Campaign, Character). Retired and superseded records are omitted. Whether an
 * entry carries a chip is derived by comparing positions (Session order, then Turn seq) with the
 * marker; there is no change log, so "what changed" comes from the record's kind and fields.
 */
export function createJournal(db: Database, now: () => number = Date.now) {
  /** The Campaign's Sessions oldest first: a Session's place in the story is its index. */
  const sessionOrder = (campaignId: string) =>
    db
      .select({ id: session.id })
      .from(session)
      .where(eq(session.campaignId, campaignId))
      .orderBy(session.startedAt, sql`rowid`)
      .all()
      .map((s) => s.id)

  const markerOf = (campaignId: string, characterId: string) =>
    db
      .select()
      .from(journalMarker)
      .where(
        and(eq(journalMarker.campaignId, campaignId), eq(journalMarker.characterId, characterId))
      )
      .get()

  function view(campaignId: string, characterId: string): JournalView {
    const order = sessionOrder(campaignId)
    const ordinal = (id: string) => order.indexOf(id) + 1
    const key = (p: JournalPosition) => ordinal(p.sessionId) * 1e9 + p.seq

    const markerRow = markerOf(campaignId, characterId)
    const marker = markerRow ? key(markerRow) : 0

    const chipFor = (
      created: JournalPosition,
      changed: JournalPosition,
      what: () => string | null
    ): JournalChip | null => {
      if (key(created) > marker) return { type: 'new' }
      if (key(changed) > marker) return { type: 'updated', what: what() }
      return null
    }

    const entries: (JournalEntry & { order: number })[] = []
    let latest: JournalPosition | undefined
    const see = (p: JournalPosition) => {
      if (!latest || key(p) > key(latest)) latest = p
    }

    const dispositions = db
      .select()
      .from(disposition)
      .where(eq(disposition.characterId, characterId))
      .all()
    const knownFacts = db
      .select({ npcId: npcFact.npcId, title: fact.title })
      .from(npcFact)
      .innerJoin(fact, eq(fact.id, npcFact.factId))
      .where(and(eq(fact.campaignId, campaignId), isNull(fact.retiredAt)))
      .orderBy(sql`fact.rowid`)
      .all()

    const npcs = db
      .select()
      .from(npc)
      .where(and(eq(npc.campaignId, campaignId), isNull(npc.retiredAt)))
      .orderBy(sql`rowid`)
      .all()
    for (const n of npcs) {
      const stance = dispositions.find((d) => d.npcId === n.id)
      const created = { sessionId: n.createdSessionId, seq: n.createdSeq }
      const own = { sessionId: n.changedSessionId, seq: n.changedSeq }
      const stancePos = stance && { sessionId: stance.changedSessionId, seq: stance.changedSeq }
      const changed = stancePos && key(stancePos) > key(own) ? stancePos : own
      see(changed)
      entries.push({
        id: n.id,
        kind: 'npc',
        name: n.name,
        summary: n.description ?? '',
        ...(n.role ? { role: n.role } : {}),
        status: n.status,
        ...(stance ? { stance: stance.stance } : {}),
        knows: knownFacts.filter((k) => k.npcId === n.id).map((k) => k.title),
        session: ordinal(n.createdSessionId),
        chip: chipFor(created, changed, () => {
          const fields: string[] = []
          if (stancePos && key(stancePos) > marker) fields.push('stance')
          if (key(own) > marker) fields.push(n.status === 'alive' ? 'description' : 'status')
          return fields.join(', ') || null
        }),
        order: n.createdSeq
      })
    }

    const facts = db
      .select()
      .from(fact)
      .where(and(eq(fact.campaignId, campaignId), isNull(fact.retiredAt)))
      .orderBy(sql`rowid`)
      .all()
    for (const f of facts) {
      const changed = { sessionId: f.changedSessionId, seq: f.changedSeq }
      see(changed)
      entries.push({
        id: f.id,
        kind: 'fact',
        name: f.title,
        summary: f.detail ?? '',
        session: ordinal(f.createdSessionId),
        chip: chipFor({ sessionId: f.createdSessionId, seq: f.createdSeq }, changed, () => null),
        order: f.createdSeq
      })
    }

    const named = [
      ['place', place],
      ['faction', faction],
      ['event', event]
    ] as const satisfies readonly (readonly [MemoryKind, unknown])[]
    for (const [kind, table] of named) {
      const rows = db
        .select()
        .from(table)
        .where(and(eq(table.campaignId, campaignId), isNull(table.retiredAt)))
        .orderBy(sql`rowid`)
        .all()
      for (const r of rows) {
        const changed = { sessionId: r.changedSessionId, seq: r.changedSeq }
        see(changed)
        entries.push({
          id: r.id,
          kind,
          name: r.name,
          summary: r.description ?? '',
          session: ordinal(r.createdSessionId),
          chip: chipFor({ sessionId: r.createdSessionId, seq: r.createdSeq }, changed, () => null),
          order: r.createdSeq
        })
      }
    }

    // Story order: by Session, then by when first written. The sort is stable, so ties keep
    // their kind order (people, facts, then places, factions, events).
    entries.sort((a, b) => a.session - b.session || a.order - b.order)
    return {
      entries: entries.map((e) => {
        const entry: JournalEntry & { order?: number } = { ...e }
        delete entry.order
        return entry
      }),
      unseen: entries.filter((e) => e.chip).length,
      ...(latest ? { through: latest } : {})
    }
  }

  return {
    view,

    /**
     * Advances the marker to `through` (the position the player was shown), or to the latest
     * position now when none is given. Never moves it backwards.
     */
    markSeen(campaignId: string, characterId: string, through?: JournalPosition): void {
      const target = through ?? view(campaignId, characterId).through
      if (!target) return
      const order = sessionOrder(campaignId)
      if (order.indexOf(target.sessionId) < 0) return
      const key = (p: JournalPosition) => (order.indexOf(p.sessionId) + 1) * 1e9 + p.seq
      const existing = markerOf(campaignId, characterId)
      if (existing && key(existing) >= key(target)) return
      db.insert(journalMarker)
        .values({
          campaignId,
          characterId,
          sessionId: target.sessionId,
          seq: target.seq,
          updatedAt: now()
        })
        .onConflictDoUpdate({
          target: [journalMarker.campaignId, journalMarker.characterId],
          set: { sessionId: target.sessionId, seq: target.seq, updatedAt: now() }
        })
        .run()
    }
  }
}

export type Journal = ReturnType<typeof createJournal>
