import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { belief } from '../db/schema'

/** What the Player sees for an NPC no Character knows. */
export const UNKNOWN_NPC = 'a stranger'
/** What the Player sees for a Place no Character knows. */
export const UNKNOWN_PLACE = 'an unfamiliar place'

/**
 * The name the Characters know an Entity by: the name on the latest current Belief a Character
 * holds about it, or null when none of them knows it. Every name the Player sees for an NPC or a
 * Place comes from here, never from the World layer (ADR 0007).
 */
export function believedName(db: Queryable, handle: string): string | null {
  return (
    db
      .select({ name: belief.aboutName })
      .from(belief)
      .where(
        and(
          eq(belief.about, handle),
          isNotNull(belief.holderCharacter),
          isNotNull(belief.aboutName),
          isNull(belief.replacedBy),
          isNull(belief.retiredAt)
        )
      )
      .orderBy(desc(belief.id))
      .get()?.name ?? null
  )
}
