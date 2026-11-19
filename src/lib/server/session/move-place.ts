import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { SceneExit } from '#lib/session/enums.ts'
import { createCharacterService } from '../character/service'
import type { Database } from '../db/connect'
import {
  arc,
  arcAct,
  arcBeat,
  campaign,
  disposition,
  npc,
  place,
  placeExit,
  session,
  sessionEvent,
  sessionScene,
  world
} from '../db/schema'
import type { DestinationDraft, DestinationInput } from './destination.ts'
import { exitSlug } from './generation-stages.ts'

/**
 * Moving through an exit stores the destination as a place in World memory. The first move
 * through an exit generates it (through the injected `generate`) and fixes the exit edge's target;
 * later moves, from either side, reuse the stored place. When generation yields nothing the place
 * is a bare one named after the exit, so a move never dead-ends. The Scene is replaced in the same
 * transaction that writes the place.
 */

/** Generates the draft for a destination, or null when it cannot (the caller falls back). */
export type DestinationGenerator = (input: DestinationInput) => Promise<DestinationDraft | null>

const backName = (origin: string) => `Back to ${origin}`

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

export function createPlaceMover(db: Database, now: () => number) {
  const characters = createCharacterService(db)

  /** The edge for the exit in the origin place, with the place itself; null when not stored yet. */
  function findEdge(q: Database | Tx, campaignId: string, originName: string, exitName: string) {
    return q
      .select({ edge: placeExit, origin: place })
      .from(placeExit)
      .innerJoin(place, eq(place.id, placeExit.placeId))
      .where(
        and(
          eq(place.campaignId, campaignId),
          eq(place.name, originName),
          isNull(place.retiredAt),
          eq(placeExit.name, exitName)
        )
      )
      .orderBy(asc(place.createdSeq), asc(place.id))
      .get()
  }

  /** The Scene's exits for a stored place: its edges, ids derived from their names. */
  const exitsOf = (q: Database | Tx, placeId: string): SceneExit[] =>
    q
      .select({ name: placeExit.name })
      .from(placeExit)
      .where(eq(placeExit.placeId, placeId))
      .orderBy(sql`rowid`)
      .all()
      .map((e) => ({ id: exitSlug(e.name), name: e.name }))

  /** The Arc's current Act: the first with a pending Beat, else the last. */
  function currentAct(campaignId: string) {
    const acts = db
      .select({ act: arcAct })
      .from(arcAct)
      .innerJoin(arc, eq(arc.id, arcAct.arcId))
      .where(and(eq(arc.campaignId, campaignId), eq(arc.status, 'accepted')))
      .orderBy(asc(arcAct.position))
      .all()
      .map((r) => r.act)
    const withBeats = acts.map((act) => ({
      act,
      beats: db
        .select()
        .from(arcBeat)
        .where(eq(arcBeat.actId, act.id))
        .orderBy(asc(arcBeat.position))
        .all()
    }))
    const found =
      withBeats.find((a) => a.beats.some((b) => b.state === 'pending')) ?? withBeats.at(-1)
    return found
      ? {
          name: found.act.name,
          purpose: found.act.purpose,
          beats: found.beats.map((b) => ({ title: b.title, description: b.description }))
        }
      : { name: '', purpose: '', beats: [] }
  }

  function writeScene(
    tx: Tx,
    sessionId: string,
    target: {
      name: string
      description: string
      exits: SceneExit[]
      objects: string[]
      npcs: string[]
    }
  ) {
    tx.update(sessionScene)
      .set({
        locationName: target.name,
        locationDescription: target.description,
        exits: target.exits,
        objects: target.objects,
        npcs: target.npcs,
        mode: 'exploration',
        dialogueNpcId: null,
        pendingRoll: null,
        updatedAt: now()
      })
      .where(eq(sessionScene.sessionId, sessionId))
      .run()
  }

  return {
    /**
     * Takes the Session's Scene through one of its exits. Reuses the place the exit already leads
     * to, or creates it (from `generate`, else bare) with a way back, and replaces the Scene.
     * Returns the destination's name. Throws when the Session or the exit does not exist.
     */
    async moveThrough(
      sessionId: string,
      exitId: string,
      generate: DestinationGenerator
    ): Promise<{ name: string }> {
      const owner = db.select().from(session).where(eq(session.id, sessionId)).get()
      const row = db.select().from(sessionScene).where(eq(sessionScene.sessionId, sessionId)).get()
      if (!owner || !row) throw new Error('Session not found')
      const exit = row.exits.find((e) => e.id === exitId)
      if (!exit) throw new Error(`No exit ${exitId} in this Scene`)
      const campaignId = owner.campaignId
      const originName = row.locationName

      const reuse = (tx: Tx) => {
        const edge = findEdge(tx, campaignId, originName, exit.name)
        if (!edge?.edge.targetPlaceId) return null
        const target = tx.select().from(place).where(eq(place.id, edge.edge.targetPlaceId)).get()
        if (!target || target.retiredAt !== null) return null
        const present = tx
          .select({ id: npc.id })
          .from(npc)
          .where(and(eq(npc.placeId, target.id), eq(npc.status, 'alive'), isNull(npc.retiredAt)))
          .orderBy(asc(npc.name))
          .all()
          .map((n) => n.id)
        writeScene(tx, sessionId, {
          name: target.name,
          description: target.description,
          exits: exitsOf(tx, target.id),
          objects: [],
          npcs: present
        })
        return { name: target.name }
      }

      const known = db.transaction((tx) => reuse(tx))
      if (known) return known

      // Not stored yet: ask for it outside any transaction (a model call), then store it.
      const camp = db.select().from(campaign).where(eq(campaign.id, campaignId)).get()
      const origin = findEdge(db, campaignId, originName, exit.name)?.origin
      const host = origin
        ? db.select().from(world).where(eq(world.id, origin.worldId)).get()
        : undefined
      const hostWorld =
        host ??
        db
          .select()
          .from(world)
          .innerJoin(place, and(eq(place.worldId, world.id), eq(place.campaignId, campaignId)))
          .orderBy(asc(place.createdSeq), asc(place.id))
          .get()?.world
      const hero = characters.get(owner.characterId)
      const taken = db
        .select({ key: npc.nameKey })
        .from(npc)
        .where(eq(npc.campaignId, campaignId))
        .all()
        .map((n) => n.key)
      const draft =
        camp && hostWorld
          ? await generate({
              campaign: {
                name: camp.name,
                premise: camp.premise,
                tone: camp.tone,
                length: camp.length
              },
              world: { name: hostWorld.name, premise: hostWorld.premise },
              act: currentAct(campaignId),
              origin: { name: originName, description: row.locationDescription },
              exitName: exit.name,
              character: {
                name: hero?.name ?? 'the Character',
                race: hero?.raceSlug ?? '',
                class: hero?.classSlug ?? ''
              },
              takenNpcKeys: taken
            }).catch(() => null)
          : null

      return db.transaction((tx) => {
        // Another move may have stored it while the model answered.
        const raced = reuse(tx)
        if (raced) return raced

        const last = tx
          .select({ seq: sessionEvent.seq })
          .from(sessionEvent)
          .where(eq(sessionEvent.sessionId, sessionId))
          .orderBy(desc(sessionEvent.seq))
          .get()
        const stamp = {
          createdSessionId: sessionId,
          createdSeq: last?.seq ?? null,
          changedSessionId: sessionId,
          changedSeq: last?.seq ?? null
        }
        const worldId = hostWorld?.id
        if (!worldId) throw new Error('The Campaign has no World to host the place')

        // The origin is a stored place; a Scene that predates that (no row for it) gets one now.
        let edge = findEdge(tx, campaignId, originName, exit.name)
        if (!edge) {
          let originRow = tx
            .select()
            .from(place)
            .where(
              and(
                eq(place.campaignId, campaignId),
                eq(place.name, originName),
                isNull(place.retiredAt)
              )
            )
            .get()
          originRow ??= tx
            .insert(place)
            .values({
              campaignId,
              worldId,
              name: originName,
              description: row.locationDescription,
              ...stamp
            })
            .returning()
            .get()
          tx.insert(placeExit)
            .values({ placeId: originRow.id, name: exit.name })
            .onConflictDoNothing()
            .run()
          edge = findEdge(tx, campaignId, originName, exit.name)
          if (!edge) throw new Error('Could not store the exit')
        }

        const bare = !draft
        const dest = tx
          .insert(place)
          .values({
            campaignId,
            worldId,
            name: draft ? draft.place.name : exit.name,
            description: draft ? draft.place.description : '',
            ...stamp
          })
          .returning()
          .get()
        const way = backName(originName)
        const forward = bare
          ? []
          : draft.exits.map((e) => e.name).filter((n) => exitSlug(n) !== exitSlug(way))
        tx.insert(placeExit)
          .values([
            ...forward.map((name) => ({ placeId: dest.id, name })),
            { placeId: dest.id, name: way, targetPlaceId: edge.origin.id }
          ])
          .run()
        tx.update(placeExit)
          .set({ targetPlaceId: dest.id })
          .where(eq(placeExit.id, edge.edge.id))
          .run()

        const present: string[] = []
        const knownKeys = new Set(
          tx
            .select({ key: npc.nameKey })
            .from(npc)
            .where(eq(npc.campaignId, campaignId))
            .all()
            .map((n) => n.key)
        )
        for (const n of draft?.npcs ?? []) {
          if (knownKeys.has(n.nameKey)) continue
          const created = tx
            .insert(npc)
            .values({
              campaignId,
              name: n.name,
              nameKey: n.nameKey,
              description: n.description,
              role: n.role,
              placeId: dest.id,
              ...stamp
            })
            .returning()
            .get()
          tx.insert(disposition)
            .values({
              npcId: created.id,
              characterId: owner.characterId,
              stance: n.attitude,
              note: n.knowledge,
              changedSessionId: sessionId,
              changedSeq: stamp.changedSeq
            })
            .run()
          present.push(created.id)
        }

        writeScene(tx, sessionId, {
          name: dest.name,
          description: dest.description,
          exits: exitsOf(tx, dest.id),
          objects: draft?.objects ?? [],
          npcs: present
        })
        return { name: dest.name }
      })
    }
  }
}
