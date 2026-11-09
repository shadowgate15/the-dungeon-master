import { asc, eq } from 'drizzle-orm'
import type { ChoiceGroup } from '../../rules/schema'
import type { Database } from '../db/connect'
import * as t from '../db/rules-schema'

/**
 * Read access to the seeded Rules Data. Rows keep their integer `id` (what Characters reference)
 * and carry their relations as slugs, so callers never join tables themselves.
 */
export type RulesRepository = ReturnType<typeof createRulesRepository>

type OwnerType = (typeof t.choiceGroup.$inferSelect)['ownerType']

function group<K, V>(rows: V[], key: (row: V) => K): Map<K, V[]> {
  const out = new Map<K, V[]>()
  for (const row of rows) {
    const list = out.get(key(row))
    if (list) list.push(row)
    else out.set(key(row), [row])
  }
  return out
}

const slugs = <R extends { id: number; slug: string }>(rows: R[]) =>
  new Map(rows.map((r) => [r.id, r.slug]))

export function createRulesRepository(db: Database) {
  const abilitySlugs = () => slugs(db.select().from(t.ability).all())
  const choiceGroups = (ownerType: OwnerType) => {
    const groups = db
      .select()
      .from(t.choiceGroup)
      .where(eq(t.choiceGroup.ownerType, ownerType))
      .all()
    const options = db.select().from(t.choiceOption).orderBy(asc(t.choiceOption.position)).all()
    const items = db
      .select()
      .from(t.choiceOptionItem)
      .orderBy(asc(t.choiceOptionItem.position))
      .all()
    const proficiency = slugs(db.select().from(t.proficiency).all())
    const language = slugs(db.select().from(t.language).all())
    const ability = abilitySlugs()
    const equipment = slugs(db.select().from(t.equipment).all())
    const category = slugs(db.select().from(t.equipmentCategory).all())
    const itemsByOption = group(items, (i) => i.optionId)
    const optionsByGroup = group(options, (o) => o.groupId)

    const toItem = (i: (typeof items)[number]) => {
      switch (i.itemType) {
        case 'proficiency':
          return { type: 'proficiency' as const, proficiency: proficiency.get(i.proficiencyId!)! }
        case 'language':
          return { type: 'language' as const, language: language.get(i.languageId!)! }
        case 'abilityBonus':
          return {
            type: 'abilityBonus' as const,
            ability: ability.get(i.abilityId!)!,
            bonus: i.bonus!
          }
        case 'equipment':
          return {
            type: 'equipment' as const,
            equipment: equipment.get(i.equipmentId!)!,
            count: i.count!,
            requiresProficiency: i.requiresProficiencyId
              ? proficiency.get(i.requiresProficiencyId)!
              : null
          }
        case 'equipmentCategory':
          return {
            type: 'equipmentCategory' as const,
            category: category.get(i.equipmentCategoryId!)!,
            count: i.count!
          }
      }
    }

    const byOwner = new Map<string, ChoiceGroup[]>()
    for (const g of groups) {
      const built = {
        key: g.key.split('/').slice(2).join('/'),
        kind: g.kind,
        choose: g.choose,
        description: g.description,
        options: (optionsByGroup.get(g.id) ?? []).map((o) => ({
          items: (itemsByOption.get(o.id) ?? []).map(toItem)
        }))
      } as ChoiceGroup
      const list = byOwner.get(g.ownerSlug)
      if (list) list.push(built)
      else byOwner.set(g.ownerSlug, [built])
    }
    return byOwner
  }

  const bonuses = <R extends { abilityId: number; bonus: number }>(rows: R[]) => {
    const ability = abilitySlugs()
    return rows.map((r) => ({ ability: ability.get(r.abilityId)!, bonus: r.bonus }))
  }

  function races() {
    const rows = db.select().from(t.race).orderBy(asc(t.race.slug)).all()
    const choices = choiceGroups('race')
    const bonusRows = group(db.select().from(t.raceAbilityBonus).all(), (r) => r.raceId)
    const languageRows = group(db.select().from(t.raceLanguage).all(), (r) => r.raceId)
    const traitRows = group(db.select().from(t.raceTrait).all(), (r) => r.raceId)
    const language = slugs(db.select().from(t.language).all())
    const trait = slugs(db.select().from(t.trait).all())
    return rows.map((r) => ({
      ...r,
      abilityBonuses: bonuses(bonusRows.get(r.id) ?? []),
      languages: (languageRows.get(r.id) ?? []).map((l) => language.get(l.languageId)!),
      traits: (traitRows.get(r.id) ?? []).map((x) => trait.get(x.traitId)!),
      choiceGroups: choices.get(r.slug) ?? []
    }))
  }

  function subraces() {
    const race = slugs(db.select().from(t.race).all())
    const bonusRows = group(db.select().from(t.subraceAbilityBonus).all(), (r) => r.subraceId)
    const traitRows = group(db.select().from(t.subraceTrait).all(), (r) => r.subraceId)
    const trait = slugs(db.select().from(t.trait).all())
    return db
      .select()
      .from(t.subrace)
      .orderBy(asc(t.subrace.slug))
      .all()
      .map(({ raceId, ...s }) => ({
        ...s,
        race: race.get(raceId)!,
        abilityBonuses: bonuses(bonusRows.get(s.id) ?? []),
        traits: (traitRows.get(s.id) ?? []).map((x) => trait.get(x.traitId)!)
      }))
  }

  function traits() {
    const rows = db.select().from(t.trait).orderBy(asc(t.trait.slug)).all()
    const trait = slugs(rows)
    const proficiency = slugs(db.select().from(t.proficiency).all())
    const profRows = group(db.select().from(t.traitProficiency).all(), (r) => r.traitId)
    const choices = choiceGroups('trait')
    return rows.map(({ parentId, ...r }) => ({
      ...r,
      parent: parentId ? trait.get(parentId)! : null,
      proficiencies: (profRows.get(r.id) ?? []).map((p) => proficiency.get(p.proficiencyId)!),
      choiceGroups: choices.get(r.slug) ?? []
    }))
  }

  function classes() {
    const rows = db.select().from(t.classTable).orderBy(asc(t.classTable.slug)).all()
    const ability = abilitySlugs()
    const proficiency = slugs(db.select().from(t.proficiency).all())
    const equipment = slugs(db.select().from(t.equipment).all())
    const saves = group(db.select().from(t.classSavingThrow).all(), (r) => r.classId)
    const profs = group(db.select().from(t.classProficiency).all(), (r) => r.classId)
    const gear = group(db.select().from(t.classStartingEquipment).all(), (r) => r.classId)
    const choices = choiceGroups('class')
    return rows.map(({ spellcastingAbilityId, ...c }) => ({
      ...c,
      spellcastingAbility: spellcastingAbilityId ? ability.get(spellcastingAbilityId)! : null,
      savingThrows: (saves.get(c.id) ?? []).map((s) => ability.get(s.abilityId)!),
      proficiencies: (profs.get(c.id) ?? []).map((p) => proficiency.get(p.proficiencyId)!),
      startingEquipment: (gear.get(c.id) ?? []).map((e) => ({
        item: equipment.get(e.itemId)!,
        quantity: e.quantity
      })),
      choiceGroups: choices.get(c.slug) ?? []
    }))
  }

  function classLevels(classSlug: string) {
    const cls = db.select().from(t.classTable).where(eq(t.classTable.slug, classSlug)).get()
    if (!cls) return []
    const feature = slugs(db.select().from(t.feature).all())
    const levels = db
      .select()
      .from(t.classLevel)
      .where(eq(t.classLevel.classId, cls.id))
      .orderBy(asc(t.classLevel.level))
      .all()
    const links = group(db.select().from(t.classLevelFeature).all(), (r) => r.classLevelId)
    return levels.map((l) => ({
      ...l,
      features: (links.get(l.id) ?? []).map((f) => feature.get(f.featureId)!)
    }))
  }

  function subclasses() {
    const cls = slugs(db.select().from(t.classTable).all())
    return db
      .select()
      .from(t.subclass)
      .orderBy(asc(t.subclass.slug))
      .all()
      .map(({ classId, ...s }) => ({ ...s, class: cls.get(classId)! }))
  }

  function features(filter: { classSlug?: string; level?: number } = {}) {
    const cls = slugs(db.select().from(t.classTable).all())
    const sub = slugs(db.select().from(t.subclass).all())
    const rows = db.select().from(t.feature).orderBy(asc(t.feature.slug)).all()
    const feature = slugs(rows)
    return rows
      .map(({ classId, subclassId, parentId, ...f }) => ({
        ...f,
        class: cls.get(classId)!,
        subclass: subclassId ? sub.get(subclassId)! : null,
        parent: parentId ? feature.get(parentId)! : null
      }))
      .filter(
        (f) =>
          (filter.classSlug === undefined || f.class === filter.classSlug) &&
          (filter.level === undefined || f.level === filter.level)
      )
  }

  function spells(filter: { level?: number; classSlug?: string } = {}) {
    const school = slugs(db.select().from(t.magicSchool).all())
    const ability = abilitySlugs()
    const cls = slugs(db.select().from(t.classTable).all())
    const links = group(db.select().from(t.spellClass).all(), (r) => r.spellId)
    return db
      .select()
      .from(t.spell)
      .orderBy(asc(t.spell.slug))
      .all()
      .map(({ schoolId, dcAbilityId, ...s }) => ({
        ...s,
        school: school.get(schoolId)!,
        dcAbility: dcAbilityId ? ability.get(dcAbilityId)! : null,
        classes: (links.get(s.id) ?? []).map((l) => cls.get(l.classId)!).sort()
      }))
      .filter(
        (s) =>
          (filter.level === undefined || s.level === filter.level) &&
          (filter.classSlug === undefined || s.classes.includes(filter.classSlug))
      )
  }

  function equipment(filter: { categorySlug?: string } = {}) {
    const category = slugs(db.select().from(t.equipmentCategory).all())
    const damage = slugs(db.select().from(t.damageType).all())
    const property = slugs(db.select().from(t.weaponProperty).all())
    const rows = db.select().from(t.equipment).orderBy(asc(t.equipment.slug)).all()
    const item = slugs(rows)
    const props = group(db.select().from(t.equipmentWeaponProperty).all(), (r) => r.equipmentId)
    const contents = group(db.select().from(t.equipmentContent).all(), (r) => r.packId)
    const inCategory = group(db.select().from(t.equipmentCategoryItem).all(), (r) => r.equipmentId)
    return rows
      .map(({ categoryId, gearCategoryId, damageTypeId, twoHandedDamageTypeId, ...e }) => ({
        ...e,
        category: category.get(categoryId)!,
        gearCategory: gearCategoryId ? category.get(gearCategoryId)! : null,
        damageType: damageTypeId ? damage.get(damageTypeId)! : null,
        twoHandedDamageType: twoHandedDamageTypeId ? damage.get(twoHandedDamageTypeId)! : null,
        properties: (props.get(e.id) ?? []).map((p) => property.get(p.propertyId)!).sort(),
        contents: (contents.get(e.id) ?? []).map((c) => ({
          item: item.get(c.itemId)!,
          quantity: c.quantity
        })),
        categories: (inCategory.get(e.id) ?? []).map((c) => category.get(c.categoryId)!).sort()
      }))
      .filter(
        (e) => filter.categorySlug === undefined || e.categories.includes(filter.categorySlug)
      )
  }

  function backgrounds() {
    const proficiency = slugs(db.select().from(t.proficiency).all())
    const item = slugs(db.select().from(t.equipment).all())
    const alignment = slugs(db.select().from(t.alignment).all())
    const profs = group(db.select().from(t.backgroundProficiency).all(), (r) => r.backgroundId)
    const gear = group(db.select().from(t.backgroundEquipment).all(), (r) => r.backgroundId)
    const optionRows = db
      .select()
      .from(t.backgroundOption)
      .orderBy(asc(t.backgroundOption.kind), asc(t.backgroundOption.position))
      .all()
    const options = group(optionRows, (o) => o.backgroundId)
    const optionAlignments = group(
      db.select().from(t.backgroundOptionAlignment).all(),
      (r) => r.optionId
    )
    const choices = choiceGroups('background')
    return db
      .select()
      .from(t.background)
      .orderBy(asc(t.background.slug))
      .all()
      .map((b) => ({
        ...b,
        proficiencies: (profs.get(b.id) ?? []).map((p) => proficiency.get(p.proficiencyId)!),
        startingEquipment: (gear.get(b.id) ?? []).map((e) => ({
          item: item.get(e.itemId)!,
          quantity: e.quantity
        })),
        options: (options.get(b.id) ?? []).map((o) => ({
          kind: o.kind,
          text: o.text,
          alignments: (optionAlignments.get(o.id) ?? []).map((a) => alignment.get(a.alignmentId)!)
        })),
        choiceGroups: choices.get(b.slug) ?? []
      }))
  }

  return {
    datasetInfo: () =>
      db.select().from(t.rulesDataset).where(eq(t.rulesDataset.id, 1)).get() ?? null,
    abilities: () => db.select().from(t.ability).orderBy(asc(t.ability.id)).all(),
    skills: () => {
      const ability = abilitySlugs()
      return db
        .select()
        .from(t.skill)
        .orderBy(asc(t.skill.slug))
        .all()
        .map(({ abilityId, ...s }) => ({ ...s, ability: ability.get(abilityId)! }))
    },
    languages: () => db.select().from(t.language).orderBy(asc(t.language.slug)).all(),
    alignments: () => db.select().from(t.alignment).orderBy(asc(t.alignment.id)).all(),
    proficiencies: () => db.select().from(t.proficiency).orderBy(asc(t.proficiency.slug)).all(),
    traits,
    races,
    race: (slug: string) => races().find((r) => r.slug === slug) ?? null,
    subraces,
    classes,
    classBySlug: (slug: string) => classes().find((c) => c.slug === slug) ?? null,
    classLevels,
    subclasses,
    features,
    spells,
    spell: (slug: string) => spells().find((s) => s.slug === slug) ?? null,
    equipment,
    equipmentItem: (slug: string) => equipment().find((e) => e.slug === slug) ?? null,
    backgrounds,
    background: (slug: string) => backgrounds().find((b) => b.slug === slug) ?? null,
    abilityScoreMethods: () =>
      db.select().from(t.abilityScoreMethod).orderBy(asc(t.abilityScoreMethod.id)).all()
  }
}
