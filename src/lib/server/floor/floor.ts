import { and, asc, eq, max, sql } from 'drizzle-orm'
import { canAct } from '#lib/character/acting.ts'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { OpenFloor, PendingDeclaration, TableBrowser } from '#lib/play/floor.ts'
import type { Database, Queryable } from '../db/connect'
import { campaign, character, declaration, floor, returnedDraft } from '../db/schema'
import { withdrawOpenCall } from '../play/calls'
import { awaitingNarrationSince, logEvent, setAwaitingNarration } from '../play/log'
import { currentTurn } from '../play/combat'
import { characterRefs, inScene, scenePlace } from '../play/scene'

/** The Character can't put a Declaration on the Floor (unknown, dead or departed, not theirs). */
export class DeclarationRefusedError extends Error {}

/** The open Floor holds no Declaration with this id. */
export class DeclarationNotFoundError extends Error {}

/** Done while the DM is still answering the last closed Floor. */
export class DmBusyError extends Error {}

/** What Done did: closed the Floor (with what was on it), or recorded the Player as waiting. */
export type DoneOutcome =
  | { closed: false }
  | {
      closed: true
      floor: string
      players: string[]
      declarations: PendingDeclaration[]
      /** The open Call the Declarations withdrew, if any. */
      withdrawnCall: string | null
    }

/**
 * The spotlight cut to `place`: every Declaration on the open Floor for a Character no longer in
 * the Scene goes back to its Player's composer as unsent text, and the Floor reopens (nobody has
 * pressed Done on the new Scene). Runs inside the cut's transaction; returns how many went back.
 */
export function returnStrandedDrafts(db: Queryable, place: string, at: number): number {
  const open = db.select().from(floor).where(eq(floor.state, 'open')).get()
  if (!open) return 0
  const stranded = db
    .select({
      id: declaration.id,
      characterId: declaration.characterId,
      player: declaration.player,
      text: declaration.text,
      whereabouts: character.whereabouts
    })
    .from(declaration)
    .innerJoin(character, eq(character.id, declaration.characterId))
    .where(eq(declaration.floorId, open.id))
    .orderBy(asc(declaration.position))
    .all()
    .filter((d) => d.whereabouts !== place)
  for (const d of stranded) {
    db.insert(returnedDraft)
      .values({ characterId: d.characterId, player: d.player, text: d.text, createdAt: at })
      .run()
    db.delete(declaration).where(eq(declaration.id, d.id)).run()
  }
  db.update(floor).set({ done: [] }).where(eq(floor.id, open.id)).run()
  return stranded.length
}

/** Declarations are a sentence or a short paragraph, not an essay. */
export const DECLARATION_MAX = 2000

/**
 * A Campaign's Floor, over its database. The open Floor is created on the first Declaration; its
 * Declarations stay with the Campaign until the Floor closes, so a reload loses nothing.
 */
export function createFloor(db: Database, now: () => number = Date.now) {
  function openFloorId(): string | undefined {
    return db.select({ id: floor.id }).from(floor).where(eq(floor.state, 'open')).get()?.id
  }

  function openFloor(at: number): string {
    return (
      openFloorId() ??
      db
        .insert(floor)
        .values({
          campaignId: db.select({ id: campaign.id }).from(campaign).get()!.id,
          createdAt: at
        })
        .returning({ id: floor.id })
        .get().id
    )
  }

  /** The Players at the table: everyone with a Character in the Scene who can act. */
  function playersAtTable(): string[] {
    const place = scenePlace(db)
    const actors = db
      .select()
      .from(character)
      .all()
      .filter((c) => canAct(c) && inScene(place, c))
    // An unclaimed Character sits out.
    return [...new Set(actors.map((c) => c.controllingPlayer).filter((p) => p !== null))]
  }

  function cleanText(text: unknown): string {
    // One body line per Declaration: a line break could forge another `[dN …]` line.
    const trimmed = typeof text === 'string' ? text.replace(/\s*[\r\n]+\s*/g, ' ').trim() : ''
    if (!trimmed) throw new DeclarationRefusedError('Say what the Character does')
    if (trimmed.length > DECLARATION_MAX) {
      throw new DeclarationRefusedError(`Keep a Declaration under ${DECLARATION_MAX} characters`)
    }
    return trimmed
  }

  /** `id` is on the open Floor and `player` sent it; another browser's can only be read. */
  function pending(id: string, player: string) {
    const floorId = openFloorId()
    const found =
      floorId &&
      db
        .select({ player: declaration.player })
        .from(declaration)
        .where(and(eq(declaration.id, id), eq(declaration.floorId, floorId)))
        .get()
    if (!found) throw new DeclarationNotFoundError('Declaration not found on the open Floor')
    if (found.player !== player) {
      throw new DeclarationRefusedError("That is another Player's Declaration")
    }
  }

  /** `player`'s drafts a cut sent back to the composer, oldest first. */
  function returned(player: string) {
    return db
      .select({
        id: returnedDraft.id,
        character: returnedDraft.characterId,
        characterName: character.name,
        text: returnedDraft.text
      })
      .from(returnedDraft)
      .innerJoin(character, eq(character.id, returnedDraft.characterId))
      .where(eq(returnedDraft.player, player))
      .orderBy(asc(returnedDraft.createdAt), asc(sql`${returnedDraft}.rowid`))
      .all()
  }

  /** Who is at the table for `viewer`: each browser's in-Scene Characters, and the unclaimed. */
  function table(viewer: string, done: string[]) {
    const place = scenePlace(db)
    const inPlay = db
      .select()
      .from(character)
      .all()
      .filter((c) => canAct(c) && inScene(place, c))
    const byBrowser = new Map<string, TableBrowser>()
    for (const c of inPlay) {
      const owner = c.controllingPlayer
      if (owner === null) continue
      const seat = byBrowser.get(owner) ?? {
        own: owner === viewer,
        characters: [],
        done: done.includes(owner)
      }
      seat.characters.push({ id: c.id, name: c.name })
      byBrowser.set(owner, seat)
    }
    return {
      browsers: [...byBrowser.values()],
      unclaimed: inPlay
        .filter((c) => c.controllingPlayer === null)
        .map((c) => ({ id: c.id, name: c.name }))
    }
  }

  /** The open Floor (empty until something is sent), with `player`'s returned drafts. */
  function current(player: string): OpenFloor {
    const floorId = openFloorId()
    const done = floorId ? db.select().from(floor).where(eq(floor.id, floorId)).get()!.done : []
    const seats = table(player, done)
    if (!floorId) return { declarations: [], ...seats, returned: returned(player) }
    const declarations = db
      .select({
        id: declaration.id,
        character: declaration.characterId,
        characterName: character.name,
        player: declaration.player,
        text: declaration.text
      })
      .from(declaration)
      .innerJoin(character, eq(character.id, declaration.characterId))
      .where(eq(declaration.floorId, floorId))
      .orderBy(asc(declaration.position))
      .all()
      .map((d) => ({ ...d, own: d.player === player }))
    return { declarations, ...seats, returned: returned(player) }
  }

  /** Closes the open Floor when every browser at the table is Done; an empty table waits. */
  function closeIfReady(floorId: string, at: number): DoneOutcome {
    const done = db.select().from(floor).where(eq(floor.id, floorId)).get()!.done
    const table = playersAtTable()
    if (table.length === 0 || !table.every((p) => done.includes(p))) return { closed: false }
    const declarations = db
      .select({
        id: declaration.id,
        character: declaration.characterId,
        characterName: character.name,
        player: declaration.player,
        text: declaration.text
      })
      .from(declaration)
      .innerJoin(character, eq(character.id, declaration.characterId))
      .where(eq(declaration.floorId, floorId))
      .orderBy(asc(declaration.position))
      .all()
    db.update(floor).set({ state: 'closed', closedAt: at }).where(eq(floor.id, floorId)).run()
    for (const d of declarations) {
      logEvent(
        db,
        {
          tool: 'done',
          kind: 'declaration',
          summary: `${d.characterName}: ${d.text}`,
          data: {
            floor: floorId,
            declaration: d.id,
            character: d.character,
            characterName: d.characterName,
            player: d.player,
            text: d.text
          }
        },
        { at }
      )
    }
    // Declarations answer the moment instead of the Call: the Players chose not to roll.
    const withdrawnCall = declarations.length > 0 ? withdrawOpenCall(db, at) : null
    setAwaitingNarration(db, at)
    return { closed: true, floor: floorId, players: done, declarations, withdrawnCall }
  }

  return {
    /** The open Floor (empty until something is sent), with `player`'s returned drafts. */
    current,

    /** The composer has loaded a returned draft: it is no longer held for the Player. */
    clearReturned(id: string): void {
      db.delete(returnedDraft).where(eq(returnedDraft.id, id)).run()
    },

    /**
     * Puts a Declaration for one Character on the open Floor, opening it if none is. Refused for a
     * Character who can't act or whom `player` doesn't control.
     */
    send({
      character: characterId,
      text,
      player
    }: {
      character: string
      text: string
      player: string
    }): PendingDeclaration {
      const clean = cleanText(text)
      return db.transaction(() => {
        const actor = db.select().from(character).where(eq(character.id, characterId)).get()
        if (!actor) throw new DeclarationRefusedError('Character not found')
        if (!canAct(actor)) throw new DeclarationRefusedError(`${actor.name} can't act`)
        if (!inScene(scenePlace(db), actor)) {
          throw new DeclarationRefusedError(`${actor.name} is not in the Scene`)
        }
        if (actor.controllingPlayer !== player) {
          throw new DeclarationRefusedError(`${actor.name} is not your Character`)
        }
        // In Combat, the Floor is locked to whoever's turn it is.
        const turn = currentTurn(db)
        const handle = characterRefs(db).find((c) => c.row.id === actor.id)?.handle
        if (turn && turn.handle !== handle) {
          throw new DeclarationRefusedError(`It is ${turn.name}'s turn`)
        }
        const at = now()
        const floorId = openFloor(at)
        const last = db
          .select({ n: max(declaration.position) })
          .from(declaration)
          .where(eq(declaration.floorId, floorId))
          .get()?.n
        const created = db
          .insert(declaration)
          .values({
            floorId,
            characterId,
            player,
            text: clean,
            position: (last ?? 0) + 1,
            createdAt: at,
            updatedAt: at
          })
          .returning()
          .get()
        return {
          id: created.id,
          character: characterId,
          characterName: actor.name,
          player,
          text: clean
        }
      })
    },

    /**
     * The Player presses Done. Once every browser with a Claimed Character in the Scene has, the
     * Floor closes in one transaction: its Declarations are logged (stamped with the Session) in
     * send order, they withdraw any open Call, and the Campaign awaits Narration. With no Claimed
     * Character in the Scene the Floor waits. Refused while the DM is still answering the last Floor.
     */
    done(player: string): DoneOutcome {
      return db.transaction((): DoneOutcome => {
        if (awaitingNarrationSince(db) !== null) {
          throw new DmBusyError('The DM is still answering the last turn')
        }
        const at = now()
        const floorId = openFloor(at)
        const row = db.select().from(floor).where(eq(floor.id, floorId)).get()!
        const done = row.done.includes(player) ? row.done : [...row.done, player]
        db.update(floor).set({ done }).where(eq(floor.id, floorId)).run()
        return closeIfReady(floorId, at)
      })
    },

    /** Not done yet: takes `player`'s Done back, until the Floor closes. */
    undone(player: string): void {
      const floorId = openFloorId()
      if (!floorId) return
      const row = db.select().from(floor).where(eq(floor.id, floorId)).get()!
      db.update(floor)
        .set({ done: row.done.filter((p) => p !== player) })
        .where(eq(floor.id, floorId))
        .run()
    },

    /**
     * A browser lost a Character (Let go, Release): its open Declarations are withdrawn and the
     * close is re-checked, so the Floor closes if every remaining browser in the Scene is Done.
     * A pending Call part stays with the Character.
     */
    lose(characterId: string): DoneOutcome {
      return db.transaction((): DoneOutcome => {
        const floorId = openFloorId()
        if (!floorId) return { closed: false }
        db.delete(declaration)
          .where(and(eq(declaration.floorId, floorId), eq(declaration.characterId, characterId)))
          .run()
        // The DM is mid-turn: the re-check waits for the next Done.
        if (awaitingNarrationSince(db) !== null) return { closed: false }
        return closeIfReady(floorId, now())
      })
    },

    /** Rewrites a Declaration `player` sent that is still on the open Floor. */
    edit(id: string, text: string, player: string): void {
      const clean = cleanText(text)
      pending(id, player)
      db.update(declaration)
        .set({ text: clean, updatedAt: now() })
        .where(eq(declaration.id, id))
        .run()
    },

    /** Takes a Declaration `player` sent back off the open Floor. */
    withdraw(id: string, player: string): void {
      pending(id, player)
      db.delete(declaration).where(eq(declaration.id, id)).run()
    }
  }
}

export type Floor = ReturnType<typeof createFloor>
