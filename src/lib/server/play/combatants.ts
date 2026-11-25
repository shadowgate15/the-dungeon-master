import { handleKind } from '#lib/world/entity-types.ts'
import { eq } from 'drizzle-orm'
import { canAct } from '#lib/character/acting.ts'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import type { AbilityKey, DerivedStats } from '#lib/rules/derive-stats.ts'
import { characterAc } from '../character/armor'
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

/** An SRD stat block, as the rules repository returns it. */
export type StatBlock = NonNullable<
  ReturnType<ReturnType<typeof createRulesRepository>['monsters']>[number]
>

/**
 * The SRD stat block a ref names, with or without its `monster:` prefix. The one lookup NPCs,
 * Creatures and start_combat share, refused alike when the SRD has no such stat block.
 */
export function statBlockFor(db: Queryable, block: string): StatBlock {
  const ref = block.startsWith('monster:') ? block : `monster:${block}`
  const found = createRulesRepository(db).entry(ref)
  if (!found || found.kind !== 'monster') {
    throw new ToolError(
      'unknown_stat_block',
      `No SRD stat block is ${ref}`,
      'Find the monster: slug with lookup and call again'
    )
  }
  return found.entry as StatBlock
}

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
      statBlock: StatBlock
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
  const rules = loadWizardRules()
  const { stats, resolved } = buildSummary(rules, {
    ...detailToSummaryData(detail),
    equipment: detail.inventory
  })
  const features = resolved.features.map((f) => ({ slug: f.slug, name: f.name }))
  return { detail, stats, features, ac: characterAc(rules, detail, stats)?.value ?? 10 }
}

function characterCombatant(db: Queryable, ref: string): Combatant | null {
  const key = ref.trim().toLowerCase()
  const holder = characterHolders(db).find(
    (c) => c.handle === key || c.id === ref || c.name.toLowerCase() === key
  )
  if (!holder) return null
  const { detail, stats, features, ac } = characterStats(db, holder.id)
  return {
    kind: 'character',
    handle: holder.handle,
    name: holder.name,
    id: holder.id,
    player: holder.player,
    detail,
    stats,
    features,
    ac,
    hp: detail.currentHp,
    maxHp: ok(stats.hitPoints) ?? detail.currentHp,
    conditions: detail.conditions,
    concentration: detail.concentration
  }
}

/** The stat block's AC: its first listed armor class. */
const statBlockAc = (m: StatBlock) => (m.armorClass as { value: number }[])[0]?.value ?? 10

/**
 * An NPC's HP and conditions, kept apart from its World page. The first time an NPC is drawn into
 * the rules it starts at its stat block's full HP.
 */
function npcCombatState(db: Queryable, handle: string, block: StatBlock) {
  return (
    db.select().from(npcCombat).where(eq(npcCombat.handle, handle)).get() ??
    db
      .insert(npcCombat)
      .values({ handle, hp: block.hitPoints, maxHp: block.hitPoints, conditions: [] })
      .returning()
      .get()
  )
}

function npcCombatant(db: Queryable, handle: string): Combatant | null {
  const npc = db.select().from(entity).where(eq(entity.handle, handle)).get()
  if (!npc || npc.type !== 'npc' || npc.retiredAt !== null) return null
  const ref = npc.fields.stat_block
  if (typeof ref !== 'string') {
    throw new ToolError(
      'no_stat_block',
      `${npc.name} (${handle}) has no stat block`,
      `Give it one with set_field(${handle}, stat_block, monster:<slug>) — find the slug with lookup — and call again`
    )
  }
  const statBlock = statBlockFor(db, ref)
  const state = npcCombatState(db, handle, statBlock)
  return {
    kind: 'npc',
    handle,
    name: npc.name,
    statBlock,
    ac: statBlockAc(statBlock),
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
  const statBlock = statBlockFor(db, row.statBlock!)
  return {
    kind: 'creature',
    handle,
    name: row.name,
    statBlock,
    ac: statBlockAc(statBlock),
    hp: row.hp!,
    maxHp: row.maxHp!,
    conditions: row.conditions,
    concentration: row.concentration
  }
}

type CharacterCombatant = Extract<Combatant, { kind: 'character' }>
type Foe = Extract<Combatant, { kind: 'npc' | 'creature' }>

/** What a combatant's HP, conditions and concentration become. */
type Write = { hp?: number; conditions?: string[]; concentration?: string | null }

/**
 * Everything that differs between Characters, NPCs and Creatures, in one place. Every rule below
 * asks its combatant's kind rather than branching on it.
 */
type KindRules<C extends Combatant> = {
  /** The combatant a ref names, or null. */
  find: (db: Queryable, ref: string) => C | null
  saveBonus: (who: C, ability: AbilityKey) => number
  /** Whether it can take an action now. */
  canAct: (who: C) => boolean
  /** How its resistances, immunities and vulnerabilities scale damage of one type. */
  damageFactor: (who: C, damageType: string | null) => number
  /** Takes damage already scaled; returns its HP after and the DM's notes on what came of it. */
  takeDamage: (
    db: Queryable,
    who: C,
    dealt: number,
    blow: { crit: boolean; knockOut: boolean }
  ) => { hp: number; notes: string[] }
  /** Refuses healing for the dead. */
  assertHealable: (db: Queryable, who: C) => void
  /** Sets its HP after healing; one at 0 HP brought above it wakes. */
  restore: (db: Queryable, who: C, hp: number) => void
  /** Whether it is out of the Combat for good. */
  isOut: (db: Queryable, who: C) => boolean
  write: (db: Queryable, who: C, set: Write) => void
}

const deadRefusal = (who: Combatant, status: string, code: string) =>
  new ToolError(
    code,
    `${who.name} is ${status}; healing can't bring them back`,
    'Only magic that restores life can; narrate it and leave the HP alone'
  )

const CHARACTER: KindRules<CharacterCombatant> = {
  find: (db, ref) => characterCombatant(db, ref) as CharacterCombatant | null,
  saveBonus: (who, ability) => ok(who.stats.savingThrows[ability])?.modifier ?? 0,
  canAct: (who) => canAct(who.detail),
  damageFactor: () => 1,
  takeDamage(db, who, dealt, { crit }) {
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
    return { hp, notes }
  },
  assertHealable(_db, who) {
    if (who.detail.status !== 'alive') throw deadRefusal(who, who.detail.status, 'character_dead')
  },
  restore(db, who, hp) {
    db.update(character).set({ currentHp: hp }).where(eq(character.id, who.id)).run()
    healedCharacter(db, who.detail, hp)
  },
  isOut: (_db, who) => who.detail.status !== 'alive',
  write(db, who, { hp, conditions, concentration }) {
    db.update(character)
      .set({
        ...(hp !== undefined ? { currentHp: hp } : {}),
        ...(conditions !== undefined ? { conditions } : {}),
        ...(concentration !== undefined ? { concentration } : {})
      })
      .where(eq(character.id, who.id))
      .run()
  }
}

/** The rules NPCs and Creatures share: a stat block, and their own HP and conditions. */
function foeRules(
  find: KindRules<Foe>['find'],
  write: KindRules<Foe>['write'],
  { dead, die }: { dead: KindRules<Foe>['isOut']; die: (db: Queryable, who: Foe) => void }
): KindRules<Foe> {
  const rules: KindRules<Foe> = {
    find,
    write,
    saveBonus(who, ability) {
      const proficiencies = who.statBlock.proficiencies as { proficiency: string; value: number }[]
      const proficient = proficiencies.find((p) => p.proficiency === `saving-throw-${ability}`)
      if (proficient) return proficient.value
      const score = (who.statBlock.abilityScores as Record<AbilityKey, number>)[ability] ?? 10
      return Math.floor((score - 10) / 2)
    },
    canAct: () => true,
    damageFactor(who, damageType) {
      if (!damageType) return 1
      const has = (list: unknown) =>
        (list as string[]).some((entry) =>
          entry
            .toLowerCase()
            .split(/[,;]\s*|\s+and\s+/)
            .includes(damageType)
        )
      if (has(who.statBlock.damageImmunities)) return 0
      if (has(who.statBlock.damageResistances)) return 0.5
      if (has(who.statBlock.damageVulnerabilities)) return 2
      return 1
    },
    takeDamage(db, who, dealt, { knockOut }) {
      const hp = Math.max(0, who.hp - dealt)
      write(db, who, { hp })
      return { hp, notes: who.hp > 0 && hp === 0 ? down(db, who, knockOut) : [] }
    },
    assertHealable(db, who) {
      if (rules.isOut(db, who)) throw deadRefusal(who, 'dead', 'npc_dead')
    },
    restore(db, who, hp) {
      // A knocked-out foe brought above 0 wakes.
      const conditions = hp > 0 ? who.conditions.filter((c) => c !== 'unconscious') : who.conditions
      write(db, who, { hp, conditions })
    },
    isOut: (db, who) => dead(db, who) || (who.hp === 0 && !who.conditions.includes('unconscious'))
  }

  /** At 0 HP: knocked out (Unconscious) when the DM rules it, else dead. */
  function down(db: Queryable, who: Foe, knockOut: boolean) {
    const ended = who.concentration ? [`concentration on ${who.concentration} ends`] : []
    if (who.concentration) write(db, who, { concentration: null })
    if (knockOut) {
      if (!who.conditions.includes('unconscious')) {
        write(db, who, { conditions: [...who.conditions, 'unconscious'] })
      }
      return [[`${who.name} is knocked out`, ...ended].join('; ')]
    }
    die(db, who)
    return [[`${who.name} dies`, ...ended].join('; ')]
  }

  return rules
}

/** An NPC keeps its combat state apart from its World page; a dead one's `status` is `dead`. */
const NPC = foeRules(
  (db, ref) => npcCombatant(db, ref) as Foe | null,
  (db, who, set) => {
    db.update(npcCombat).set(set).where(eq(npcCombat.handle, who.handle)).run()
  },
  {
    dead: (db, who) =>
      db.select().from(entity).where(eq(entity.handle, who.handle)).get()?.fields.status === 'dead',
    die(db, who) {
      const npc = db.select().from(entity).where(eq(entity.handle, who.handle)).get()!
      db.update(entity)
        .set({ fields: { ...npc.fields, status: 'dead' }, version: npc.version + 1 })
        .where(eq(entity.handle, who.handle))
        .run()
    }
  }
)

/** A Creature keeps its state on its combatant row in the live Combat. */
const CREATURE = foeRules(
  (db, ref) => creatureCombatant(db, ref) as Foe | null,
  (db, who, set) => {
    const row = liveCreature(db, who.handle)!
    db.update(combatantTable).set(set).where(eq(combatantTable.id, row.id)).run()
  },
  { dead: () => false, die: () => {} }
)

const KINDS: {
  character: KindRules<CharacterCombatant>
  npc: KindRules<Foe>
  creature: KindRules<Foe>
} = {
  character: CHARACTER,
  npc: NPC,
  creature: CREATURE
}

/** The rules for a combatant's kind. */
const rulesOf = (who: Combatant) => KINDS[who.kind] as KindRules<Combatant>

/**
 * The combatant a tool names: a Character by handle (`char:wren`) or name, an NPC by handle, or a
 * Creature in the live Combat (`creature:goblin-2`). The one lookup every action tool and primitive
 * goes through.
 */
export function combatant(db: Queryable, ref: string): Combatant {
  const kind = handleKind(ref)
  const found = (kind === 'npc' || kind === 'creature' ? KINDS[kind] : CHARACTER).find(db, ref)
  if (!found) throw ToolError.unknownHandle(ref)
  return found
}

/** A combatant's saving throw bonus: a Character's derived save, a stat block's proficiency or ability. */
export const saveBonus = (who: Combatant, ability: AbilityKey): number =>
  rulesOf(who).saveBonus(who, ability)

/** A Character who acts must be able to. */
export function mustAct(who: Combatant) {
  if (!rulesOf(who).canAct(who)) {
    throw new ToolError(
      'character_cannot_act',
      `${who.name} can't act`,
      'Choose a Character who can act'
    )
  }
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
 * The one way HP goes down. Temporary HP absorbs damage first; HP never drops below 0. Stat block
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
  const rules = rulesOf(who)
  const dealt = Math.floor(amount * rules.damageFactor(who, damageType))
  const { hp, notes } = rules.takeDamage(db, who, dealt, { crit, knockOut })
  const save =
    dice && hp > 0
      ? concentrationCheck(db, who, dealt, { dice, at, bonus: rules.saveBonus(who, 'con') })
      : { notes: [], calls: [] }
  return { dealt, hp, max: who.maxHp, notes: [...notes, ...save.notes], calls: save.calls }
}

/** Restores HP, never above the maximum. A Character at 0 HP wakes; the dead stay dead. */
export function applyHealing(db: Queryable, who: Combatant, amount: number): HpChange {
  const rules = rulesOf(who)
  rules.assertHealable(db, who)
  const hp = Math.min(who.maxHp, who.hp + amount)
  rules.restore(db, who, hp)
  return { dealt: hp - who.hp, hp, max: who.maxHp, notes: [], calls: [] }
}

/**
 * Whether a combatant is out of the Combat for good: a dead Character, or an NPC or Creature that
 * is dead or at 0 HP without being knocked out. A Character at 0 HP still rolls Death saves.
 */
export const isOut = (db: Queryable, who: Combatant): boolean => rulesOf(who).isOut(db, who)

/** Replaces a combatant's conditions. */
export function setConditions(db: Queryable, who: Combatant, conditions: string[]) {
  rulesOf(who).write(db, who, { conditions })
}

/** Conditions that leave a creature incapacitated, which ends its concentration (SRD). */
const INCAPACITATING = new Set([
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious'
])

/** Whether a condition leaves its bearer incapacitated. */
export const incapacitates = (condition: string) => INCAPACITATING.has(condition)
