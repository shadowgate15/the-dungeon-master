import { eq } from 'drizzle-orm'
import { canAct } from '#lib/character/acting.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { DerivedStats } from '#lib/rules/derive-stats.ts'
import { createCharacterService, type CharacterDetail } from '../character/service'
import { loadWizardRules } from '../character/wizard-rules'
import type { Database, Queryable } from '../db/connect'
import { character, entity, npcCombat } from '../db/schema'
import { characterHolders } from '../knowledge/holders'
import { createRulesRepository } from '../rules/repository'
import { ToolError } from '../tools/contract'

/** A monster stat block, as the rules repository returns it. */
export type Monster = NonNullable<
  ReturnType<ReturnType<typeof createRulesRepository>['monsters']>[number]
>

/**
 * Someone who can attack, be attacked, save or take damage. Characters keep their numbers in the
 * Character row and derive them; NPCs carry a `stat_block` and keep their own HP and conditions.
 * Creatures (#331) join this union.
 */
export type Combatant =
  | {
      kind: 'character'
      handle: string
      name: string
      id: string
      player: string
      detail: CharacterDetail
      stats: DerivedStats
      ac: number
      hp: number
      maxHp: number
      conditions: string[]
    }
  | {
      kind: 'npc'
      handle: string
      name: string
      monster: Monster
      ac: number
      hp: number
      maxHp: number
      conditions: string[]
    }

const ok = <T>(s: { status: 'ok'; value: T } | { status: 'pending' }): T | null =>
  s.status === 'ok' ? s.value : null

/** A Character's derived stats, from its stored choices and what it carries now. */
function characterStats(db: Queryable, id: string) {
  // Reads only: the service's reads run as well inside a tool's transaction.
  const detail = createCharacterService(db as Database).get(id)!
  const { stats } = buildSummary(loadWizardRules(), {
    ...detailToSummaryData(detail),
    equipment: detail.inventory
  })
  return { detail, stats }
}

function characterCombatant(db: Queryable, ref: string): Combatant | null {
  const key = ref.trim().toLowerCase()
  const holder = characterHolders(db).find(
    (c) => c.handle === key || c.id === ref || c.name.toLowerCase() === key
  )
  if (!holder) return null
  const { detail, stats } = characterStats(db, holder.id)
  return {
    kind: 'character',
    handle: holder.handle,
    name: holder.name,
    id: holder.id,
    player: holder.player,
    detail,
    stats,
    // Armor isn't equipped yet (#333): AC is unarmored until it is.
    ac: ok(stats.unarmoredAc)?.value ?? 10,
    hp: detail.currentHp,
    maxHp: ok(stats.hitPoints) ?? detail.currentHp,
    conditions: detail.conditions
  }
}

/** The stat block's AC: its first listed armor class. */
const monsterAc = (m: Monster) => (m.armorClass as { value: number }[])[0]?.value ?? 10

function npcCombatant(db: Queryable, handle: string): Combatant | null {
  const npc = db.select().from(entity).where(eq(entity.handle, handle)).get()
  if (!npc || npc.type !== 'npc' || npc.retiredAt !== null) return null
  const block = npc.fields.stat_block
  if (typeof block !== 'string') {
    throw new ToolError(
      'no_stat_block',
      `${npc.name} (${handle}) has no stat block`,
      `Give it one with set_field(${handle}, stat_block, monster:<slug>) — find the slug with lookup — and call again`
    )
  }
  const found = createRulesRepository(db).entry(block)
  if (!found || found.kind !== 'monster') throw ToolError.unknownHandle(block)
  const monster = found.entry as Monster
  let state = db.select().from(npcCombat).where(eq(npcCombat.handle, handle)).get()
  if (!state) {
    state = db
      .insert(npcCombat)
      .values({ handle, hp: monster.hitPoints, maxHp: monster.hitPoints, conditions: [] })
      .returning()
      .get()
  }
  return {
    kind: 'npc',
    handle,
    name: npc.name,
    monster,
    ac: monsterAc(monster),
    hp: state.hp,
    maxHp: state.maxHp,
    conditions: state.conditions
  }
}

/**
 * The combatant a tool names: a Character by handle (`char:wren`) or name, or an NPC by handle.
 * The one lookup every action tool and primitive goes through.
 */
export function combatant(db: Queryable, ref: string): Combatant {
  const found = ref.startsWith('npc:') ? npcCombatant(db, ref) : characterCombatant(db, ref)
  if (!found) throw ToolError.unknownHandle(ref)
  return found
}

/** A Character who acts must be able to. */
export function mustAct(who: Combatant) {
  if (who.kind === 'character' && !canAct(who.detail)) {
    throw new ToolError(
      'character_cannot_act',
      `${who.name} can't act`,
      'Choose a Character who can act'
    )
  }
}

/** How a monster's resistances, immunities and vulnerabilities scale damage of one type. */
function damageFactor(who: Combatant, damageType: string | null): number {
  if (who.kind !== 'npc' || !damageType) return 1
  const has = (list: unknown) =>
    (list as string[]).some((entry) =>
      entry
        .toLowerCase()
        .split(/[,;]\s*|\s+and\s+/)
        .includes(damageType)
    )
  if (has(who.monster.damageImmunities)) return 0
  if (has(who.monster.damageResistances)) return 0.5
  if (has(who.monster.damageVulnerabilities)) return 2
  return 1
}

/** Where a combatant was left by damage or healing. */
export type HpChange = { dealt: number; hp: number; max: number }

/**
 * The one way HP goes down. Temporary HP absorbs damage first; HP never drops below 0. Monster
 * resistances apply. Concentration saves (#332) and Death at 0 HP (#332) hook in here.
 */
export function applyDamage(
  db: Queryable,
  who: Combatant,
  amount: number,
  damageType: string | null
): HpChange {
  const dealt = Math.floor(amount * damageFactor(who, damageType))
  if (who.kind === 'character') {
    const absorbed = Math.min(who.detail.tempHp, dealt)
    const hp = Math.max(0, who.hp - (dealt - absorbed))
    db.update(character)
      .set({ currentHp: hp, tempHp: who.detail.tempHp - absorbed })
      .where(eq(character.id, who.id))
      .run()
    return { dealt, hp, max: who.maxHp }
  }
  const hp = Math.max(0, who.hp - dealt)
  db.update(npcCombat).set({ hp }).where(eq(npcCombat.handle, who.handle)).run()
  return { dealt, hp, max: who.maxHp }
}

/** Restores HP, never above the maximum. */
export function applyHealing(db: Queryable, who: Combatant, amount: number): HpChange {
  const hp = Math.min(who.maxHp, who.hp + amount)
  if (who.kind === 'character') {
    db.update(character).set({ currentHp: hp }).where(eq(character.id, who.id)).run()
  } else {
    db.update(npcCombat).set({ hp }).where(eq(npcCombat.handle, who.handle)).run()
  }
  return { dealt: hp - who.hp, hp, max: who.maxHp }
}

/** Replaces a combatant's conditions. */
export function setConditions(db: Queryable, who: Combatant, conditions: string[]) {
  if (who.kind === 'character') {
    db.update(character).set({ conditions }).where(eq(character.id, who.id)).run()
  } else {
    db.update(npcCombat).set({ conditions }).where(eq(npcCombat.handle, who.handle)).run()
  }
}
