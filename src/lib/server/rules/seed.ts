import { getTableColumns, sql } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { RulesDataset } from '../../rules/schema'
import type { Database } from '../db/connect'
import * as t from '../db/rules-schema'
import { loadRulesDataset } from './dataset'

type Ids = Map<string, number>

/** Keeps a statement under SQLite's bound-parameter limit. */
const MAX_PARAMS = 800

function chunked<R>(table: SQLiteTable, rows: R[]): R[][] {
  const per = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(getTableColumns(table)).length))
  const out: R[][] = []
  for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per))
  return out
}

/** Replaces every column but the id and slug with the incoming row's value. */
function excluded(table: SQLiteTable & { slug: SQLiteColumn }) {
  return Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => key !== 'id' && key !== 'slug')
      .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)])
  )
}

function omit<R extends object, K extends keyof R>(row: R, ...keys: K[]): Omit<R, K> {
  const copy = { ...row }
  for (const key of keys) delete copy[key]
  return copy
}

function need(ids: Ids, slug: string, what: string): number {
  const id = ids.get(slug)
  if (id === undefined) throw new Error(`Rules Data references unknown ${what}: ${slug}`)
  return id
}

/**
 * Seeds the Rules Data tables from the committed dataset, in one transaction.
 *
 * Reseeding is an idempotent upsert on slug: existing rows keep their ids and are updated in
 * place, new rows are added, and rows the dataset no longer lists are left alone, so nothing a
 * Character references is ever deleted or renumbered. Join and choice tables hold no Character
 * references (Characters save a choice group's stable `key`), so they are rebuilt each time.
 */
export function seedRulesData(
  db: Database,
  dataset: RulesDataset = loadRulesDataset(),
  now: () => number = Date.now
) {
  db.transaction((tx) => {
    /** Upserts entity rows on slug and returns every slug's id. */
    function upsert<R extends { slug: string }>(
      table: SQLiteTable & { slug: SQLiteColumn; id: SQLiteColumn },
      rows: R[]
    ): Ids {
      for (const chunk of chunked(table, rows)) {
        tx.insert(table)
          .values(chunk as never)
          .onConflictDoUpdate({ target: table.slug, set: excluded(table) })
          .run()
      }
      const found = tx.select({ id: table.id, slug: table.slug }).from(table).all()
      return new Map(found.map((r) => [r.slug as string, r.id as number]))
    }

    function insert<R>(table: SQLiteTable, rows: R[]) {
      for (const chunk of chunked(table, rows))
        tx.insert(table)
          .values(chunk as never)
          .run()
    }

    // Join and choice tables are rebuilt; clear them children-first.
    for (const table of [
      t.choiceOptionItem,
      t.choiceOption,
      t.choiceGroup,
      t.backgroundOptionAlignment,
      t.backgroundOption,
      t.backgroundEquipment,
      t.backgroundProficiency,
      t.subclassLevelFeature,
      t.subclassLevel,
      t.classLevelFeature,
      t.classLevel,
      t.subclassSpell,
      t.spellClass,
      t.classStartingEquipment,
      t.classProficiency,
      t.classSavingThrow,
      t.subraceTrait,
      t.subraceAbilityBonus,
      t.raceTrait,
      t.raceLanguage,
      t.raceAbilityBonus,
      t.traitProficiency,
      t.equipmentContent,
      t.equipmentWeaponProperty,
      t.equipmentCategoryItem
    ]) {
      tx.delete(table).run()
    }

    // --- Reference tables
    const ability = upsert(
      t.ability,
      dataset.abilities.map((a) => ({ ...a }))
    )
    upsert(
      t.skill,
      dataset.skills.map(({ ability: a, ...s }) => ({
        ...s,
        abilityId: need(ability, a, 'ability')
      }))
    )
    const language = upsert(t.language, dataset.languages)
    const alignment = upsert(t.alignment, dataset.alignments)
    const damageType = upsert(t.damageType, dataset.damageTypes)
    const magicSchool = upsert(t.magicSchool, dataset.magicSchools)
    const weaponProperty = upsert(t.weaponProperty, dataset.weaponProperties)
    const proficiency = upsert(
      t.proficiency,
      dataset.proficiencies.map(({ reference, ...p }) => ({
        ...p,
        referenceType: reference?.type ?? null,
        referenceSlug: reference?.slug ?? null
      }))
    )

    // --- Equipment
    const equipmentCategory = upsert(t.equipmentCategory, dataset.equipmentCategories)
    const equipment = upsert(
      t.equipment,
      dataset.equipment.map((e) => ({
        slug: e.slug,
        name: e.name,
        categoryId: need(equipmentCategory, e.category, 'equipment category'),
        gearCategoryId: e.gearCategory
          ? need(equipmentCategory, e.gearCategory, 'gear category')
          : null,
        description: e.description,
        costQuantity: e.costQuantity,
        costUnit: e.costUnit,
        weight: e.weight,
        weaponCategory: e.weaponCategory,
        weaponRange: e.weaponRange,
        categoryRange: e.categoryRange,
        damageDice: e.damage?.dice ?? null,
        damageTypeId: e.damage ? need(damageType, e.damage.type, 'damage type') : null,
        twoHandedDamageDice: e.twoHandedDamage?.dice ?? null,
        twoHandedDamageTypeId: e.twoHandedDamage
          ? need(damageType, e.twoHandedDamage.type, 'damage type')
          : null,
        rangeNormal: e.range?.normal ?? null,
        rangeLong: e.range?.long ?? null,
        throwRangeNormal: e.throwRange?.normal ?? null,
        throwRangeLong: e.throwRange?.long ?? null,
        special: e.special,
        armorCategory: e.armorCategory,
        armorClassBase: e.armorClassBase,
        armorClassDexBonus: e.armorClassDexBonus,
        armorClassMaxBonus: e.armorClassMaxBonus,
        strMinimum: e.strMinimum,
        stealthDisadvantage: e.stealthDisadvantage,
        toolCategory: e.toolCategory,
        vehicleCategory: e.vehicleCategory,
        speedQuantity: e.speedQuantity,
        speedUnit: e.speedUnit,
        capacity: e.capacity,
        quantity: e.quantity
      }))
    )
    insert(
      t.equipmentCategoryItem,
      dataset.equipmentCategories.flatMap((c) =>
        c.items.map((i) => ({
          categoryId: need(equipmentCategory, c.slug, 'equipment category'),
          equipmentId: need(equipment, i, 'equipment')
        }))
      )
    )
    insert(
      t.equipmentWeaponProperty,
      dataset.equipment.flatMap((e) =>
        e.properties.map((p) => ({
          equipmentId: need(equipment, e.slug, 'equipment'),
          propertyId: need(weaponProperty, p, 'weapon property')
        }))
      )
    )
    insert(
      t.equipmentContent,
      dataset.equipment.flatMap((e) =>
        e.contents.map((c) => ({
          packId: need(equipment, e.slug, 'equipment'),
          itemId: need(equipment, c.item, 'equipment'),
          quantity: c.quantity
        }))
      )
    )

    // --- Traits, races, subraces
    const trait = upsert(
      t.trait,
      dataset.traits.map((r) => omit(r, 'proficiencies', 'choiceGroups', 'parent'))
    )
    for (const tr of dataset.traits) {
      tx.update(t.trait)
        .set({ parentId: tr.parent ? need(trait, tr.parent, 'trait') : null })
        .where(sql`${t.trait.id} = ${need(trait, tr.slug, 'trait')}`)
        .run()
    }
    insert(
      t.traitProficiency,
      dataset.traits.flatMap((tr) =>
        tr.proficiencies.map((p) => ({
          traitId: need(trait, tr.slug, 'trait'),
          proficiencyId: need(proficiency, p, 'proficiency')
        }))
      )
    )

    const race = upsert(
      t.race,
      dataset.races.map((r) => omit(r, 'abilityBonuses', 'languages', 'traits', 'choiceGroups'))
    )
    insert(
      t.raceAbilityBonus,
      dataset.races.flatMap((r) =>
        r.abilityBonuses.map((b) => ({
          raceId: need(race, r.slug, 'race'),
          abilityId: need(ability, b.ability, 'ability'),
          bonus: b.bonus
        }))
      )
    )
    insert(
      t.raceLanguage,
      dataset.races.flatMap((r) =>
        r.languages.map((l) => ({
          raceId: need(race, r.slug, 'race'),
          languageId: need(language, l, 'language')
        }))
      )
    )
    insert(
      t.raceTrait,
      dataset.races.flatMap((r) =>
        r.traits.map((tr) => ({
          raceId: need(race, r.slug, 'race'),
          traitId: need(trait, tr, 'trait')
        }))
      )
    )

    const subrace = upsert(
      t.subrace,
      dataset.subraces.map((s) => ({
        ...omit(s, 'race', 'abilityBonuses', 'traits'),
        raceId: need(race, s.race, 'race')
      }))
    )
    insert(
      t.subraceAbilityBonus,
      dataset.subraces.flatMap((s) =>
        s.abilityBonuses.map((b) => ({
          subraceId: need(subrace, s.slug, 'subrace'),
          abilityId: need(ability, b.ability, 'ability'),
          bonus: b.bonus
        }))
      )
    )
    insert(
      t.subraceTrait,
      dataset.subraces.flatMap((s) =>
        s.traits.map((tr) => ({
          subraceId: need(subrace, s.slug, 'subrace'),
          traitId: need(trait, tr, 'trait')
        }))
      )
    )

    // --- Classes, subclasses, features, levels
    const classId = upsert(
      t.classTable,
      dataset.classes.map((c) => ({
        slug: c.slug,
        name: c.name,
        hitDie: c.hitDie,
        spellcastingLevel: c.spellcasting?.level ?? null,
        spellcastingAbilityId: c.spellcasting
          ? need(ability, c.spellcasting.ability, 'ability')
          : null,
        spellcastingInfo: c.spellcasting?.info ?? null
      }))
    )
    insert(
      t.classSavingThrow,
      dataset.classes.flatMap((c) =>
        c.savingThrows.map((a) => ({
          classId: need(classId, c.slug, 'class'),
          abilityId: need(ability, a, 'ability')
        }))
      )
    )
    insert(
      t.classProficiency,
      dataset.classes.flatMap((c) =>
        c.proficiencies.map((p) => ({
          classId: need(classId, c.slug, 'class'),
          proficiencyId: need(proficiency, p, 'proficiency')
        }))
      )
    )
    insert(
      t.classStartingEquipment,
      dataset.classes.flatMap((c) =>
        c.startingEquipment.map((e) => ({
          classId: need(classId, c.slug, 'class'),
          itemId: need(equipment, e.item, 'equipment'),
          quantity: e.quantity
        }))
      )
    )

    const subclass = upsert(
      t.subclass,
      dataset.subclasses.map((s) => ({
        ...omit(s, 'class', 'spells'),
        classId: need(classId, s.class, 'class')
      }))
    )
    const feature = upsert(
      t.feature,
      dataset.features.map((f) => ({
        ...omit(f, 'class', 'subclass', 'parent'),
        classId: need(classId, f.class, 'class'),
        subclassId: f.subclass ? need(subclass, f.subclass, 'subclass') : null
      }))
    )
    for (const f of dataset.features.filter((x) => x.parent)) {
      tx.update(t.feature)
        .set({ parentId: need(feature, f.parent!, 'feature') })
        .where(sql`${t.feature.id} = ${need(feature, f.slug, 'feature')}`)
        .run()
    }

    for (const l of dataset.classLevels) {
      const inserted = tx
        .insert(t.classLevel)
        .values({
          classId: need(classId, l.class, 'class'),
          level: l.level,
          abilityScoreBonuses: l.abilityScoreBonuses,
          proficiencyBonus: l.proficiencyBonus,
          cantripsKnown: l.spellcasting?.cantripsKnown ?? null,
          spellsKnown: l.spellcasting?.spellsKnown ?? null,
          slotsLevel1: l.spellcasting?.slots[0] ?? null,
          slotsLevel2: l.spellcasting?.slots[1] ?? null,
          slotsLevel3: l.spellcasting?.slots[2] ?? null,
          slotsLevel4: l.spellcasting?.slots[3] ?? null,
          slotsLevel5: l.spellcasting?.slots[4] ?? null,
          slotsLevel6: l.spellcasting?.slots[5] ?? null,
          slotsLevel7: l.spellcasting?.slots[6] ?? null,
          slotsLevel8: l.spellcasting?.slots[7] ?? null,
          slotsLevel9: l.spellcasting?.slots[8] ?? null,
          classSpecific: l.classSpecific
        })
        .returning({ id: t.classLevel.id })
        .get()
      insert(
        t.classLevelFeature,
        l.features.map((f) => ({
          classLevelId: inserted.id,
          featureId: need(feature, f, 'feature')
        }))
      )
    }
    for (const l of dataset.subclassLevels) {
      const inserted = tx
        .insert(t.subclassLevel)
        .values({
          subclassId: need(subclass, l.subclass, 'subclass'),
          level: l.level,
          subclassSpecific: l.subclassSpecific
        })
        .returning({ id: t.subclassLevel.id })
        .get()
      insert(
        t.subclassLevelFeature,
        l.features.map((f) => ({
          subclassLevelId: inserted.id,
          featureId: need(feature, f, 'feature')
        }))
      )
    }

    // --- Spells
    const spell = upsert(
      t.spell,
      dataset.spells.map((s) => ({
        slug: s.slug,
        name: s.name,
        level: s.level,
        schoolId: need(magicSchool, s.school, 'magic school'),
        description: s.description,
        higherLevel: s.higherLevel,
        range: s.range,
        components: s.components,
        material: s.material,
        ritual: s.ritual,
        concentration: s.concentration,
        duration: s.duration,
        castingTime: s.castingTime,
        attackType: s.attackType,
        dcAbilityId: s.dc ? need(ability, s.dc.ability, 'ability') : null,
        dcSuccess: s.dc?.success ?? null,
        dcDescription: s.dc?.description ?? null,
        areaType: s.areaOfEffect?.type ?? null,
        areaSize: s.areaOfEffect?.size ?? null,
        damage: s.damage,
        healAtSlotLevel: s.healAtSlotLevel
      }))
    )
    insert(
      t.spellClass,
      dataset.spells.flatMap((s) =>
        s.classes.map((c) => ({
          spellId: need(spell, s.slug, 'spell'),
          classId: need(classId, c, 'class')
        }))
      )
    )
    insert(
      t.subclassSpell,
      dataset.subclasses.flatMap((s) =>
        s.spells.map((x) => ({
          subclassId: need(subclass, s.slug, 'subclass'),
          spellId: need(spell, x.spell, 'spell'),
          minClassLevel: x.minClassLevel
        }))
      )
    )

    // --- Backgrounds and app-authored rules
    const background = upsert(
      t.background,
      dataset.backgrounds.map((b) => ({
        slug: b.slug,
        name: b.name,
        appAuthored: b.appAuthored,
        description: b.description,
        featureName: b.feature?.name ?? null,
        featureDescription: b.feature?.description ?? null,
        startingGoldQuantity: b.startingGoldQuantity,
        startingGoldUnit: b.startingGoldUnit
      }))
    )
    insert(
      t.backgroundProficiency,
      dataset.backgrounds.flatMap((b) =>
        b.proficiencies.map((p) => ({
          backgroundId: need(background, b.slug, 'background'),
          proficiencyId: need(proficiency, p, 'proficiency')
        }))
      )
    )
    insert(
      t.backgroundEquipment,
      dataset.backgrounds.flatMap((b) =>
        b.startingEquipment.map((e) => ({
          backgroundId: need(background, b.slug, 'background'),
          itemId: need(equipment, e.item, 'equipment'),
          quantity: e.quantity
        }))
      )
    )
    for (const b of dataset.backgrounds) {
      const positions = new Map<string, number>()
      for (const o of b.options) {
        const position = positions.get(o.kind) ?? 0
        positions.set(o.kind, position + 1)
        const inserted = tx
          .insert(t.backgroundOption)
          .values({
            backgroundId: need(background, b.slug, 'background'),
            kind: o.kind,
            position,
            text: o.text
          })
          .returning({ id: t.backgroundOption.id })
          .get()
        insert(
          t.backgroundOptionAlignment,
          o.alignments.map((a) => ({
            optionId: inserted.id,
            alignmentId: need(alignment, a, 'alignment')
          }))
        )
      }
    }
    upsert(
      t.abilityScoreMethod,
      dataset.abilityScoreMethods.map((m) => ({ ...m }))
    )

    // --- Choice groups, from every owner
    const owners = [
      ...dataset.classes.map((c) => ['class', c.slug, c.choiceGroups] as const),
      ...dataset.races.map((r) => ['race', r.slug, r.choiceGroups] as const),
      ...dataset.traits.map((x) => ['trait', x.slug, x.choiceGroups] as const),
      ...dataset.backgrounds.map((b) => ['background', b.slug, b.choiceGroups] as const)
    ]
    for (const [ownerType, ownerSlug, groups] of owners) {
      for (const g of groups) {
        const key = `${ownerType}/${ownerSlug}/${g.key}`
        const group = tx
          .insert(t.choiceGroup)
          .values({
            key,
            ownerType,
            ownerSlug,
            kind: g.kind,
            choose: g.choose,
            description: g.description
          })
          .returning({ id: t.choiceGroup.id })
          .get()
        g.options.forEach((option, position) => {
          const inserted = tx
            .insert(t.choiceOption)
            .values({ groupId: group.id, position })
            .returning({ id: t.choiceOption.id })
            .get()
          insert(
            t.choiceOptionItem,
            option.items.map((item, itemPosition) => ({
              optionId: inserted.id,
              position: itemPosition,
              itemType: item.type,
              proficiencyId:
                item.type === 'proficiency'
                  ? need(proficiency, item.proficiency, 'proficiency')
                  : null,
              languageId:
                item.type === 'language' ? need(language, item.language, 'language') : null,
              abilityId:
                item.type === 'abilityBonus' ? need(ability, item.ability, 'ability') : null,
              bonus: item.type === 'abilityBonus' ? item.bonus : null,
              equipmentId:
                item.type === 'equipment' ? need(equipment, item.equipment, 'equipment') : null,
              equipmentCategoryId:
                item.type === 'equipmentCategory'
                  ? need(equipmentCategory, item.category, 'equipment category')
                  : null,
              count:
                item.type === 'equipment' || item.type === 'equipmentCategory' ? item.count : null,
              requiresProficiencyId:
                item.type === 'equipment' && item.requiresProficiency
                  ? need(proficiency, item.requiresProficiency, 'proficiency')
                  : null
            }))
          )
        })
      }
    }

    // --- Dataset version
    const meta = dataset.meta
    tx.insert(t.rulesDataset)
      .values({ id: 1, ...meta, seededAt: now() })
      .onConflictDoUpdate({
        target: t.rulesDataset.id,
        set: {
          datasetVersion: meta.datasetVersion,
          sourceTag: meta.sourceTag,
          sourceRepository: meta.sourceRepository,
          sourcePath: meta.sourcePath,
          sourceLicense: meta.sourceLicense,
          srdVersion: meta.srdVersion,
          srdLicense: meta.srdLicense,
          seededAt: now()
        }
      })
      .run()
  })
}
