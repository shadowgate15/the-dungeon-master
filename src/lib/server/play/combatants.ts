import { eq } from 'drizzle-orm'
import { canAct } from '#lib/character/acting.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { AbilityKey, DerivedStats } from '#lib/rules/derive-stats.ts'
import { createCharacterService, type CharacterDetail } from '../character/service'
import { loadWizardRules } from '../character/wizard-rules'
import type { Database, Queryable } from '../db/connect'
import { character, combatant as combatantTable, entity, npcCombat } from '../db/schema'
import { characterHolders } from '../knowledge/holders'
import { createRulesRepository } from '../rules/repository'
import { ToolError } from '../tools/contract'
import { liveCreature } from './combat'
import { damagedCharacter, healedCharacter } from './death'
import { concentrationCheck } from './concentration'
import type { Dice } from '../dice'

/** A monster stat block, as the rules repository returns it. */
export type Monster = NonNullable<
  ReturnType<ReturnType<typeof createRulesRepository>['monsters']>[number]
>

/**
 * Someone who can attack, be attacked, save or take damage. Characters keep their numbers in the
 * Character row and derive them; NPCs carry a `stat_block` and keep their own HP and conditions.
 * Creatures are faceless foes in the live Combat, keeping their HP and conditions on their
 * combatant row until it ends.
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
      /** The Character's features, by slug and name. */
      features: { slug: string; name: string }[]
      ac: number
      hp: number
      maxHp: number
      conditions: string[]
      /** The spell it is concentrating on. */
      concentration: string | null
    }
  | {
      kind: 'npc' | 'creature'
      handle: string
      name: string
      monster: Monster
      ac: number
      hp: number
      maxHp: number
      conditions: string[]
      concentration: string | null
    }

const ok = <T>(s: { status: 'ok'; value: T } | { status: 'pending' }): T | null =>
  s.status === 'ok' ? s.value : null

/** A Character's derived stats, from its stored choices and what it carries now. */
function characterStats(db: Queryable, id: string) {
  // Reads only: the service's reads run as well inside a tool's transaction.
  const detail = createCharacterService(db as Database).get(id)!
  const { stats, resolved } = buildSummary(loadWizardRules(), {
    ...detailToSummaryData(detail),
    equipment: detail.inventory
  })
  const features = resolved.features.map((f) => ({ slug: f.slug, name: f.name }))
  return { detail, stats, features }
}

function characterCombatant(db: Queryable, ref: string): Combatant | null {
  const key = ref.trim().toLowerCase()
  const holder = characterHolders(db).find(
    (c) => c.handle === key || c.id === ref || c.name.toLowerCase() === key
  )
  if (!holder) return null
  const { detail, stats, features } = characterStats(db, holder.id)
  return {
    kind: 'character',
    handle: holder.handle,
    name: holder.name,
    id: holder.id,
    player: holder.player,
    detail,
    stats,
    features,
    // Armor isn't equipped yet (#333): AC is unarmored until it is.
    ac: ok(stats.unarmoredAc)?.value ?? 10,
    hp: detail.currentHp,
    maxHp: ok(stats.hitPoints) ?? detail.currentHp,
    conditions: detail.conditions,
    concentration: detail.concentration
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
    conditions: state.conditions,
    concentration: state.concentration
  }
}

/** A Creature in the live Combat; gone once the Combat ends. */
function creatureCombatant(db: Queryable, handle: string): Combatant | null {
  const row = liveCreature(db, handle)
  if (!row) return null
  const found = createRulesRepository(db).entry(row.statBlock!)
  if (!found || found.kind !== 'monster') return null
  const monster = found.entry as Monster
  return {
    kind: 'creature',
    handle,
    name: row.name,
    monster,
    ac: monsterAc(monster),
    hp: row.hp!,
    maxHp: row.maxHp!,
    conditions: row.conditions,
    concentration: row.concentration
  }
}

/**
 * The combatant a tool names: a Character by handle (`char:wren`) or name, an NPC by handle, or a
 * Creature in the live Combat (`creature:goblin-2`). The one lookup every action tool and primitive
 * goes through.
 */
export function combatant(db: Queryable, ref: string): Combatant {
  const found = ref.startsWith('npc:')
    ? npcCombatant(db, ref)
    : ref.startsWith('creature:')
      ? creatureCombatant(db, ref)
      : characterCombatant(db, ref)
  if (!found) throw ToolError.unknownHandle(ref)
  return found
}

/** A combatant's saving throw bonus: a Character's derived save, a stat block's proficiency or ability. */
export function saveBonus(who: Combatant, ability: AbilityKey): number {
  if (who.kind === 'character') return ok(who.stats.savingThrows[ability])?.modifier ?? 0
  const proficient = (who.monster.proficiencies as { proficiency: string; value: number }[]).find(
    (p) => p.proficiency === `saving-throw-${ability}`
  )
  if (proficient) return proficient.value
  const score = (who.monster.abilityScores as Record<AbilityKey, number>)[ability] ?? 10
  return Math.floor((score - 10) / 2)
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
  if (who.kind === 'character' || !damageType) return 1
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

/** Where a combatant was left by damage or healing, with the DM's notes on what came of it. */
export type HpChange = {
  dealt: number
  hp: number
  max: number
  notes: string[]
  /** Pending concentration save Calls the damage made, for the closing narrate to attach. */
  calls: string[]
}

/**
 * How damage lands: a critical hit (two Death save failures at 0 HP), a knockout blow. With `dice`
 * and `at`, a concentrating target saves to keep its spell.
 */
export type DamageOptions = { crit?: boolean; knockOut?: boolean; dice?: Dice; at?: number }

/**
 * The one way HP goes down. Temporary HP absorbs damage first; HP never drops below 0. Monster
 * resistances apply. A Character at 0 HP falls Unconscious (or dies outright) and takes Death save
 * failures from more damage; an NPC or Creature dies at 0 HP unless knocked out. A concentrating
 * target still standing saves to keep its spell.
 */
export function applyDamage(
  db: Queryable,
  who: Combatant,
  amount: number,
  damageType: string | null,
  { crit = false, knockOut = false, dice, at = Date.now() }: DamageOptions = {}
): HpChange {
  const dealt = Math.floor(amount * damageFactor(who, damageType))
  const saving = (hp: number) =>
    dice && hp > 0
      ? concentrationCheck(db, who, dealt, { dice, at, bonus: saveBonus(who, 'con') })
      : { notes: [], calls: [] }
  if (who.kind === 'character') {
    const absorbed = Math.min(who.detail.tempHp, dealt)
    const taken = dealt - absorbed
    const hp = Math.max(0, who.hp - taken)
    db.update(character)
      .set({ currentHp: hp, tempHp: who.detail.tempHp - absorbed })
      .where(eq(character.id, who.id))
      .run()
    const notes = damagedCharacter(db, who.detail, {
      before: who.hp,
      taken,
      maxHp: who.maxHp,
      crit
    })
    const save = saving(hp)
    return { dealt, hp, max: who.maxHp, notes: [...notes, ...save.notes], calls: save.calls }
  }
  const hp = Math.max(0, who.hp - dealt)
  writeFoe(db, who, { hp })
  const notes = who.hp > 0 && hp === 0 ? foeDown(db, who, knockOut) : []
  const save = saving(hp)
  return { dealt, hp, max: who.maxHp, notes: [...notes, ...save.notes], calls: save.calls }
}

/**
 * An NPC or Creature at 0 HP: knocked out (Unconscious) when the DM rules it, else dead. A dead
 * NPC's `status` field becomes `dead`.
 */
function foeDown(db: Queryable, who: Combatant & { kind: 'npc' | 'creature' }, knockOut: boolean) {
  const ended = who.concentration ? [`concentration on ${who.concentration} ends`] : []
  if (who.concentration) writeFoe(db, who, { concentration: null })
  if (knockOut) {
    if (!who.conditions.includes('unconscious')) {
      writeFoe(db, who, { conditions: [...who.conditions, 'unconscious'] })
    }
    return [[`${who.name} is knocked out`, ...ended].join('; ')]
  }
  if (who.kind === 'npc') {
    const npc = db.select().from(entity).where(eq(entity.handle, who.handle)).get()!
    db.update(entity)
      .set({ fields: { ...npc.fields, status: 'dead' }, version: npc.version + 1 })
      .where(eq(entity.handle, who.handle))
      .run()
  }
  return [[`${who.name} dies`, ...ended].join('; ')]
}

/** Restores HP, never above the maximum. A Character at 0 HP wakes; the dead stay dead. */
export function applyHealing(db: Queryable, who: Combatant, amount: number): HpChange {
  if (who.kind === 'character' && who.detail.status !== 'alive') {
    throw new ToolError(
      'character_dead',
      `${who.name} is ${who.detail.status}; healing can't bring them back`,
      'Only magic that restores life can; narrate it and leave the HP alone'
    )
  }
  const hp = Math.min(who.maxHp, who.hp + amount)
  if (who.kind === 'character') {
    db.update(character).set({ currentHp: hp }).where(eq(character.id, who.id)).run()
    healedCharacter(db, who.detail, hp)
  } else {
    writeFoe(db, who, { hp })
  }
  return { dealt: hp - who.hp, hp, max: who.maxHp, notes: [], calls: [] }
}

/** Replaces a combatant's conditions. */
export function setConditions(db: Queryable, who: Combatant, conditions: string[]) {
  if (who.kind === 'character') {
    db.update(character).set({ conditions }).where(eq(character.id, who.id)).run()
  } else {
    writeFoe(db, who, { conditions })
  }
}

/** Writes an NPC's or Creature's own HP or conditions. */
function writeFoe(
  db: Queryable,
  who: Combatant,
  set: { hp?: number; conditions?: string[]; concentration?: string | null }
) {
  if (who.kind === 'creature') {
    const row = liveCreature(db, who.handle)!
    db.update(combatantTable).set(set).where(eq(combatantTable.id, row.id)).run()
  } else {
    db.update(npcCombat).set(set).where(eq(npcCombat.handle, who.handle)).run()
  }
}
