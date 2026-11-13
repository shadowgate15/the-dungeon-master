import { and, eq, inArray, sql } from 'drizzle-orm'
import type { NpcStatus, Stance } from '#lib/memory/enums.ts'
import type { Database } from '../db/connect'
import { disposition, event, faction, fact, npc, npcFact, place } from '../db/schema'
import type { MemoryInput } from './context'

export type Npc = typeof npc.$inferSelect
export type Fact = typeof fact.$inferSelect
export type Disposition = typeof disposition.$inferSelect

/** Where a write came from: the Session and the Turn seq the extraction covered up to. */
export interface Provenance {
  sessionId: string
  seq: number
}

/**
 * The World memory store: Campaign-scoped NPCs, facts, per-Character dispositions and
 * NPC-knows-fact links. It trusts its caller; validation lives in the extraction module.
 * Records are retired by flag, never deleted (retire arrives with a later ticket).
 */
export function createMemoryRepository(db: Database, now: () => number = Date.now) {
  const stamp = (at: Provenance) => ({
    changedSessionId: at.sessionId,
    changedSeq: at.seq,
    updatedAt: now()
  })

  return {
    /** The Campaign's NPCs, oldest first, including retired ones. */
    npcs(campaignId: string): Npc[] {
      return db
        .select()
        .from(npc)
        .where(eq(npc.campaignId, campaignId))
        .orderBy(sql`rowid`)
        .all()
    },

    /** The Campaign's facts, oldest first, including retired ones. */
    facts(campaignId: string): Fact[] {
      return db
        .select()
        .from(fact)
        .where(eq(fact.campaignId, campaignId))
        .orderBy(sql`rowid`)
        .all()
    },

    /**
     * Every record of the Campaign (retired and superseded included; the renderer drops them),
     * with each NPC's stance toward the Character and the facts it knows. The mention window and
     * focus are the caller's to add.
     */
    snapshot(campaignId: string, characterId: string): Omit<MemoryInput, 'window' | 'focus'> {
      const npcs = this.npcs(campaignId)
      const ids = npcs.map((n) => n.id)
      const dispositions = ids.length
        ? db
            .select()
            .from(disposition)
            .where(and(inArray(disposition.npcId, ids), eq(disposition.characterId, characterId)))
            .all()
        : []
      const links = ids.length
        ? db.select().from(npcFact).where(inArray(npcFact.npcId, ids)).all()
        : []
      const named = (table: typeof place | typeof faction | typeof event) =>
        db
          .select()
          .from(table)
          .where(eq(table.campaignId, campaignId))
          .orderBy(sql`rowid`)
          .all()
      return {
        npcs: npcs.map((n) => {
          const d = dispositions.find((x) => x.npcId === n.id)
          return {
            ...n,
            stance: d?.stance ?? null,
            note: d?.note ?? null,
            knowsFactIds: links.filter((l) => l.npcId === n.id).map((l) => l.factId)
          }
        }),
        places: named(place),
        factions: named(faction),
        events: named(event),
        facts: this.facts(campaignId)
      }
    },

    getNpc(id: string): Npc | undefined {
      return db.select().from(npc).where(eq(npc.id, id)).get()
    },

    dispositions(npcId: string): Disposition[] {
      return db.select().from(disposition).where(eq(disposition.npcId, npcId)).all()
    },

    /** The facts an NPC knows. */
    knownFacts(npcId: string): Fact[] {
      const ids = db
        .select({ id: npcFact.factId })
        .from(npcFact)
        .where(eq(npcFact.npcId, npcId))
        .all()
        .map((r) => r.id)
      if (ids.length === 0) return []
      return db
        .select()
        .from(fact)
        .where(inArray(fact.id, ids))
        .orderBy(sql`rowid`)
        .all()
    },

    createNpc(
      campaignId: string,
      input: { name: string; description: string; role: string; status: NpcStatus },
      at: Provenance
    ): Npc {
      const stampNow = now()
      return db
        .insert(npc)
        .values({
          campaignId,
          ...input,
          createdSessionId: at.sessionId,
          createdSeq: at.seq,
          createdAt: stampNow,
          ...stamp(at)
        })
        .returning()
        .get()
    },

    updateNpc(
      id: string,
      changes: Partial<Pick<Npc, 'name' | 'description' | 'role' | 'status'>>,
      at: Provenance
    ): void {
      db.update(npc)
        .set({ ...changes, ...stamp(at) })
        .where(eq(npc.id, id))
        .run()
    },

    createFact(
      campaignId: string,
      input: { title: string; detail: string | null; worldChanging: boolean },
      at: Provenance
    ): Fact {
      return db
        .insert(fact)
        .values({
          campaignId,
          ...input,
          createdSessionId: at.sessionId,
          createdSeq: at.seq,
          createdAt: now(),
          ...stamp(at)
        })
        .returning()
        .get()
    },

    /** Sets the NPC's stance toward the Character, keeping a note unless a new one is given. */
    setDisposition(
      npcId: string,
      characterId: string,
      input: { stance: Stance; note?: string },
      at: Provenance
    ): void {
      const existing = db
        .select()
        .from(disposition)
        .where(and(eq(disposition.npcId, npcId), eq(disposition.characterId, characterId)))
        .get()
      const note = input.note ?? existing?.note ?? null
      db.insert(disposition)
        .values({ npcId, characterId, stance: input.stance, note, ...stamp(at) })
        .onConflictDoUpdate({
          target: [disposition.npcId, disposition.characterId],
          set: { stance: input.stance, note, ...stamp(at) }
        })
        .run()
    },

    /** Records that the NPC knows the fact; a repeat is a no-op. */
    link(npcId: string, factId: string): void {
      db.insert(npcFact).values({ npcId, factId }).onConflictDoNothing().run()
    }
  }
}

export type MemoryRepository = ReturnType<typeof createMemoryRepository>
