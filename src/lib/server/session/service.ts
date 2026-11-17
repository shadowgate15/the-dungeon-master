import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { EventKind, Role, SceneState, SessionEvent } from '#lib/session/enums.ts'
import type { Database } from '../db/connect'
import { campaign, campaignCharacter, session, sessionEvent, sessionScene } from '../db/schema'
import { createWorldService } from '../world/service'
import { seedScene } from './seed'

export type Session = typeof session.$inferSelect

/** What a new event carries; the service assigns the id, sequence number and time. */
export interface NewEvent {
  role: Role
  kind: EventKind
  text?: string | null
  npcId?: string | null
  data?: Record<string, unknown> | null
}

/** The input breaks a Session rule (no Character, read-only Campaign, ended Session, ...). */
export class SessionValidationError extends Error {}

/** The Session does not exist. */
export class SessionNotFoundError extends Error {}

/** The Campaign already has an open Session. */
export class SessionAlreadyOpenError extends Error {}

type SceneRow = typeof sessionScene.$inferSelect

const toScene = (row: SceneRow): SceneState => ({
  location: { name: row.locationName, description: row.locationDescription },
  exits: row.exits,
  objects: row.objects,
  npcs: row.npcs,
  mode: row.mode,
  dialogueNpcId: row.dialogueNpcId,
  pendingRoll: row.pendingRoll
})

const sceneColumns = (scene: SceneState, updatedAt: number) => ({
  locationName: scene.location.name,
  locationDescription: scene.location.description,
  exits: scene.exits,
  objects: scene.objects,
  npcs: scene.npcs,
  mode: scene.mode,
  dialogueNpcId: scene.dialogueNpcId,
  pendingRoll: scene.pendingRoll,
  updatedAt
})

/**
 * Sessions, their Scene and their Event log. The Event log is append-only: this service offers no
 * way to edit or remove an event. The Scene changes only through `saveScene`, which the scene
 * runner calls with changes code has validated.
 */
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
    /**
     * Opens a Session for the Campaign's linked Character with its seeded Scene and an empty
     * Event log; one open Session per Campaign.
     */
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
        const startedAt = now()
        const created = tx
          .insert(session)
          .values({ campaignId, characterId, startedAt })
          .returning()
          .get()
        // World locations do not exist yet, so the first Scene is the generic starting tavern.
        tx.insert(sessionScene)
          .values({ sessionId: created.id, ...sceneColumns(seedScene(), startedAt) })
          .run()
        return created
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

    /** The Session's Scene. Throws when the Session does not exist. */
    scene(sessionId: string): SceneState {
      const row = db.select().from(sessionScene).where(eq(sessionScene.sessionId, sessionId)).get()
      if (!row) throw new SessionNotFoundError('Session not found')
      return toScene(row)
    },

    /** Replaces the Session's Scene. Only code calls this, with changes it has validated. */
    saveScene(sessionId: string, scene: SceneState): void {
      const changed = db
        .update(sessionScene)
        .set(sceneColumns(scene, now()))
        .where(eq(sessionScene.sessionId, sessionId))
        .run().changes
      if (changed === 0) throw new SessionNotFoundError('Session not found')
    },

    /** A Session's Event log in sequence order. */
    events(sessionId: string): SessionEvent[] {
      return db
        .select()
        .from(sessionEvent)
        .where(eq(sessionEvent.sessionId, sessionId))
        .orderBy(asc(sessionEvent.seq))
        .all()
    },

    /** Appends an event to an open Session. The log is append-only; rejects on an ended Session. */
    appendEvent(sessionId: string, input: NewEvent): SessionEvent {
      return db.transaction((tx) => {
        const current = tx.select().from(session).where(eq(session.id, sessionId)).get()
        if (!current) throw new SessionNotFoundError('Session not found')
        if (current.endedAt !== null) throw new SessionValidationError('This Session has ended')
        const last = tx
          .select({ seq: sessionEvent.seq })
          .from(sessionEvent)
          .where(eq(sessionEvent.sessionId, sessionId))
          .orderBy(desc(sessionEvent.seq))
          .get()
        return tx
          .insert(sessionEvent)
          .values({
            sessionId,
            seq: (last?.seq ?? 0) + 1,
            role: input.role,
            kind: input.kind,
            text: input.text ?? null,
            npcId: input.npcId ?? null,
            data: input.data ?? null,
            createdAt: now()
          })
          .returning()
          .get()
      })
    }
  }
}

export type SessionService = ReturnType<typeof createSessionService>
