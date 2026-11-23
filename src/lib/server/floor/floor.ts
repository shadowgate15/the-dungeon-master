import { and, asc, eq, max } from 'drizzle-orm'
import { canAct } from '#lib/character/acting.ts'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { Database } from '../db/connect'
import { campaign, character, declaration, floor } from '../db/schema'

/** The Character can't put a Declaration on the Floor (unknown, dead or departed, not theirs). */
export class DeclarationRefusedError extends Error {}

/** The open Floor holds no Declaration with this id. */
export class DeclarationNotFoundError extends Error {}

/** A Declaration on the open Floor, as the Player sees it in the pending tray. */
export type PendingDeclaration = {
  id: string
  character: string
  characterName: string
  player: string
  text: string
}

/** The open Floor: the Declarations on it in send order. */
export type OpenFloor = { declarations: PendingDeclaration[] }

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

  function cleanText(text: unknown): string {
    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (!trimmed) throw new DeclarationRefusedError('Say what the Character does')
    if (trimmed.length > DECLARATION_MAX) {
      throw new DeclarationRefusedError(`Keep a Declaration under ${DECLARATION_MAX} characters`)
    }
    return trimmed
  }

  function pending(id: string) {
    const floorId = openFloorId()
    const found =
      floorId &&
      db
        .select({ id: declaration.id })
        .from(declaration)
        .where(and(eq(declaration.id, id), eq(declaration.floorId, floorId)))
        .get()
    if (!found) throw new DeclarationNotFoundError('Declaration not found on the open Floor')
  }

  return {
    /** The open Floor (empty until something is sent). */
    current(): OpenFloor {
      const floorId = openFloorId()
      if (!floorId) return { declarations: [] }
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
      return { declarations }
    },

    /**
     * Puts a Declaration for one Character on the open Floor, opening it if none is. Refused for a
     * Character who can't act or whom `player` doesn't control.
     */
    send({
      character: characterId,
      text,
      player = SOLO_PLAYER
    }: {
      character: string
      text: string
      player?: string
    }): PendingDeclaration {
      const clean = cleanText(text)
      return db.transaction(() => {
        const actor = db.select().from(character).where(eq(character.id, characterId)).get()
        if (!actor) throw new DeclarationRefusedError('Character not found')
        if (!canAct(actor)) throw new DeclarationRefusedError(`${actor.name} can't act`)
        if (actor.controllingPlayer !== player) {
          throw new DeclarationRefusedError(`${actor.name} is not your Character`)
        }
        const at = now()
        const floorId =
          openFloorId() ??
          db
            .insert(floor)
            .values({
              campaignId: db.select({ id: campaign.id }).from(campaign).get()!.id,
              createdAt: at
            })
            .returning({ id: floor.id })
            .get().id
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

    /** Rewrites a Declaration still on the open Floor. */
    edit(id: string, text: string): void {
      const clean = cleanText(text)
      pending(id)
      db.update(declaration)
        .set({ text: clean, updatedAt: now() })
        .where(eq(declaration.id, id))
        .run()
    },

    /** Takes a Declaration back off the open Floor. */
    withdraw(id: string): void {
      pending(id)
      db.delete(declaration).where(eq(declaration.id, id)).run()
    }
  }
}

export type Floor = ReturnType<typeof createFloor>
