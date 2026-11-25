import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { hpState, type HpState } from '#lib/play/hp-state.ts'
import type { CombatView } from '#lib/play/scene.ts'
import type { Queryable } from '../db/connect'
import { call, combat, combatant as combatantTable, type TurnResources } from '../db/schema'
import type { Dice } from '../dice'
import { ToolError } from '../tools/contract'
import { believedName, UNKNOWN_NPC } from '../knowledge/player-names'
import { createPendingCall, type PendingPart } from './calls'
import { combatant, isOut, type Combatant, type StatBlock, statBlockFor } from './combatants'
import { advanceClock, currentMinute } from './scene'

/*
 * Combat: a stored fight run in initiative order. Code rolls NPC and Creature initiative; the
 * Party rolls theirs in one batched initiative Call. The order, the turn pointer and the round
 * live here. Creatures are faceless foes spawned from a stat block for one Combat; they vanish
 * when it ends.
 */

type CombatRow = typeof combat.$inferSelect
export type CombatantRow = typeof combatantTable.$inferSelect

/** A combatant to add: a Character or NPC by handle, or `count` Creatures from a stat block. */
export type CombatantEntry = string | { monster: string; count?: number }

/** One NPC or Creature initiative roll, for the dice log (Player-safe). */
export type InitiativeRoll = {
  characterName: string
  characterHandle: string | null
  what: 'Initiative'
  dice: number[]
  modifier: number
  total: number
  outcome: null
  mode: 'normal'
  reason: null
  target: null
}

/** Seconds in a Combat round (SRD). */
const ROUND_SECONDS = 6

const FRESH: TurnResources = { action: false, bonusAction: false, reaction: false }

const abilityMod = (score: number) => Math.floor((score - 10) / 2)

/** The live Combat, or null. */
export function liveCombat(db: Queryable): CombatRow | null {
  return db.select().from(combat).where(isNull(combat.endedAt)).get() ?? null
}

/** The live Combat, or `no_combat`. */
export function requireCombat(db: Queryable): CombatRow {
  const live = liveCombat(db)
  if (!live) {
    throw new ToolError('no_combat', 'No Combat is live', 'Start one with start_combat')
  }
  return live
}

/** Refuses while a Combat is live. */
export function refuseDuringCombat(db: Queryable, what: string) {
  if (liveCombat(db)) {
    throw new ToolError(
      'combat_live',
      `A Combat is live: ${what} waits until it ends`,
      'Finish the fight and call end_combat first'
    )
  }
}

/** Every combatant of a Combat, in the order they joined. */
function combatantsOf(db: Queryable, combatId: string): CombatantRow[] {
  return db
    .select()
    .from(combatantTable)
    .where(eq(combatantTable.combatId, combatId))
    .orderBy(asc(combatantTable.joined))
    .all()
}

/**
 * The initiative order: everyone with initiative, highest first; ties go to the higher Dexterity,
 * then to whoever joined first. A Character still to roll isn't in it yet.
 */
export function initiativeOrder(db: Queryable, combatId: string): CombatantRow[] {
  return combatantsOf(db, combatId)
    .filter((c) => c.initiative !== null)
    .sort((a, b) => b.initiative! - a.initiative! || b.dex - a.dex || a.joined - b.joined)
}

/** The combatants still to roll initiative (Characters whose Call isn't rolled yet). */
export function waitingOnInitiative(db: Queryable, combatId: string): CombatantRow[] {
  return combatantsOf(db, combatId).filter((c) => c.initiative === null)
}

/** A Creature in the live Combat by handle, or null. */
export function liveCreature(db: Queryable, handle: string): CombatantRow | null {
  const live = liveCombat(db)
  if (!live) return null
  return (
    db
      .select()
      .from(combatantTable)
      .where(
        and(
          eq(combatantTable.combatId, live.id),
          eq(combatantTable.handle, handle),
          eq(combatantTable.kind, 'creature')
        )
      )
      .get() ?? null
  )
}

const statBlockDex = (m: StatBlock) => (m.abilityScores as Record<string, number>).dex ?? 10

/** What joins: resolved Characters and NPCs, and Creatures spawned (numbered per stat block). */
type Joining = {
  row: Omit<typeof combatantTable.$inferInsert, 'combatId' | 'joined'>
  who?: Combatant
}

function joining(db: Queryable, combatId: string, entries: CombatantEntry[]): Joining[] {
  const existing = combatantsOf(db, combatId)
  const taken = new Set(existing.map((c) => c.handle))
  const out: Joining[] = []
  for (const entry of entries) {
    const spec =
      typeof entry === 'string' && entry.startsWith('monster:') ? { monster: entry } : entry
    if (typeof spec !== 'string') {
      const statBlock = statBlockFor(db, spec.monster)
      for (let i = 0; i < (spec.count ?? 1); i++) {
        let n = 1
        while (taken.has(`creature:${statBlock.slug}-${n}`)) n++
        const handle = `creature:${statBlock.slug}-${n}`
        taken.add(handle)
        out.push({
          row: {
            kind: 'creature',
            handle,
            name: `${statBlock.name} ${n}`,
            dex: statBlockDex(statBlock),
            statBlock: `monster:${statBlock.slug}`,
            // A Creature starts at its stat block's average HP, like an NPC.
            hp: statBlock.hitPoints,
            maxHp: statBlock.hitPoints
          }
        })
      }
      continue
    }
    const who = combatant(db, spec)
    if (taken.has(who.handle)) {
      throw ToolError.invalidInput(
        'start_combat',
        `${who.name} (${who.handle}) is already fighting`
      )
    }
    taken.add(who.handle)
    const dex =
      who.kind === 'character'
        ? who.stats.abilities.dex.status === 'ok'
          ? who.stats.abilities.dex.value.score
          : 10
        : statBlockDex(who.statBlock)
    out.push({ row: { kind: who.kind, handle: who.handle, name: who.name, dex }, who })
  }
  return out
}

/** What joining a Combat did: Creatures spawned, code's rolls, and the Party's pending Call. */
export type Joined = {
  creatures: string[]
  rolls: InitiativeRoll[]
  /** The DM's lines for code's rolls. */
  rolled: string[]
  pendingCall: string | null
}

/**
 * Adds combatants to a Combat. NPCs and Creatures roll initiative now, in code; Characters get
 * one pending initiative Call between them, for the closing narrate to attach.
 */
function join(
  db: Queryable,
  dice: Dice,
  combatId: string,
  entries: CombatantEntry[],
  { surprised = [], at }: { surprised?: string[]; at: number }
): Joined {
  const adding = joining(db, combatId, entries)
  const unknown = surprised.filter((h) => !adding.some((a) => a.row.handle === h))
  if (unknown.length) {
    throw ToolError.invalidInput(
      'start_combat',
      `Surprised must name combatants in this fight: ${unknown.join(', ')}`
    )
  }
  let joined = combatantsOf(db, combatId).length
  const rolls: InitiativeRoll[] = []
  const rolled: string[] = []
  const parts: PendingPart[] = []
  for (const { row, who } of adding) {
    let initiative: number | null = null
    if (row.kind === 'character' && who?.kind === 'character') {
      parts.push({ characterId: who.id, player: who.player, sequence: null, reason: null })
    } else {
      const modifier = abilityMod(row.dex)
      const d20 = dice.rollD20()
      initiative = d20.kept + modifier
      const sign = modifier >= 0 ? `+ ${modifier}` : `- ${-modifier}`
      rolled.push(`${row.name} initiative: d20 ${d20.kept} ${sign} = ${initiative}`)
      rolls.push({
        characterName: row.name,
        characterHandle: row.handle,
        what: 'Initiative',
        dice: d20.dice,
        modifier,
        total: initiative,
        outcome: null,
        mode: 'normal',
        reason: null,
        target: null
      })
    }
    db.insert(combatantTable)
      .values({
        ...row,
        combatId,
        joined: ++joined,
        initiative,
        surprised: surprised.includes(row.handle!)
      })
      .run()
  }
  const pendingCall = parts.length ? createPendingCall(db, parts, at, 'initiative') : null
  beginIfReady(db, combatId)
  return {
    creatures: adding.filter((a) => a.row.kind === 'creature').map((a) => a.row.handle!),
    rolls,
    rolled,
    pendingCall
  }
}

/** Starts a Combat. Refused while one is live. */
export function startCombat(
  db: Queryable,
  dice: Dice,
  entries: CombatantEntry[],
  { surprised, at }: { surprised?: string[]; at: number }
): Joined {
  if (liveCombat(db)) {
    throw new ToolError(
      'combat_live',
      'A Combat is already live',
      'Add late arrivals with add_combatant, or end it with end_combat first'
    )
  }
  const { id } = db
    .insert(combat)
    .values({ startedAt: currentMinute(db) })
    .returning({ id: combat.id })
    .get()
  return join(db, dice, id, entries, { surprised, at })
}

/** Adds a late arrival to the live Combat. */
export function addCombatants(
  db: Queryable,
  dice: Dice,
  entries: CombatantEntry[],
  at: number
): Joined {
  return join(db, dice, requireCombat(db).id, entries, { at })
}

/**
 * Whether a combatant acts this round: a surprised one loses its first turn, and the dead (or a
 * foe at 0 HP that wasn't knocked out) lose every turn.
 */
function acts(db: Queryable, c: CombatantRow, round: number): boolean {
  if (round === 1 && c.surprised) return false
  return !isOut(db, combatant(db, c.handle))
}

/**
 * Moves the turn pointer to the next combatant who acts, wrapping into the next round, and resets
 * their per-turn resources. From no current turn, starts from the top of round `round`.
 */
function advance(db: Queryable, live: CombatRow): { round: number; current: CombatantRow | null } {
  const order = initiativeOrder(db, live.id)
  let round = live.round
  let index = live.current === null ? -1 : order.findIndex((c) => c.id === live.current)
  let next: CombatantRow | null = null
  for (let step = 0; step < order.length * 2 + 1 && order.length; step++) {
    index++
    if (index >= order.length) {
      index = 0
      round++
    }
    if (acts(db, order[index], round)) {
      next = order[index]
      break
    }
  }
  db.update(combat)
    .set({ round, current: next?.id ?? null })
    .where(eq(combat.id, live.id))
    .run()
  if (next) {
    db.update(combatantTable).set({ used: FRESH }).where(eq(combatantTable.id, next.id)).run()
  }
  return { round, current: next }
}

/** Once every combatant has initiative, round 1 begins with the first who acts. */
function beginIfReady(db: Queryable, combatId: string) {
  const live = db.select().from(combat).where(eq(combat.id, combatId)).get()!
  if (live.round !== 0 || live.endedAt !== null) return
  if (combatantsOf(db, combatId).some((c) => c.initiative === null)) return
  advance(db, { ...live, round: 1, current: null })
}

/**
 * Records a Character's initiative roll from the Party's Call. Late arrivals slot into the order;
 * the last roll at the start of a Combat begins round 1.
 */
export function recordInitiative(db: Queryable, characterHandle: string, total: number) {
  const live = liveCombat(db)
  if (!live) return
  db.update(combatantTable)
    .set({ initiative: total })
    .where(and(eq(combatantTable.combatId, live.id), eq(combatantTable.handle, characterHandle)))
    .run()
  beginIfReady(db, live.id)
}

/** Advances to the next turn. Refused until every combatant has initiative. */
export function nextTurn(db: Queryable) {
  const live = requireCombat(db)
  if (live.round === 0) {
    throw new ToolError(
      'initiative_pending',
      'The order is not known yet: some Characters have not rolled initiative',
      'Attach the initiative Call with narrate and wait for its call_result'
    )
  }
  return advance(db, live)
}

const RESOURCE_NAMES: Record<keyof TurnResources, string> = {
  action: 'an action',
  bonusAction: 'a bonus action',
  reaction: 'a reaction'
}

/**
 * Marks a per-turn resource spent by a combatant in the live Combat. Returns a reminder when it was
 * already spent this turn, never a refusal; null outside a Combat or the first time.
 */
export function spendTurnResource(
  db: Queryable,
  handle: string,
  name: string,
  resource: keyof TurnResources
): string | null {
  const live = liveCombat(db)
  if (!live) return null
  const row = db
    .select()
    .from(combatantTable)
    .where(and(eq(combatantTable.combatId, live.id), eq(combatantTable.handle, handle)))
    .get()
  if (!row) return null
  if (row.used[resource]) {
    return `${name} has already used ${RESOURCE_NAMES[resource]} this turn (a reminder: go on if the fiction allows it)`
  }
  db.update(combatantTable)
    .set({ used: { ...row.used, [resource]: true } })
    .where(eq(combatantTable.id, row.id))
    .run()
  return null
}

/** The DM's one-line order: `Order: Wren 20, Goblin 2 17. Round 1: Wren (char:wren) acts.` */
export function orderText(db: Queryable): string {
  const live = liveCombat(db)
  if (!live) return 'No Combat is live.'
  const order = initiativeOrder(db, live.id)
  const waiting = waitingOnInitiative(db, live.id)
  const current = order.find((c) => c.id === live.current)
  return [
    `Order: ${order.map((c) => `${c.name} ${c.initiative}`).join(', ') || 'none yet'}.`,
    waiting.length ? `Waiting on initiative: ${waiting.map((c) => c.name).join(', ')}.` : null,
    current ? `Round ${live.round}: ${current.name} (${current.handle}) acts.` : null
  ]
    .filter(Boolean)
    .join(' ')
}

/** The live Combat as the DM reads it: round, current turn and the order with Creatures' state. */
export function combatState(db: Queryable) {
  const live = requireCombat(db)
  const current = initiativeOrder(db, live.id).find((c) => c.id === live.current) ?? null
  return {
    round: live.round,
    turn: current && { handle: current.handle, name: current.name, used: current.used },
    order: orderText(db)
  }
}

/**
 * Ends the live Combat: its rounds go onto the clock, rounded up to a whole minute, Creatures
 * vanish, and any initiative Call still pending is cancelled.
 */
export function endCombat(db: Queryable, at: number) {
  const live = requireCombat(db)
  const rounds = live.round
  const minutes = Math.ceil((rounds * ROUND_SECONDS) / 60)
  const clock = advanceClock(db, currentMinute(db) + minutes)
  const creatures = combatantsOf(db, live.id).filter((c) => c.kind === 'creature')
  db.update(call)
    .set({ state: 'cancelled', closedAt: at })
    .where(and(eq(call.kind, 'initiative'), inArray(call.state, ['pending', 'open'])))
    .run()
  db.delete(combatantTable).where(eq(combatantTable.combatId, live.id)).run()
  db.update(combat).set({ endedAt: at, current: null }).where(eq(combat.id, live.id)).run()
  return {
    rounds,
    minutes,
    clock,
    gone: creatures.map((c) => ({
      handle: c.handle,
      statBlock: c.statBlock!,
      hp: c.hp!,
      maxHp: c.maxHp!
    }))
  }
}

/** A Creature's HP as the Player reads it. */
const stateOf = (c: CombatantRow): HpState | null =>
  c.kind === 'creature' ? hpState(c.hp!, c.maxHp!) : null

/**
 * The live Combat as the Player's rail shows it: the order with the current turn marked; enemy HP
 * only as a state, never a number, and no handles. Null when no Combat is live.
 */
export function playerCombat(
  db: Queryable,
  characterIds: Map<string, string>,
  npcState: (handle: string) => HpState | null
): CombatView | null {
  const live = liveCombat(db)
  if (!live) return null
  const order = initiativeOrder(db, live.id)
  const waiting = waitingOnInitiative(db, live.id)
  // An NPC's name as the Characters know it, never the World's (ADR 0007).
  const shown = (c: { kind: string; handle: string; name: string }) =>
    c.kind === 'npc' ? (believedName(db, c.handle) ?? UNKNOWN_NPC) : c.name
  return {
    round: live.round,
    order: order.map((c, i) => ({
      key: `${i}`,
      name: shown(c),
      kind: c.kind,
      characterId: characterIds.get(c.handle) ?? null,
      initiative: c.initiative!,
      current: c.id === live.current,
      state: c.kind === 'npc' ? npcState(c.handle) : stateOf(c)
    })),
    waiting: waiting.map(shown)
  }
}

/** The Character whose turn it is in the live Combat, by handle; null outside a Character's turn. */
export function currentTurn(db: Queryable): CombatantRow | null {
  const live = liveCombat(db)
  if (!live?.current) return null
  return db.select().from(combatantTable).where(eq(combatantTable.id, live.current)).get() ?? null
}
