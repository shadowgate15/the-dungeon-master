import { asc } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { character } from '../db/schema'
import { slug } from '../world/names'

/** A Character as a Holder: its readable handle (`char:wren`) beside its id and name. */
export type CharacterHolder = { id: string; handle: string; name: string; player: string }

/**
 * Every Character in the Campaign with its readable handle, `char:` plus its name's slug. Two
 * Characters with the same slug are told apart by creation order (`char:wren-2`).
 */
export function characterHolders(db: Queryable): CharacterHolder[] {
  const taken = new Set<string>()
  return db
    .select({ id: character.id, name: character.name, player: character.controllingPlayer })
    .from(character)
    .orderBy(asc(character.createdAt), asc(character.id))
    .all()
    .map((c) => {
      const base = `char:${slug(c.name) || 'character'}`
      let handle = base
      for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`
      taken.add(handle)
      return { ...c, handle }
    })
}

/**
 * The Characters present in the Scene. There is no Scene yet (#328 adds it and presence from
 * whereabouts), so until then every Character in the Party is present.
 */
export function charactersInScene(db: Queryable): CharacterHolder[] {
  return characterHolders(db)
}
