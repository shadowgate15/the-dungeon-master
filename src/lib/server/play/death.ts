import { eq } from 'drizzle-orm'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import type { Queryable } from '../db/connect'
import { character, type DeathSaves } from '../db/schema'
import { createPendingCall } from './calls'
import { characterRefs } from './scene'

/*
 * Dropping to 0 HP and Death saves (SRD "Damage and Healing"). Code applies every tally: a
 * Character at 0 HP is Unconscious and rolls a Death save on each of their Combat turns; three
 * successes make them stable, three failures kill them. Damage at 0 HP is a failure (two on a
 * critical hit), and damage that leaves as much over as the HP maximum kills outright.
 */

type CharacterRow = typeof character.$inferSelect

const FRESH: DeathSaves = { successes: 0, failures: 0 }

/** Successes or failures that end the Death saves. */
const THREE = 3

/** The roll a Death save needs to succeed (SRD: 10 or higher). */
const DEATH_SAVE_DC = 10

const without = (list: string[], item: string) => list.filter((c) => c !== item)
const withCondition = (list: string[], item: string) =>
  list.includes(item) ? list : [...list, item]

function write(db: Queryable, id: string, set: Partial<typeof character.$inferInsert>) {
  db.update(character).set(set).where(eq(character.id, id)).run()
}

/** The Character dies: no Death saves, no concentration. */
function die(db: Queryable, row: CharacterRow) {
  write(db, row.id, { status: 'dead', deathSaves: FRESH, concentration: null })
}

/**
 * What damage that got past temporary HP does to a Character's life: falling Unconscious at 0,
 * Death save failures at 0, or death. `before` is the HP before the damage, `taken` what got
 * through. Returns the DM's notes; the HP itself is already written.
 */
export function damagedCharacter(
  db: Queryable,
  row: CharacterRow,
  {
    before,
    taken,
    maxHp,
    crit = false
  }: { before: number; taken: number; maxHp: number; crit?: boolean }
): string[] {
  if (row.status !== 'alive' || taken <= 0) return []
  if (before > 0) {
    if (taken < before) return []
    if (taken - before >= maxHp) {
      die(db, row)
      return [`${row.name} dies outright (instant death)`]
    }
    write(db, row.id, {
      conditions: withCondition(row.conditions, 'unconscious'),
      deathSaves: FRESH,
      concentration: null
    })
    return [
      `${row.name} drops to 0 HP and falls unconscious${row.concentration ? `; concentration on ${row.concentration} ends` : ''}`
    ]
  }
  if (taken >= maxHp) {
    die(db, row)
    return [`${row.name} dies outright (instant death)`]
  }
  const failures = row.deathSaves.failures + (crit ? 2 : 1)
  if (failures >= THREE) {
    die(db, row)
    return [`${row.name} takes damage at 0 HP: a third Death save failure, and dies`]
  }
  write(db, row.id, { deathSaves: { successes: row.deathSaves.successes, failures } })
  return [
    `${row.name} takes damage at 0 HP: ${crit ? 'two Death save failures' : 'a Death save failure'} (${failures} of ${THREE})`
  ]
}

/** Healing at 0 HP wakes a Character and clears the tallies. */
export function healedCharacter(db: Queryable, row: CharacterRow, hp: number) {
  if (row.currentHp > 0 || hp === 0) return
  write(db, row.id, { conditions: without(row.conditions, 'unconscious'), deathSaves: FRESH })
}

/** Whether a Character at 0 HP still rolls Death saves: alive, not stable. */
export const rollsDeathSaves = (row: CharacterRow) =>
  row.status === 'alive' && row.currentHp === 0 && !row.deathSaves.stable

/** What one Death save came to. */
export type DeathSaveOutcome = {
  success: boolean
  /** The DM's line: `failure (1 success, 2 failures)`, `stable`, `dies`, `regains 1 HP`. */
  text: string
  /** The Player's outcome word. */
  outcome: 'success' | 'failure' | 'stable' | 'dead' | 'regains 1 HP'
}

const tally = (s: DeathSaves) =>
  `${s.successes} success${s.successes === 1 ? '' : 'es'}, ${s.failures} failure${s.failures === 1 ? '' : 's'}`

/**
 * Applies one Death save roll (the kept d20, no modifier). A natural 20 regains 1 HP; a natural 1
 * is two failures; 10 or higher succeeds. Three successes stabilize, three failures kill.
 */
export function applyDeathSave(db: Queryable, row: CharacterRow, d20: number): DeathSaveOutcome {
  if (d20 === 20) {
    write(db, row.id, {
      currentHp: 1,
      conditions: without(row.conditions, 'unconscious'),
      deathSaves: FRESH
    })
    return { success: true, outcome: 'regains 1 HP', text: 'natural 20: regains 1 HP and wakes' }
  }
  const success = d20 >= DEATH_SAVE_DC
  const next: DeathSaves = {
    successes: row.deathSaves.successes + (success ? 1 : 0),
    failures: row.deathSaves.failures + (success ? 0 : d20 === 1 ? 2 : 1)
  }
  if (next.failures >= THREE) {
    die(db, row)
    return { success, outcome: 'dead', text: `failure: a third failure, ${row.name} dies` }
  }
  if (next.successes >= THREE) {
    write(db, row.id, { deathSaves: { ...FRESH, stable: true } })
    return { success, outcome: 'stable', text: `success: a third success, ${row.name} is stable` }
  }
  write(db, row.id, { deathSaves: next })
  const word = success ? 'success' : d20 === 1 ? 'natural 1: two failures' : 'failure'
  return { success, outcome: success ? 'success' : 'failure', text: `${word} (${tally(next)})` }
}

/**
 * On a Combat turn, a Character at 0 HP who still rolls Death saves gets a pending Death save
 * Call. Returns its id, or null for anyone else.
 */
export function deathSaveCall(db: Queryable, handle: string, at: number): string | null {
  const ref = characterRefs(db).find((c) => c.handle === handle)
  if (!ref || !rollsDeathSaves(ref.row)) return null
  return createPendingCall(
    db,
    [{ characterId: ref.row.id, player: ref.row.controllingPlayer ?? SOLO_PLAYER, sequence: null }],
    at,
    'death_save'
  )
}
