import { clockParts, formatClock } from '#lib/play/clock.ts'
import type { SceneView } from '#lib/play/scene.ts'
import { and, eq, isNull } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { hpState } from '#lib/play/hp-state.ts'
import { campaign, entity, npcCombat } from '../db/schema'
import { playerCombat } from './combat'
import { believedName, UNKNOWN_PLACE } from '../knowledge/player-names'
import { characterRefs } from '../knowledge/holders'

/** A move of the clock that would take it backwards. */
export class ClockBackwardsError extends Error {}

/** The Campaign clock: in-fiction minutes since the Campaign started. */
export function currentMinute(db: Queryable): number {
  return db.select({ minute: campaign.clockMinute }).from(campaign).get()?.minute ?? 0
}

/**
 * Moves the Campaign clock to `to`, inside the caller's transaction. The one way the clock moves:
 * `advance_time`, rests and the end of a Combat all go through here. Refuses to go backwards.
 */
export function advanceClock(db: Queryable, to: number): { from: number; to: number } {
  const from = currentMinute(db)
  if (!Number.isInteger(to) || to < from) {
    throw new ClockBackwardsError(
      `The clock is at ${formatClock(from)}; it cannot go back to ${formatClock(Math.max(0, Math.floor(to)))}`
    )
  }
  db.update(campaign).set({ clockMinute: to }).run()
  return { from, to }
}

type EntityRow = typeof entity.$inferSelect

export { characterRefs, type CharacterRef } from '../knowledge/holders'

/** The Place the spotlight is on, or null before the DM first sets the Scene. */
export function scenePlace(db: Queryable): EntityRow | null {
  const handle = db.select({ scene: campaign.scene }).from(campaign).get()?.scene ?? null
  if (handle === null) return null
  return db.select().from(entity).where(eq(entity.handle, handle)).get() ?? null
}

/** Whether a Character is in the Scene. Before the Scene is first set, the whole Party is. */
export function inScene(place: EntityRow | null, row: { whereabouts: string | null }): boolean {
  return place === null || row.whereabouts === place.handle
}

/** Live NPCs whose whereabouts is `place`. */
function npcsAt(db: Queryable, place: string): EntityRow[] {
  return db
    .select()
    .from(entity)
    .where(and(eq(entity.type, 'npc'), isNull(entity.retiredAt)))
    .orderBy(entity.name)
    .all()
    .filter((e) => e.fields.whereabouts === place && e.fields.status !== 'dead')
}

/**
 * Who is in the Scene, worked out from whereabouts (never stored): the Characters there who are
 * still in play and the live NPCs at the Place. The rest of the Party is elsewhere.
 */
export function present(db: Queryable) {
  const place = scenePlace(db)
  const party = characterRefs(db).filter((c) => c.row.status === 'alive')
  return {
    place,
    characters: party.filter((c) => inScene(place, c.row)),
    elsewhere: party.filter((c) => !inScene(place, c.row)),
    npcs: place ? npcsAt(db, place.handle) : []
  }
}

/** A spotlight request the server won't send: unknown Character, or one already in the Scene. */
export class SpotlightRefusedError extends Error {}

/** The Scene as the Player's rail shows it, built from Player-safe fields only. */
export function playerScene(db: Queryable): SceneView {
  const { place, characters, elsewhere } = present(db)
  const minute = currentMinute(db)
  // Place names as the Characters know them, never the World's (ADR 0007).
  const placeName = (handle: string | null) =>
    handle === null ? null : (believedName(db, handle) ?? UNKNOWN_PLACE)
  return {
    clock: { minute, ...clockParts(minute) },
    place: place && { name: placeName(place.handle)! },
    present: characters.map((c) => ({ id: c.row.id, name: c.row.name })),
    elsewhere: elsewhere.map((c) => ({
      id: c.row.id,
      name: c.row.name,
      whereabouts: placeName(c.row.whereabouts)
    })),
    combat: playerCombat(
      db,
      new Map(characterRefs(db).map((c) => [c.handle, c.row.id])),
      (handle) => {
        const npc = db.select().from(npcCombat).where(eq(npcCombat.handle, handle)).get()
        return npc ? hpState(npc.hp, npc.maxHp) : 'unhurt'
      }
    )
  }
}

/**
 * A Player's "Cut to <Name>" for a Character elsewhere, as the DM hears it: one `spotlight`
 * channel event carrying the Character and the Player. It doesn't await Narration; the DM cuts
 * with `set_scene` at a natural break.
 */
export function spotlightRequest(
  db: Queryable,
  characterId: string,
  player: string
): { content: string; meta: Record<string, string> } {
  const { elsewhere, characters } = present(db)
  const target = elsewhere.find((c) => c.row.id === characterId)
  if (!target) {
    const here = characters.find((c) => c.row.id === characterId)
    throw new SpotlightRefusedError(
      here ? `${here.row.name} is already in the Scene` : 'Character not found'
    )
  }
  return {
    content: `Cut to ${target.row.name} (${target.handle}), at ${target.row.whereabouts ?? 'no known Place'}`,
    meta: { kind: 'spotlight', character: target.handle, player }
  }
}
