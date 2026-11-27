import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { asc, isNotNull, ne, and } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { character } from '../db/schema'

/** What the DM hears for a Player nobody can name: a browser with no Claims. */
export const UNNAMED_PLAYER = 'a Player'

/** What the DM hears for the localhost browser. */
export const HOST = 'Host'

/** A browser id as the DM hears it. The DM never sees the id itself. */
export type PlayerLabel = (browser: string) => string

/**
 * Names each Player by the Characters their browser Claims right now (`Player of Wren & Ash`),
 * marking the Host's localhost browser (`Host · Player of Wren`, or just `Host` with no Claims).
 * A browser with no Claims that isn't the Host is `a Player`. Read when the event is sent.
 */
export function playerLabels(db: Queryable): PlayerLabel {
  const held = db
    .select({ name: character.name, browser: character.controllingPlayer })
    .from(character)
    .where(and(isNotNull(character.controllingPlayer), ne(character.status, 'departed')))
    .orderBy(asc(character.createdAt), asc(character.name))
    .all()
  return (browser) => {
    const names = held.filter((c) => c.browser === browser).map((c) => c.name)
    const named = names.length ? `Player of ${names.join(' & ')}` : null
    if (browser === SOLO_PLAYER) return named ? `${HOST} · ${named}` : HOST
    return named ?? UNNAMED_PLAYER
  }
}
