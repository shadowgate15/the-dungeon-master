import { and, asc, isNotNull, isNull } from 'drizzle-orm'
import type { Journal, JournalEntry } from '#lib/play/journal.ts'
import type { EntityType } from '#lib/world/entity-types.ts'
import type { Queryable } from '../db/connect'
import { belief, entity } from '../db/schema'
import { characterHolders } from './holders'

/** Shows `[[Name]]` links as plain names for the Player. */
const plain = (text: string) => text.replace(/\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]/g, '$1')

/**
 * The Player's Journal: their Characters' current Beliefs as each was learned, one entry per
 * thing believed with every Character who holds it. Built from the Knowledge layer only, never
 * from the World layer or an NPC's Beliefs, and with the truth stripped (ADR 0007).
 */
export function journal(db: Queryable, player?: string): Journal {
  const characters = characterHolders(db).filter((c) => player === undefined || c.player === player)
  const types = new Map(
    db
      .select({ handle: entity.handle, type: entity.type })
      .from(entity)
      .all()
      .map((e) => [e.handle, e.type as EntityType])
  )
  const rows = db
    .select()
    .from(belief)
    .where(
      and(isNotNull(belief.holderCharacter), isNull(belief.replacedBy), isNull(belief.retiredAt))
    )
    .orderBy(asc(belief.id))
    .all()

  const entries = new Map<string, JournalEntry>()
  for (const b of rows) {
    const holder = characters.find((c) => c.id === b.holderCharacter)
    const type = b.about === null ? undefined : types.get(b.about)
    if (!holder || !type) continue
    const text = plain(b.text)
    const source = b.source === null ? null : plain(b.source)
    const key = JSON.stringify([b.aboutName, type, text, source])
    const entry = entries.get(key) ?? {
      id: `b${b.id}`,
      about: { name: b.aboutName ?? '', type },
      text,
      source,
      holders: []
    }
    if (!entry.holders.some((h) => h.id === holder.id)) {
      entry.holders.push({ id: holder.id, name: holder.name })
    }
    entries.set(key, entry)
  }
  return { entries: [...entries.values()] }
}
