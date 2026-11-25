import { and, eq } from 'drizzle-orm'
import type { Queryable } from '../db/connect'
import { character, combatant as combatantTable, npcCombat } from '../db/schema'
import type { Dice } from '../dice'
import { createPendingCall } from './calls'
import { liveCombat } from './combat'

/*
 * Concentration (SRD "Spellcasting"): a stored link from a caster to one spell. Starting a second
 * concentration spell ends the first; damage calls for a Constitution save to keep it, DC 10 or
 * half the damage, whichever is higher. A Character's save is a Call for the Player; an NPC's or
 * Creature's is rolled at once. Falling Unconscious or dying ends it.
 */

/** Who can concentrate: a Character by id, or an NPC or Creature by handle. */
export type Concentrator =
  | { kind: 'character'; id: string; name: string; player: string; concentration: string | null }
  | { kind: 'npc' | 'creature'; handle: string; name: string; concentration: string | null }

/** The lowest DC a concentration save has. */
const MIN_DC = 10

/** The DC to keep concentration after taking this much damage. */
export const concentrationDc = (damage: number) => Math.max(MIN_DC, Math.floor(damage / 2))

/** Writes the caster's concentration link: a spell slug, or null to end it. */
export function setConcentration(db: Queryable, who: Concentrator, spell: string | null) {
  if (who.kind === 'character') {
    db.update(character).set({ concentration: spell }).where(eq(character.id, who.id)).run()
  } else if (who.kind === 'npc') {
    db.update(npcCombat).set({ concentration: spell }).where(eq(npcCombat.handle, who.handle)).run()
  } else {
    const live = liveCombat(db)
    if (!live) return
    db.update(combatantTable)
      .set({ concentration: spell })
      .where(and(eq(combatantTable.combatId, live.id), eq(combatantTable.handle, who.handle)))
      .run()
  }
}

/** Starts concentrating on a spell; returns the spell it ended, if any. */
export function concentrate(db: Queryable, who: Concentrator, spell: string): string | null {
  setConcentration(db, who, spell)
  return who.concentration && who.concentration !== spell ? who.concentration : null
}

/** What damage did to a caster's concentration: the DM's notes and any pending save Call. */
export type ConcentrationCheck = { notes: string[]; calls: string[] }

/**
 * Damage to a concentrating caster: a Character gets a pending Constitution save Call; an NPC or
 * Creature rolls it now (`bonus` is its Con save) and loses the spell on a failure.
 */
export function concentrationCheck(
  db: Queryable,
  who: Concentrator,
  damage: number,
  { dice, at, bonus }: { dice: Dice; at: number; bonus: number }
): ConcentrationCheck {
  const spell = who.concentration
  if (!spell || damage <= 0) return { notes: [], calls: [] }
  const dc = concentrationDc(damage)
  if (who.kind === 'character') {
    const id = createPendingCall(
      db,
      [
        {
          characterId: who.id,
          player: who.player,
          sequence: null,
          save: 'con',
          dc,
          reason: `To keep concentration on ${spell}`
        }
      ],
      at,
      'concentration'
    )
    return {
      notes: [
        `${who.name} must make a Constitution save (DC ${dc}) to keep concentration on ${spell}: attach pending Call ${id} with narrate`
      ],
      calls: [id]
    }
  }
  const d20 = dice.rollD20()
  const total = d20.kept + bonus
  const kept = total >= dc
  if (!kept) setConcentration(db, who, null)
  const sign = bonus >= 0 ? `+ ${bonus}` : `- ${-bonus}`
  return {
    notes: [
      `${who.name} Constitution save to keep concentration: d20 ${d20.kept} ${sign} = ${total} vs DC ${dc} → ${kept ? 'success' : `failure; concentration on ${spell} ends`}`
    ],
    calls: []
  }
}
