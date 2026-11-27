import { sql } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { character } from '../db/schema'
import { slug } from '../world/names'

type CharacterRow = typeof character.$inferSelect

/** A Party member, addressed by a readable `char:` handle. */
export type CharacterRef = { handle: string; row: CharacterRow }

/** A Character as a Holder: its readable handle (`char:wren`) beside its id and name. */
export type CharacterHolder = { id: string; handle: string; name: string; player: string | null }

/**
 * Every Character with its handle, in the order they joined the Party: the one place handles are
 * worked out. A handle is `char:` and the name's slug, numbered (`char:wren-2`) when two
 * Characters share a name. Characters are not Entities, but Facts, Beliefs and tools link to them
 * by handle.
 */
export function characterRefs(db: Queryable): CharacterRef[] {
  const rows = db
    .select()
    .from(character)
    .orderBy(sql`rowid`)
    .all()
  const taken = new Set<string>()
  return rows.map((row) => {
    const base = `char:${slug(row.name) || 'character'}`
    let handle = base
    for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`
    taken.add(handle)
    return { handle, row }
  })
}

/** A Character's handle by its id. */
export function characterHandleOf(db: Queryable, id: string): string | undefined {
  return characterRefs(db).find((c) => c.row.id === id)?.handle
}

/** A Character reference as a Holder. */
export const asHolder = ({ handle, row }: CharacterRef): CharacterHolder => ({
  id: row.id,
  handle,
  name: row.name,
  player: row.controllingPlayer
})

/** Every Character in the Campaign as a Holder. */
export function characterHolders(db: Queryable): CharacterHolder[] {
  return characterRefs(db).map(asHolder)
}
