import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { campaign, campaignCharacter, character, session, turn } from '../db/schema'
import { createWorldService } from '../world/service'

export type Session = typeof session.$inferSelect
export type Turn = typeof turn.$inferSelect

/** What a new Turn carries; the service assigns the sequence number and time. */
export type NewTurn = Pick<Turn, 'author' | 'kind'> &
  Partial<Pick<Turn, 'text' | 'rollRequest' | 'rollResult'>>

/** The input breaks a Session rule (no Character, archived or read-only Campaign, ...). */
export class SessionValidationError extends Error {}

/** The Session does not exist. */
export class SessionNotFoundError extends Error {}

/** The Campaign already has an open Session. */
export class SessionAlreadyOpenError extends Error {}

export function createSessionService(db: Database, now: () => number = Date.now) {
  const worlds = createWorldService(db, now)

  const openSession = (campaignId: string) =>
    db
      .select()
      .from(session)
      .where(and(eq(session.campaignId, campaignId), isNull(session.endedAt)))
      .get()

  const listNewestFirst = (campaignId: string) =>
    db
      .select()
      .from(session)
      .where(eq(session.campaignId, campaignId))
      .orderBy(desc(session.startedAt), sql`rowid desc`)
      .all()

  return {
    /** The Campaign's linked Character, if any. The app links one per Campaign. */
    linkedCharacterId(campaignId: string): string | undefined {
      return db
        .select({ id: campaignCharacter.characterId })
        .from(campaignCharacter)
        .where(eq(campaignCharacter.campaignId, campaignId))
        .get()?.id
    },

    /** Links the Character to the Campaign, replacing any earlier link. Not while a Session is open. */
    linkCharacter(campaignId: string, characterId: string): void {
      db.transaction((tx) => {
        const camp = tx.select().from(campaign).where(eq(campaign.id, campaignId)).get()
        if (!camp) throw new SessionValidationError('Campaign not found')
        if (camp.archivedAt !== null || worlds.isCampaignReadOnly(campaignId)) {
          throw new SessionValidationError('This Campaign is read-only')
        }
        const found = tx.select().from(character).where(eq(character.id, characterId)).get()
        if (!found) throw new SessionValidationError('Character not found')
        if (found.archivedAt !== null) {
          throw new SessionValidationError('An archived Character cannot be linked')
        }
        if (openSession(campaignId)) {
          throw new SessionValidationError('End the open Session before changing the Character')
        }
        tx.delete(campaignCharacter).where(eq(campaignCharacter.campaignId, campaignId)).run()
        tx.insert(campaignCharacter).values({ campaignId, characterId }).run()
      })
    },

    /** Opens a Session for the Campaign's linked Character; one open Session per Campaign. */
    start(campaignId: string): Session {
      return db.transaction((tx) => {
        const camp = tx.select().from(campaign).where(eq(campaign.id, campaignId)).get()
        if (!camp) throw new SessionValidationError('Campaign not found')
        if (camp.archivedAt !== null || worlds.isCampaignReadOnly(campaignId)) {
          throw new SessionValidationError('This Campaign is read-only')
        }
        const characterId = tx
          .select({ id: campaignCharacter.characterId })
          .from(campaignCharacter)
          .where(eq(campaignCharacter.campaignId, campaignId))
          .get()?.id
        if (!characterId) throw new SessionValidationError('Link a Character first')
        if (openSession(campaignId)) {
          throw new SessionAlreadyOpenError('This Campaign already has an open Session')
        }
        // The story so far carries over: the newest Session that wrote a summary.
        const previous = tx
          .select({ summary: session.summary })
          .from(session)
          .where(and(eq(session.campaignId, campaignId), isNotNull(session.summary)))
          .orderBy(desc(session.startedAt), sql`rowid desc`)
          .get()
        return tx
          .insert(session)
          .values({ campaignId, characterId, startedAt: now(), summary: previous?.summary ?? null })
          .returning()
          .get()
      })
    },

    /** Ends the Session; a no-op when it already ended. */
    end(id: string): Session {
      const current = db.select().from(session).where(eq(session.id, id)).get()
      if (!current) throw new SessionNotFoundError('Session not found')
      if (current.endedAt !== null) return current
      return db
        .update(session)
        .set({ endedAt: Math.max(now(), current.startedAt + 1) })
        .where(eq(session.id, id))
        .returning()
        .get()
    },

    /**
     * Saves the rolling summary and the last Turn it covers. Deliberately allowed on an ended
     * Session, unlike `appendTurn`: the summary is derived housekeeping, not the transcript. One
     * still being written when the player ends the Session is what the next Session inherits.
     */
    saveSummary(id: string, summary: string, throughSeq: number): void {
      db.update(session)
        .set({ summary, summarizedThroughSeq: throughSeq })
        .where(eq(session.id, id))
        .run()
    },

    get(id: string): Session | undefined {
      return db.select().from(session).where(eq(session.id, id)).get()
    },

    openFor(campaignId: string): Session | undefined {
      return openSession(campaignId)
    },

    /** A Campaign's Sessions, oldest first, each with its number: it never changes once shown. */
    listNumbered(campaignId: string): (Session & { number: number })[] {
      return [...listNewestFirst(campaignId)].reverse().map((s, i) => ({ ...s, number: i + 1 }))
    },

    /** A Campaign's Sessions, newest first. */
    list(campaignId: string): Session[] {
      return listNewestFirst(campaignId)
    },

    /**
     * Appends a Turn to an open Session. Turns are append-only: there is no edit or delete.
     * Rejects on an ended Session.
     */
    appendTurn(sessionId: string, input: NewTurn): Turn {
      return db.transaction((tx) => {
        const current = tx.select().from(session).where(eq(session.id, sessionId)).get()
        if (!current) throw new SessionNotFoundError('Session not found')
        if (current.endedAt !== null) throw new SessionValidationError('This Session has ended')
        const last = tx
          .select({ seq: turn.seq })
          .from(turn)
          .where(eq(turn.sessionId, sessionId))
          .orderBy(desc(turn.seq))
          .get()
        return tx
          .insert(turn)
          .values({
            sessionId,
            seq: (last?.seq ?? 0) + 1,
            author: input.author,
            kind: input.kind,
            text: input.text ?? null,
            rollRequest: input.rollRequest ?? null,
            rollResult: input.rollResult ?? null,
            createdAt: now()
          })
          .returning()
          .get()
      })
    },

    /** A Session's transcript in sequence order. */
    turns(sessionId: string): Turn[] {
      return db
        .select()
        .from(turn)
        .where(eq(turn.sessionId, sessionId))
        .orderBy(asc(turn.seq))
        .all()
    }
  }
}

export type SessionService = ReturnType<typeof createSessionService>
