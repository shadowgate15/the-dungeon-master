import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { validateDisposition } from '#lib/memory/validate.ts'
import type {
  Attitude,
  EventKind,
  Role,
  SceneNpc,
  SceneState,
  SessionEvent
} from '#lib/session/enums.ts'
import type { Database } from '../db/connect'
import type { ChatPort } from '../ai/port'
import { NO_MODEL_MESSAGE } from '#lib/ai/status.ts'
import { createCharacterService } from '../character/service'
import {
  arc,
  arcAct,
  arcBeat,
  campaign,
  campaignCharacter,
  disposition,
  fact,
  npc,
  npcFact,
  place,
  placeExit,
  session,
  sessionEvent,
  sessionScene,
  world,
  worldCampaign
} from '../db/schema'
import { createWorldService } from '../world/service'
import { generateFirstScene, type FirstSceneInput } from './first-scene'

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

/** The opening Scene could not be generated, so no Session was created. The message says why. */
export class SessionStartError extends Error {}

/** The Session does not exist. */
export class SessionNotFoundError extends Error {}

/** The Campaign already has an open Session. */
export class SessionAlreadyOpenError extends Error {}

type SceneRow = typeof sessionScene.$inferSelect

/** The Director-menu handle of an NPC: its unique name key, hyphenated. */
const npcKey = (nameKey: string) => nameKey.replace(/\s+/g, '-')

/** The change `changeAttitude` applies; the note stays as it was when omitted. */
export interface AttitudeChange {
  stance: string
  note?: string
}

export type AttitudeResult = { ok: true } | { ok: false; reason: string }

const sceneColumns = (scene: SceneState, updatedAt: number) => ({
  locationName: scene.location.name,
  locationDescription: scene.location.description,
  exits: scene.exits,
  objects: scene.objects,
  // The Scene stores NPC row ids only; everything else about them is read from World memory.
  npcs: scene.npcs.map((n) => n.id),
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
export function createSessionService(
  db: Database,
  now: () => number = Date.now,
  /** The model a Campaign's first Session generates its opening Scene with. */
  port?: ChatPort
) {
  const worlds = createWorldService(db, now)
  const characters = createCharacterService(db)

  /**
   * Resolves the Scene's NPC ids against World memory right now: current name, the
   * `(npc, character)` stance (neutral if none) and knowledge (the disposition note plus the live
   * Facts the NPC is linked to). Only alive, non-retired NPCs of the Campaign resolve, in stored
   * order. The dialogue partner must resolve too, else the Scene reads as exploration.
   */
  function resolveScene(row: SceneRow): SceneState {
    const owner = db.select().from(session).where(eq(session.id, row.sessionId)).get()
    let npcs: SceneNpc[] = []
    if (owner && row.npcs.length > 0) {
      const rows = db
        .select()
        .from(npc)
        .where(
          and(
            inArray(npc.id, row.npcs),
            eq(npc.campaignId, owner.campaignId),
            eq(npc.status, 'alive'),
            isNull(npc.retiredAt)
          )
        )
        .all()
      const dispositions = db
        .select()
        .from(disposition)
        .where(
          and(inArray(disposition.npcId, row.npcs), eq(disposition.characterId, owner.characterId))
        )
        .all()
      const known = db
        .select({ npcId: npcFact.npcId, title: fact.title, detail: fact.detail })
        .from(npcFact)
        .innerJoin(fact, eq(fact.id, npcFact.factId))
        .where(
          and(inArray(npcFact.npcId, row.npcs), isNull(fact.retiredAt), isNull(fact.supersededById))
        )
        .orderBy(asc(fact.title), asc(fact.id))
        .all()
      npcs = row.npcs.flatMap((id) => {
        const found = rows.find((r) => r.id === id)
        if (!found) return []
        const stance = dispositions.find((d) => d.npcId === id)
        const knowledge = [
          stance?.note ?? '',
          ...known.filter((k) => k.npcId === id).map((k) => `${k.title}: ${k.detail}`)
        ]
          .filter(Boolean)
          .join(' ')
        return [
          {
            id,
            key: npcKey(found.nameKey),
            name: found.name,
            attitude: (stance?.stance ?? 'neutral') as Attitude,
            knowledge
          }
        ]
      })
    }
    const partner = npcs.some((n) => n.id === row.dialogueNpcId)
    return {
      location: { name: row.locationName, description: row.locationDescription },
      exits: row.exits,
      objects: row.objects,
      npcs,
      mode: partner ? row.mode : 'exploration',
      dialogueNpcId: partner ? row.dialogueNpcId : null,
      pendingRoll: row.pendingRoll
    }
  }

  const sceneRow = (sessionId: string) => {
    const row = db.select().from(sessionScene).where(eq(sessionScene.sessionId, sessionId)).get()
    if (!row) throw new SessionNotFoundError('Session not found')
    return row
  }

  function saveScene(sessionId: string, scene: SceneState): void {
    const changed = db
      .update(sessionScene)
      .set(sceneColumns(scene, now()))
      .where(eq(sessionScene.sessionId, sessionId))
      .run().changes
    if (changed === 0) throw new SessionNotFoundError('Session not found')
  }

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

  type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

  /** The rules every start obeys; throws `SessionValidationError` when one is broken. */
  function checkStartable(q: Tx | Database, campaignId: string) {
    const camp = q.select().from(campaign).where(eq(campaign.id, campaignId)).get()
    if (!camp) throw new SessionValidationError('Campaign not found')
    if (camp.archivedAt !== null || worlds.isCampaignReadOnly(campaignId)) {
      throw new SessionValidationError('This Campaign is read-only')
    }
    const characterId = q
      .select({ id: campaignCharacter.characterId })
      .from(campaignCharacter)
      .where(eq(campaignCharacter.campaignId, campaignId))
      .get()?.id
    if (!characterId) throw new SessionValidationError('Link a Character first')
    const accepted = q
      .select()
      .from(arc)
      .where(and(eq(arc.campaignId, campaignId), eq(arc.status, 'accepted')))
      .get()
    if (!accepted) throw new SessionValidationError('Accept the Arc before starting a Session')
    if (openSession(campaignId)) {
      throw new SessionAlreadyOpenError('This Campaign already has an open Session')
    }
    return { camp, characterId, arcId: accepted.id }
  }

  const recheck = (tx: Tx, campaignId: string) => void checkStartable(tx, campaignId)

  const insertSession = (tx: Tx, campaignId: string, characterId: string) =>
    tx.insert(session).values({ campaignId, characterId, startedAt: now() }).returning().get()

  /**
   * Validates the start and gathers what it needs: the previous Session's Scene for a later
   * Session, or the model input and hosting World for the first.
   */
  function readyToStart(campaignId: string) {
    const { camp, characterId, arcId } = checkStartable(db, campaignId)
    const latest = listNewestFirst(campaignId)[0]
    const previous =
      latest && db.select().from(sessionScene).where(eq(sessionScene.sessionId, latest.id)).get()
    if (previous) return { characterId, previous, worldId: '', input: undefined as never }

    const linked = db
      .select({ id: world.id, name: world.name, premise: world.premise })
      .from(worldCampaign)
      .innerJoin(world, eq(world.id, worldCampaign.worldId))
      .where(eq(worldCampaign.campaignId, campaignId))
      .orderBy(asc(world.name), asc(world.id))
      .all()
    const act = db
      .select()
      .from(arcAct)
      .where(eq(arcAct.arcId, arcId))
      .orderBy(asc(arcAct.position))
      .get()
    if (!act || linked.length === 0) {
      throw new SessionValidationError('Accept the Arc before starting a Session')
    }
    const beats = db
      .select()
      .from(arcBeat)
      .where(eq(arcBeat.actId, act.id))
      .orderBy(asc(arcBeat.position))
      .all()
    const hero = characters.get(characterId)
    const input: FirstSceneInput = {
      campaign: { name: camp.name, premise: camp.premise, tone: camp.tone, length: camp.length },
      worlds: linked.map((w) => ({ name: w.name, premise: w.premise })),
      act: {
        name: act.name,
        purpose: act.purpose,
        beats: beats.map((b) => ({ title: b.title, description: b.description }))
      },
      character: {
        name: hero?.name ?? 'the Character',
        race: hero?.raceSlug ?? '',
        class: hero?.classSlug ?? ''
      }
    }
    return { characterId, previous: undefined, worldId: linked[0].id, input }
  }

  return {
    /**
     * Opens a Session for the Campaign's linked Character with an empty Event log; one open
     * Session per Campaign, and an accepted Arc is required. The Campaign's first Session starts
     * in a Scene generated from its World, Seed and Arc (three staged model calls) and stored as
     * World memory in one transaction; any stage failing throws `SessionStartError` and creates
     * nothing. Later Sessions open on a copy of the previous Session's Scene, with no model call.
     */
    async start(campaignId: string): Promise<Session> {
      const ready = readyToStart(campaignId)
      if (ready.previous) {
        const previous = ready.previous
        return db.transaction((tx) => {
          recheck(tx, campaignId)
          const created = insertSession(tx, campaignId, ready.characterId)
          tx.insert(sessionScene)
            .values({ ...previous, sessionId: created.id, updatedAt: created.startedAt })
            .run()
          return created
        })
      }

      if (!port) {
        throw new SessionStartError('Could not generate the opening Scene: ' + NO_MODEL_MESSAGE)
      }
      const result = await generateFirstScene(port, ready.input)
      if (!result.ok) {
        throw new SessionStartError(
          'Could not generate the opening Scene (' + result.stage + '): ' + result.message
        )
      }
      const { draft } = result

      return db.transaction((tx) => {
        recheck(tx, campaignId)
        const created = insertSession(tx, campaignId, ready.characterId)
        const stamp = {
          createdSessionId: created.id,
          createdSeq: null,
          changedSessionId: created.id,
          changedSeq: null
        }
        const hosted = tx
          .insert(place)
          .values({
            campaignId,
            worldId: ready.worldId,
            name: draft.place.name,
            description: draft.place.description,
            ...stamp
          })
          .returning()
          .get()
        tx.insert(placeExit)
          .values(draft.exits.map((e) => ({ placeId: hosted.id, name: e.name })))
          .run()
        const present = draft.npcs.map((n) => {
          const row = tx
            .insert(npc)
            .values({
              campaignId,
              name: n.name,
              nameKey: n.nameKey,
              description: n.description,
              role: n.role,
              placeId: hosted.id,
              ...stamp
            })
            .returning()
            .get()
          tx.insert(disposition)
            .values({
              npcId: row.id,
              characterId: ready.characterId,
              stance: n.attitude,
              note: n.knowledge,
              changedSessionId: created.id,
              changedSeq: null
            })
            .run()
          return row.id
        })
        tx.insert(sessionScene)
          .values({
            sessionId: created.id,
            locationName: draft.place.name,
            locationDescription: draft.place.description,
            exits: draft.exits,
            objects: draft.objects,
            npcs: present,
            mode: 'exploration',
            dialogueNpcId: null,
            pendingRoll: null,
            updatedAt: created.startedAt
          })
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

    /**
     * The Session's Scene, with its NPCs resolved from World memory as of now. Throws when the
     * Session does not exist.
     */
    scene(sessionId: string): SceneState {
      return resolveScene(sceneRow(sessionId))
    },

    /** Replaces the Session's Scene. Only code calls this, with changes it has validated. */
    saveScene,

    /**
     * Drops NPC ids that no longer resolve (dead, departed, missing, retired) from the stored
     * Scene, ending dialogue with one of them. The scene runner calls this at each run boundary.
     */
    pruneScene(sessionId: string): void {
      saveScene(sessionId, resolveScene(sceneRow(sessionId)))
    },

    /**
     * Code puts an NPC in the Scene (a newcomer narration placed here). Only an alive,
     * non-retired NPC of the Session's Campaign can be placed; false when it cannot. Placing one
     * already present is a no-op that returns true.
     */
    placeNpc(sessionId: string, npcId: string): boolean {
      const row = sceneRow(sessionId)
      const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
      const found = db.select().from(npc).where(eq(npc.id, npcId)).get()
      if (
        !owner ||
        !found ||
        found.campaignId !== owner.campaignId ||
        found.status !== 'alive' ||
        found.retiredAt !== null
      ) {
        return false
      }
      if (!row.npcs.includes(npcId)) {
        db.update(sessionScene)
          .set({ npcs: [...row.npcs, npcId], updatedAt: now() })
          .where(eq(sessionScene.sessionId, sessionId))
          .run()
      }
      return true
    },

    /**
     * A validated write to the NPC's disposition toward the Session's Character, with the same
     * validator memory extraction uses (known stance, note limits, no digits). The Scene sees it
     * on its next read. The note stays as it was when omitted.
     */
    changeAttitude(sessionId: string, npcId: string, change: AttitudeChange): AttitudeResult {
      const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
      if (!owner) throw new SessionNotFoundError('Session not found')
      const found = db.select().from(npc).where(eq(npc.id, npcId)).get()
      if (!found || found.campaignId !== owner.campaignId) {
        return { ok: false, reason: 'unknown NPC' }
      }
      const existing = db
        .select()
        .from(disposition)
        .where(and(eq(disposition.npcId, npcId), eq(disposition.characterId, owner.characterId)))
        .get()
      const checked = validateDisposition({
        stance: change.stance,
        note: change.note ?? existing?.note ?? ''
      })
      if (!checked.ok) return { ok: false, reason: checked.reason }
      const last = db
        .select({ seq: sessionEvent.seq })
        .from(sessionEvent)
        .where(eq(sessionEvent.sessionId, sessionId))
        .orderBy(desc(sessionEvent.seq))
        .get()
      const values = {
        stance: checked.value.stance,
        note: checked.value.note,
        changedSessionId: sessionId,
        changedSeq: last?.seq ?? null
      }
      db.insert(disposition)
        .values({ npcId, characterId: owner.characterId, ...values })
        .onConflictDoUpdate({ target: [disposition.npcId, disposition.characterId], set: values })
        .run()
      return { ok: true }
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
