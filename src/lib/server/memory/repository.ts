import { and, eq, inArray, sql } from 'drizzle-orm'
import type { NpcStatus, Stance } from '#lib/memory/enums.ts'
import type { Database } from '../db/connect'
import { disposition, fact, npc, npcFact } from '../db/schema'

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
