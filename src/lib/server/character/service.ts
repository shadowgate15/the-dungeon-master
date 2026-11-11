import { asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'
import type { Database } from '../db/connect'
import {
  abilityScoreMethod,
  alignment as alignmentTable,
  background,
  character,
  characterChoice,
  characterEquipment,
  characterSkill,
  characterSpell,
  classTable,
  equipment,
  race,
  session,
  skill,
  spell,
  subclass,
  subrace
} from '../db/schema'
import { equipmentGroupKeys } from '../../character/equipment'
import { loadRulesDataset } from '../rules/dataset'
import { ABILITY_KEYS, type AbilityKey } from '../../rules/registry'
import { resolveFeatures, type ResolverRules } from '../../rules/resolver'
import {
  ABILITY_METHODS,
  BACKSTORY_MAX,
  CUSTOM_BACKGROUND_FEATURE_MAX,
  CUSTOM_BACKGROUND_NAME_MAX,
  CUSTOM_BACKGROUND_SLUG,
  NAME_MAX,
  TEXT_MAX,
  type AbilityMethod,
  type Alignment,
  type PickSource
} from '../../character/enums'

export type Character = typeof character.$inferSelect

/** A resolved item of an equipment choice group. */
export interface StoredEquipment {
  /** The class (or background) equipment choice group key. */
  choiceKey: string
  /** Equipment slug: the specific item, even when the option was a wildcard. */
  item: string
  quantity: number
}

/**
 * Everything the player chooses, with Rules Data referenced by slug. Racial bonuses, final scores,
 * modifiers and every other derived value are not part of it. Level is always 1 at creation and
 * kept as stored on edit.
 */
export interface CharacterInput {
  name: string
  alignment?: Alignment | null
  appearance?: string | null
  personality?: string | null
  ideal?: string | null
  bond?: string | null
  flaw?: string | null
  backstory?: string | null
  race: string
  /** Required exactly when the race has subraces. */
  subrace?: string | null
  class: string
  /** Required for the level 1 subclass choosers (Cleric, Sorcerer, Warlock). */
  subclass?: string | null
  background: string
  /** Required for the `custom` background, forbidden otherwise. */
  customBackgroundName?: string | null
  customBackgroundFeature?: string | null
  abilityMethod: AbilityMethod
  /** Assigned base scores, before racial bonuses. */
  scores: Record<AbilityKey, number>
  /** Raw 4d6 dice of the six rolls; required for method `roll`, forbidden otherwise. */
  abilityRolls?: number[][] | null
  /**
   * Feature choices keyed by full choice group key (`${ownerType}/${ownerSlug}/${group key}`) to
   * the picked option slugs. Skill-kind groups hold proficiency slugs (`skill-arcana`) and are
   * stored in character_skill by the group's source; spell-kind groups (High Elf cantrip) are
   * stored in character_spell with that source; every other group in character_choice.
   * The subclass is `subclass`, not a pick.
   */
  picks?: Record<string, string[]>
  /** Spell slugs picked from the class list (cantrips and level 1), stored with source class. */
  classSpells?: string[]
  equipment?: { choiceKey: string; item: string; quantity?: number }[]
}

/** A list row: the stored Character plus the names the table shows. */
export type CharacterSummary = Character & {
  raceSlug: string
  raceName: string
  subraceName: string | null
  className: string
  backgroundName: string
}

/** One Character with its children, in the same slug vocabulary as `CharacterInput`. */
export type CharacterDetail = Character & {
  raceSlug: string
  subraceSlug: string | null
  classSlug: string
  subclassSlug: string | null
  backgroundSlug: string
  /** Picked skills (skill slugs) with their source. */
  skills: { skill: string; source: PickSource }[]
  /** Picked spells (spell slugs) with their source. */
  spells: { spell: string; level: number; source: PickSource }[]
  equipment: StoredEquipment[]
  /** Raw character_choice rows. */
  choices: { choiceKey: string; optionSlug: string }[]
  /**
   * Skill, spell (source race) and choice picks merged back into the `CharacterInput.picks` shape,
   * ready to hand to the resolver or to `update`. Skills and spells go back to the group of the
   * same source; picks that fit no group (rules drift) are only in `skills` / `spells`.
   */
  picks: Record<string, string[]>
  /** Spell slugs stored with source class. */
  classSpells: string[]
}

/** The input breaks a Character rule (required or conditional field, bad score, unknown key or slug, not editable). */
export class CharacterValidationError extends Error {}

/** The Character does not exist. */
export class CharacterNotFoundError extends Error {}

const fail = (message: string): never => {
  throw new CharacterValidationError(message)
}

function text(label: string, value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.length > max) fail(`${label} must be at most ${max} characters`)
  return trimmed
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

/** SRD point buy cost of one score. */
type MethodConfig =
  | { type: 'standardArray'; values: number[] }
  | { type: 'pointBuy'; budget: number; min: number; max: number; costs: Record<string, number> }
  | { type: 'roll'; count: number; dice: number; sides: number; dropLowest: number }

const sortedNumbers = (values: number[]) => [...values].sort((a, b) => a - b)

/** Checks the six assigned scores (and rolls) against the method's rules. */
function checkScores(input: CharacterInput, config: MethodConfig) {
  const scores = ABILITY_KEYS.map((a) => {
    const v = input.scores?.[a]
    if (!isInt(v)) return fail(`Score ${a} must be a whole number`)
    return v
  })
  const rolls = input.abilityRolls ?? null
  if (config.type !== 'roll') {
    if (rolls !== null) fail('Ability rolls are only allowed with the roll method')
  }
  switch (config.type) {
    case 'standardArray':
      if (sortedNumbers(scores).join() !== sortedNumbers(config.values).join()) {
        fail(`Standard array scores must be exactly ${config.values.join(', ')}, one per ability`)
      }
      return null
    case 'pointBuy': {
      let spent = 0
      for (const [i, v] of scores.entries()) {
        const cost = config.costs[String(v)]
        if (v < config.min || v > config.max || cost === undefined) {
          fail(`Score ${ABILITY_KEYS[i]} must be between ${config.min} and ${config.max}`)
        }
        spent += cost
      }
      if (spent > config.budget) fail(`Point buy spends ${spent} of ${config.budget} points`)
      return null
    }
    case 'roll': {
      if (!rolls) return fail('Ability rolls are required for the roll method')
      if (rolls.length !== config.count) fail(`Exactly ${config.count} ability rolls are required`)
      const totals = rolls.map((dice) => {
        if (
          !Array.isArray(dice) ||
          dice.length !== config.dice ||
          dice.some((d) => !isInt(d) || d < 1 || d > config.sides)
        ) {
          fail(`Each ability roll must be ${config.dice} dice of 1 to ${config.sides}`)
        }
        return sortedNumbers(dice)
          .slice(config.dropLowest)
          .reduce((a, b) => a + b, 0)
      })
      if (sortedNumbers(totals).join() !== sortedNumbers(scores).join()) {
        fail('Ability scores must equal the rolled totals')
      }
      return rolls.map((dice) => [...dice])
    }
  }
}

export function createCharacterService(
  db: Database,
  now: () => number = Date.now,
  rules: ResolverRules = loadRulesDataset()
) {
  const bySlug = <T extends { slug: string }>(list: readonly T[]) =>
    new Map(list.map((r) => [r.slug, r]))
  const classRules = bySlug(rules.classes)
  const backgroundRules = bySlug(rules.backgrounds)
  const spellRules = bySlug(rules.spells)
  const proficiencyRules = bySlug(rules.proficiencies)

  type Ids = Map<string, number>
  const idsOf = (
    table: typeof race | typeof subrace | typeof classTable | typeof subclass | typeof background,
    slugs: string[]
  ): Ids =>
    new Map(
      slugs.length === 0
        ? []
        : db
            .select({ slug: table.slug, id: table.id })
            .from(table)
            .where(inArray(table.slug, slugs))
            .all()
            .map((r) => [r.slug, r.id])
    )

  function lookup(label: string, table: Parameters<typeof idsOf>[0], slug: string): number {
    const id = idsOf(table, [slug]).get(slug)
    return id ?? fail(`Unknown ${label}: ${slug}`)
  }

  function optionalLookup(
    label: string,
    table: Parameters<typeof idsOf>[0],
    slug: string | null | undefined
  ): number | null {
    return slug ? lookup(label, table, slug) : null
  }

  /** Validates the whole input against the rules and Rules Data, and returns rows ready to write. */
  function prepare(input: CharacterInput) {
    const name = text('Name', input.name, NAME_MAX) ?? fail('Name is required')
    const alignment = input.alignment ?? null
    if (alignment !== null) {
      const known = db
        .select({ slug: alignmentTable.slug })
        .from(alignmentTable)
        .where(eq(alignmentTable.slug, alignment))
        .get()
      if (!known) fail(`Invalid alignment: ${String(alignment)}`)
    }
    const narrative = {
      appearance: text('Appearance', input.appearance, TEXT_MAX),
      personality: text('Personality', input.personality, TEXT_MAX),
      ideal: text('Ideal', input.ideal, TEXT_MAX),
      bond: text('Bond', input.bond, TEXT_MAX),
      flaw: text('Flaw', input.flaw, TEXT_MAX),
      backstory: text('Backstory', input.backstory, BACKSTORY_MAX)
    }

    // Structure: slugs exist in Rules Data, then the resolver checks they fit together.
    const raceId = lookup('race', race, input.race)
    const classId = lookup('class', classTable, input.class)
    const backgroundId = lookup('background', background, input.background)
    const subraceId = optionalLookup('subrace', subrace, input.subrace)
    const subclassId = optionalLookup('subclass', subclass, input.subclass)

    // Ability scores.
    if (!(ABILITY_METHODS as readonly unknown[]).includes(input.abilityMethod)) {
      fail(`Invalid ability method: ${String(input.abilityMethod)}`)
    }
    const method = db
      .select()
      .from(abilityScoreMethod)
      .where(eq(abilityScoreMethod.slug, input.abilityMethod))
      .get()
    if (!method) fail(`Unknown ability method: ${input.abilityMethod}`)
    const abilityRolls = checkScores(input, method!.config as MethodConfig)

    // Custom background: conditional fields.
    const customName = text(
      'Custom background name',
      input.customBackgroundName,
      CUSTOM_BACKGROUND_NAME_MAX
    )
    const customFeature = text(
      'Custom background feature',
      input.customBackgroundFeature,
      CUSTOM_BACKGROUND_FEATURE_MAX
    )
    if (input.background === CUSTOM_BACKGROUND_SLUG) {
      if (!customName) fail('Custom background name is required')
      if (!customFeature) fail('Custom background feature is required')
    } else if (customName || customFeature) {
      fail('Custom background fields are only allowed with the custom background')
    }

    // Feature choices through the resolver: structure, conditional subrace/subclass, key and slug
    // checks, counts and legality.
    const picks = input.picks ?? {}
    const resolved = resolveFeatures(rules, {
      race: input.race,
      subrace: input.subrace ?? null,
      class: input.class,
      subclass: input.subclass ?? null,
      background: input.background,
      picks
    })
    const structure = resolved.structure[0]
    if (structure) fail(`Invalid ${structure.field}: ${structure.type}`)
    const orphan = resolved.orphanPicks[0]
    if (orphan) fail(`Unknown choice ${orphan.key}`)
    for (const g of resolved.groups) {
      if (g.kind === 'subclass') continue
      if (g.status === 'incomplete') fail(`Choice ${g.key} needs ${g.choose} pick(s)`)
      if (g.status !== 'valid') {
        fail(`Choice ${g.key} has an invalid pick: ${g.issues.map((i) => i.type).join(', ')}`)
      }
    }

    const skillSlugs = new Map(
      db
        .select({ slug: skill.slug, id: skill.id })
        .from(skill)
        .all()
        .map((r) => [r.slug, r.id])
    )
    const skills = new Map<number, PickSource>()
    const choiceRows: { choiceKey: string; optionSlug: string }[] = []
    const racialSpells: { slug: string; source: PickSource }[] = []
    for (const g of resolved.groups) {
      if (g.kind === 'subclass') continue
      for (const pick of g.picks) {
        if (g.kind === 'skill') {
          const slug = proficiencyRules.get(pick)?.reference?.slug ?? pick.replace(/^skill-/, '')
          const id = skillSlugs.get(slug) ?? fail(`Unknown skill: ${pick}`)
          skills.set(id, g.source)
        } else if (g.kind === 'spell') {
          racialSpells.push({ slug: pick, source: g.source })
        } else {
          choiceRows.push({ choiceKey: g.key, optionSlug: pick })
        }
      }
    }

    // Class spell picks: real cantrips or level 1 spells on the class list.
    const classSpells = [...new Set(input.classSpells ?? [])]
    for (const slug of classSpells) {
      const s = spellRules.get(slug) ?? fail(`Unknown spell: ${slug}`)
      if (s.level > 1) fail(`Spell ${slug} is above level 1`)
      if (!s.classes.includes(input.class)) fail(`Spell ${slug} is not on the ${input.class} list`)
    }
    const spellSources = new Map<string, PickSource>()
    for (const s of racialSpells) spellSources.set(s.slug, s.source)
    for (const slug of classSpells) {
      if (spellSources.has(slug)) fail(`Spell ${slug} is picked twice`)
      spellSources.set(slug, 'class')
    }
    const spellIds = new Map(
      spellSources.size === 0
        ? []
        : db
            .select({ slug: spell.slug, id: spell.id })
            .from(spell)
            .where(inArray(spell.slug, [...spellSources.keys()]))
            .all()
            .map((r) => [r.slug, r.id])
    )
    const spells = [...spellSources].map(([slug, source]) => ({
      spellId: spellIds.get(slug) ?? fail(`Unknown spell: ${slug}`),
      source
    }))

    // Equipment: keys are the class's and background's equipment choice groups; every group needs
    // a pick (#113); items exist.
    const requiredKeys = [
      ...equipmentGroupKeys('class', input.class, classRules.get(input.class)?.choiceGroups),
      ...equipmentGroupKeys(
        'background',
        input.background,
        backgroundRules.get(input.background)?.choiceGroups
      )
    ]
    const legalKeys = new Set(requiredKeys)
    const gear = input.equipment ?? []
    const seen = new Set<string>()
    for (const row of gear) {
      if (!legalKeys.has(row.choiceKey)) fail(`Unknown equipment choice: ${row.choiceKey}`)
      const quantity = row.quantity ?? 1
      if (!isInt(quantity) || quantity < 1)
        fail('Equipment quantity must be a positive whole number')
      const dupe = `${row.choiceKey}\u0000${row.item}`
      if (seen.has(dupe)) fail(`Equipment ${row.item} is listed twice for ${row.choiceKey}`)
      seen.add(dupe)
    }
    for (const key of requiredKeys) {
      if (!gear.some((r) => r.choiceKey === key)) fail(`Equipment choice ${key} needs a pick`)
    }
    const itemSlugs = [...new Set(gear.map((r) => r.item))]
    const itemIds = new Map(
      itemSlugs.length === 0
        ? []
        : db
            .select({ slug: equipment.slug, id: equipment.id })
            .from(equipment)
            .where(inArray(equipment.slug, itemSlugs))
            .all()
            .map((r) => [r.slug, r.id])
    )
    const equipmentRows = gear.map((r) => ({
      choiceKey: r.choiceKey,
      itemId: itemIds.get(r.item) ?? fail(`Unknown item: ${r.item}`),
      quantity: r.quantity ?? 1
    }))

    return {
      row: {
        name,
        alignment,
        ...narrative,
        raceId,
        subraceId,
        classId,
        subclassId,
        backgroundId,
        customBackgroundName: customName,
        customBackgroundFeature: customFeature,
        abilityMethod: input.abilityMethod,
        str: input.scores.str,
        dex: input.scores.dex,
        con: input.scores.con,
        int: input.scores.int,
        wis: input.scores.wis,
        cha: input.scores.cha,
        abilityRolls
      },
      skills: [...skills].map(([skillId, source]) => ({ skillId, source })),
      spells,
      equipment: equipmentRows,
      choices: choiceRows
    }
  }

  type Prepared = ReturnType<typeof prepare>
  type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

  function writeChildren(tx: Tx, characterId: string, p: Prepared) {
    if (p.skills.length) {
      tx.insert(characterSkill)
        .values(p.skills.map((s) => ({ ...s, characterId })))
        .run()
    }
    if (p.spells.length) {
      tx.insert(characterSpell)
        .values(p.spells.map((s) => ({ ...s, characterId })))
        .run()
    }
    if (p.equipment.length) {
      tx.insert(characterEquipment)
        .values(p.equipment.map((e) => ({ ...e, characterId })))
        .run()
    }
    if (p.choices.length) {
      tx.insert(characterChoice)
        .values(p.choices.map((c) => ({ ...c, characterId })))
        .run()
    }
  }

  function setArchived(id: string, archivedAt: number | null): Character {
    const current = db.select().from(character).where(eq(character.id, id)).get()
    if (!current) throw new CharacterNotFoundError('Character not found')
    // Already in the requested state: no-op, so archived_at/updated_at are not overwritten.
    if ((current.archivedAt === null) === (archivedAt === null)) return current
    return db
      .update(character)
      .set({ archivedAt, updatedAt: now() })
      .where(eq(character.id, id))
      .returning()
      .get()
  }

  function summaries(where: SQL, order: SQL[]) {
    const rows = db
      .select({
        character,
        raceSlug: race.slug,
        raceName: race.name,
        subraceName: subrace.name,
        className: classTable.name,
        backgroundName: background.name
      })
      .from(character)
      .innerJoin(race, eq(race.id, character.raceId))
      .leftJoin(subrace, eq(subrace.id, character.subraceId))
      .innerJoin(classTable, eq(classTable.id, character.classId))
      .innerJoin(background, eq(background.id, character.backgroundId))
      .where(where)
      .orderBy(...order)
      .all()
    return rows.map(({ character: c, ...names }): CharacterSummary => ({ ...c, ...names }))
  }

  return {
    /** Validates, then inserts the Character and all its child rows atomically. Level is 1. */
    create(input: CharacterInput): Character {
      const p = prepare(input)
      return db.transaction((tx) => {
        const at = now()
        const created = tx
          .insert(character)
          .values({ ...p.row, level: 1, createdAt: at, updatedAt: at })
          .returning()
          .get()
        writeChildren(tx, created.id, p)
        return created
      })
    },

    /**
     * Replaces the scalar fields and every child row in one transaction; updated_at always moves.
     * Level, created_at and archived state are kept. An archived Character cannot be edited.
     */
    update(id: string, input: CharacterInput): Character {
      const p = prepare(input)
      return db.transaction((tx) => {
        const current = tx.select().from(character).where(eq(character.id, id)).get()
        if (!current) throw new CharacterNotFoundError('Character not found')
        if (current.archivedAt !== null) {
          throw new CharacterValidationError('An archived Character cannot be edited')
        }
        const updated = tx
          .update(character)
          .set({ ...p.row, updatedAt: now() })
          .where(eq(character.id, id))
          .returning()
          .get()
        tx.delete(characterSkill).where(eq(characterSkill.characterId, id)).run()
        tx.delete(characterSpell).where(eq(characterSpell.characterId, id)).run()
        tx.delete(characterEquipment).where(eq(characterEquipment.characterId, id)).run()
        tx.delete(characterChoice).where(eq(characterChoice.characterId, id)).run()
        writeChildren(tx, id, p)
        return updated
      })
    },

    /** Always allowed; a no-op when already archived. */
    archive(id: string): Character {
      return setArchived(id, now())
    },

    /** Always allowed; a no-op when already active. */
    restore(id: string): Character {
      return setArchived(id, null)
    },

    /**
     * Hard delete; child rows cascade. Refused while the Character has any Session, because
     * deleting it would erase the Session transcripts, which are append-only.
     */
    delete(id: string): void {
      const played = db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.characterId, id))
        .get()
      if (played) {
        throw new CharacterValidationError(
          'This Character has played Sessions and cannot be deleted. Archive it instead.'
        )
      }
      const deleted = db.delete(character).where(eq(character.id, id)).returning().get()
      if (!deleted) throw new CharacterNotFoundError('Character not found')
    },

    /** One Character with its children, or undefined. Archived Characters are returned too. */
    get(id: string): CharacterDetail | undefined {
      const found = db.select().from(character).where(eq(character.id, id)).get()
      if (!found) return undefined
      const slugOf = (
        table:
          typeof race | typeof subrace | typeof classTable | typeof subclass | typeof background,
        rowId: number | null
      ) =>
        rowId === null
          ? null
          : (db.select({ slug: table.slug }).from(table).where(eq(table.id, rowId)).get()?.slug ??
            null)
      const skills = db
        .select({ skill: skill.slug, source: characterSkill.source })
        .from(characterSkill)
        .innerJoin(skill, eq(skill.id, characterSkill.skillId))
        .where(eq(characterSkill.characterId, id))
        .orderBy(asc(skill.slug))
        .all()
      const spells = db
        .select({ spell: spell.slug, level: spell.level, source: characterSpell.source })
        .from(characterSpell)
        .innerJoin(spell, eq(spell.id, characterSpell.spellId))
        .where(eq(characterSpell.characterId, id))
        .orderBy(asc(spell.level), asc(spell.slug))
        .all()
      const gear = db
        .select({
          choiceKey: characterEquipment.choiceKey,
          item: equipment.slug,
          quantity: characterEquipment.quantity
        })
        .from(characterEquipment)
        .innerJoin(equipment, eq(equipment.id, characterEquipment.itemId))
        .where(eq(characterEquipment.characterId, id))
        .orderBy(asc(characterEquipment.choiceKey), asc(equipment.slug))
        .all()
      const choices = db
        .select({
          choiceKey: characterChoice.choiceKey,
          optionSlug: characterChoice.optionSlug
        })
        .from(characterChoice)
        .where(eq(characterChoice.characterId, id))
        .orderBy(asc(characterChoice.choiceKey), asc(characterChoice.optionSlug))
        .all()

      const detail = {
        raceSlug: slugOf(race, found.raceId)!,
        subraceSlug: slugOf(subrace, found.subraceId),
        classSlug: slugOf(classTable, found.classId)!,
        subclassSlug: slugOf(subclass, found.subclassId),
        backgroundSlug: slugOf(background, found.backgroundId)!
      }

      // Rebuild `picks`: choices as stored, then skills and racial spells back into the group of
      // the same source.
      const picks: Record<string, string[]> = {}
      for (const c of choices) (picks[c.choiceKey] ??= []).push(c.optionSlug)
      const groups = resolveFeatures(rules, {
        race: detail.raceSlug,
        subrace: detail.subraceSlug,
        class: detail.classSlug,
        subclass: detail.subclassSlug,
        background: detail.backgroundSlug,
        picks
      }).groups
      const fill = (kind: 'skill' | 'spell', items: { slug: string; source: PickSource }[]) => {
        for (const g of groups.filter((x) => x.kind === kind)) {
          const mine = items.filter((i) => i.source === g.source).splice(0, g.choose)
          if (mine.length === 0) continue
          picks[g.key] = mine.map((i) => i.slug)
          for (const i of mine) items.splice(items.indexOf(i), 1)
        }
      }
      fill(
        'skill',
        skills.map((s) => ({ slug: `skill-${s.skill}`, source: s.source }))
      )
      fill(
        'spell',
        spells.filter((s) => s.source !== 'class').map((s) => ({ slug: s.spell, source: s.source }))
      )

      return {
        ...found,
        ...detail,
        skills,
        spells,
        equipment: gear,
        choices,
        picks,
        classSpells: spells.filter((s) => s.source === 'class').map((s) => s.spell)
      }
    },

    /** Active Characters, oldest first, with the names the list shows. */
    list(): CharacterSummary[] {
      return summaries(isNull(character.archivedAt), [
        asc(character.createdAt),
        asc(sql`${character}.rowid`)
      ])
    },

    /** Archived Characters, most recently archived first. */
    listArchived(): CharacterSummary[] {
      return summaries(isNotNull(character.archivedAt), [
        desc(character.archivedAt),
        desc(sql`${character}.rowid`)
      ])
    }
  }
}

export type CharacterService = ReturnType<typeof createCharacterService>
