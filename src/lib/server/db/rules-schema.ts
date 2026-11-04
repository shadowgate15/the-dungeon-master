import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique
} from 'drizzle-orm/sqlite-core'
import {
  BACKGROUND_OPTION_KINDS,
  CHOICE_KINDS,
  CHOICE_OWNER_TYPES,
  PROFICIENCY_REFERENCE_TYPES,
  type AbilityScoreMethod
} from '../../rules/schema'

/**
 * Rules Data: the SRD 5.1 reference content, read-only to the app and seeded from the committed
 * JSON by `seedRulesData`. Rows are keyed by a stable `slug` and have integer primary keys that
 * Characters reference. Reseeding upserts on slug and never deletes or renumbers those rows, so
 * every table here that a Character can point at is an "entity" table with a unique slug;
 * join and choice tables are replaced wholesale on reseed.
 */

const id = () => integer('id').primaryKey({ autoIncrement: true })
const slug = () => text('slug').notNull().unique()
const lines = (name: string) => text(name, { mode: 'json' }).$type<string[]>().notNull()
const bool = (name: string) => integer(name, { mode: 'boolean' })
const entityRef = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).notNull().references(target, { onDelete: 'restrict' })
const optionalRef = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).references(target, { onDelete: 'restrict' })
const ownedBy = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).notNull().references(target, { onDelete: 'cascade' })
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(', ')})`)

/** One row recording which dataset is seeded, shown on the credits page. */
export const rulesDataset = sqliteTable('rules_dataset', {
  id: integer('id').primaryKey(),
  datasetVersion: text('dataset_version').notNull(),
  sourceTag: text('source_tag').notNull(),
  sourceRepository: text('source_repository').notNull(),
  sourcePath: text('source_path').notNull(),
  sourceLicense: text('source_license').notNull(),
  srdVersion: text('srd_version').notNull(),
  srdLicense: text('srd_license').notNull(),
  seededAt: integer('seeded_at').notNull()
})

// --- Reference tables ---------------------------------------------------------------------------

export const ability = sqliteTable('ability', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: lines('description')
})

export const skill = sqliteTable('skill', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  abilityId: entityRef('ability_id', () => ability.id),
  description: lines('description')
})

export const language = sqliteTable('language', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  script: text('script'),
  typicalSpeakers: lines('typical_speakers'),
  description: text('description')
})

export const alignment = sqliteTable('alignment', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  description: text('description').notNull()
})

export const damageType = sqliteTable('damage_type', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  description: lines('description')
})

export const magicSchool = sqliteTable('magic_school', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  description: text('description').notNull()
})

export const weaponProperty = sqliteTable('weapon_property', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  description: lines('description')
})

/** `referenceSlug` points into the table named by `referenceType` (a soft reference). */
export const proficiency = sqliteTable('proficiency', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  referenceType: text('reference_type', { enum: PROFICIENCY_REFERENCE_TYPES }),
  referenceSlug: text('reference_slug')
})

// --- Equipment ----------------------------------------------------------------------------------

export const equipmentCategory = sqliteTable('equipment_category', {
  id: id(),
  slug: slug(),
  name: text('name').notNull()
})

export const equipment = sqliteTable('equipment', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  categoryId: entityRef('category_id', () => equipmentCategory.id),
  gearCategoryId: optionalRef('gear_category_id', () => equipmentCategory.id),
  description: lines('description'),
  costQuantity: real('cost_quantity').notNull(),
  costUnit: text('cost_unit').notNull(),
  weight: real('weight'),
  weaponCategory: text('weapon_category'),
  weaponRange: text('weapon_range'),
  categoryRange: text('category_range'),
  damageDice: text('damage_dice'),
  damageTypeId: optionalRef('damage_type_id', () => damageType.id),
  twoHandedDamageDice: text('two_handed_damage_dice'),
  twoHandedDamageTypeId: optionalRef('two_handed_damage_type_id', () => damageType.id),
  rangeNormal: integer('range_normal'),
  rangeLong: integer('range_long'),
  throwRangeNormal: integer('throw_range_normal'),
  throwRangeLong: integer('throw_range_long'),
  special: lines('special'),
  armorCategory: text('armor_category'),
  armorClassBase: integer('armor_class_base'),
  armorClassDexBonus: bool('armor_class_dex_bonus'),
  armorClassMaxBonus: integer('armor_class_max_bonus'),
  strMinimum: integer('str_minimum'),
  stealthDisadvantage: bool('stealth_disadvantage'),
  toolCategory: text('tool_category'),
  vehicleCategory: text('vehicle_category'),
  speedQuantity: real('speed_quantity'),
  speedUnit: text('speed_unit'),
  capacity: text('capacity'),
  quantity: integer('quantity')
})

export const equipmentCategoryItem = sqliteTable(
  'equipment_category_item',
  {
    categoryId: ownedBy('category_id', () => equipmentCategory.id),
    equipmentId: ownedBy('equipment_id', () => equipment.id)
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.equipmentId] })]
)

export const equipmentWeaponProperty = sqliteTable(
  'equipment_weapon_property',
  {
    equipmentId: ownedBy('equipment_id', () => equipment.id),
    propertyId: ownedBy('property_id', () => weaponProperty.id)
  },
  (t) => [primaryKey({ columns: [t.equipmentId, t.propertyId] })]
)

/** Items bundled into a pack. */
export const equipmentContent = sqliteTable(
  'equipment_content',
  {
    packId: ownedBy('pack_id', () => equipment.id),
    itemId: entityRef('item_id', () => equipment.id),
    quantity: integer('quantity').notNull()
  },
  (t) => [primaryKey({ columns: [t.packId, t.itemId] })]
)

// --- Races, subraces, traits --------------------------------------------------------------------

export const trait = sqliteTable('trait', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  description: lines('description'),
  parentId: optionalRef('parent_id', (): AnySQLiteColumn => trait.id),
  specific: text('specific', { mode: 'json' }).$type<unknown>()
})

export const traitProficiency = sqliteTable(
  'trait_proficiency',
  {
    traitId: ownedBy('trait_id', () => trait.id),
    proficiencyId: entityRef('proficiency_id', () => proficiency.id)
  },
  (t) => [primaryKey({ columns: [t.traitId, t.proficiencyId] })]
)

export const race = sqliteTable('race', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  speed: integer('speed').notNull(),
  size: text('size').notNull(),
  sizeDescription: text('size_description').notNull(),
  age: text('age').notNull(),
  alignment: text('alignment').notNull(),
  languageDescription: text('language_description').notNull()
})

export const raceAbilityBonus = sqliteTable(
  'race_ability_bonus',
  {
    raceId: ownedBy('race_id', () => race.id),
    abilityId: entityRef('ability_id', () => ability.id),
    bonus: integer('bonus').notNull()
  },
  (t) => [primaryKey({ columns: [t.raceId, t.abilityId] })]
)

export const raceLanguage = sqliteTable(
  'race_language',
  {
    raceId: ownedBy('race_id', () => race.id),
    languageId: entityRef('language_id', () => language.id)
  },
  (t) => [primaryKey({ columns: [t.raceId, t.languageId] })]
)

export const raceTrait = sqliteTable(
  'race_trait',
  {
    raceId: ownedBy('race_id', () => race.id),
    traitId: entityRef('trait_id', () => trait.id)
  },
  (t) => [primaryKey({ columns: [t.raceId, t.traitId] })]
)

export const subrace = sqliteTable('subrace', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  raceId: entityRef('race_id', () => race.id),
  description: text('description').notNull()
})

export const subraceAbilityBonus = sqliteTable(
  'subrace_ability_bonus',
  {
    subraceId: ownedBy('subrace_id', () => subrace.id),
    abilityId: entityRef('ability_id', () => ability.id),
    bonus: integer('bonus').notNull()
  },
  (t) => [primaryKey({ columns: [t.subraceId, t.abilityId] })]
)

export const subraceTrait = sqliteTable(
  'subrace_trait',
  {
    subraceId: ownedBy('subrace_id', () => subrace.id),
    traitId: entityRef('trait_id', () => trait.id)
  },
  (t) => [primaryKey({ columns: [t.subraceId, t.traitId] })]
)

// --- Classes ------------------------------------------------------------------------------------

export const classTable = sqliteTable('class', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  hitDie: integer('hit_die').notNull(),
  spellcastingLevel: integer('spellcasting_level'),
  spellcastingAbilityId: optionalRef('spellcasting_ability_id', () => ability.id),
  spellcastingInfo: text('spellcasting_info', { mode: 'json' }).$type<
    { name: string; description: string[] }[]
  >()
})

export const classSavingThrow = sqliteTable(
  'class_saving_throw',
  {
    classId: ownedBy('class_id', () => classTable.id),
    abilityId: entityRef('ability_id', () => ability.id)
  },
  (t) => [primaryKey({ columns: [t.classId, t.abilityId] })]
)

export const classProficiency = sqliteTable(
  'class_proficiency',
  {
    classId: ownedBy('class_id', () => classTable.id),
    proficiencyId: entityRef('proficiency_id', () => proficiency.id)
  },
  (t) => [primaryKey({ columns: [t.classId, t.proficiencyId] })]
)

export const classStartingEquipment = sqliteTable(
  'class_starting_equipment',
  {
    classId: ownedBy('class_id', () => classTable.id),
    itemId: entityRef('item_id', () => equipment.id),
    quantity: integer('quantity').notNull()
  },
  (t) => [primaryKey({ columns: [t.classId, t.itemId] })]
)

export const subclass = sqliteTable('subclass', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  classId: entityRef('class_id', () => classTable.id),
  flavor: text('flavor').notNull(),
  description: lines('description')
})

export const feature = sqliteTable(
  'feature',
  {
    id: id(),
    slug: slug(),
    name: text('name').notNull(),
    classId: entityRef('class_id', () => classTable.id),
    subclassId: optionalRef('subclass_id', () => subclass.id),
    level: integer('level').notNull(),
    description: lines('description'),
    parentId: optionalRef('parent_id', (): AnySQLiteColumn => feature.id),
    reference: text('reference'),
    specific: text('specific', { mode: 'json' }).$type<unknown>()
  },
  (t) => [index('feature_class_level_idx').on(t.classId, t.level)]
)

export const classLevel = sqliteTable(
  'class_level',
  {
    id: id(),
    classId: ownedBy('class_id', () => classTable.id),
    level: integer('level').notNull(),
    abilityScoreBonuses: integer('ability_score_bonuses').notNull(),
    proficiencyBonus: integer('proficiency_bonus').notNull(),
    cantripsKnown: integer('cantrips_known'),
    spellsKnown: integer('spells_known'),
    slotsLevel1: integer('slots_level_1'),
    slotsLevel2: integer('slots_level_2'),
    slotsLevel3: integer('slots_level_3'),
    slotsLevel4: integer('slots_level_4'),
    slotsLevel5: integer('slots_level_5'),
    slotsLevel6: integer('slots_level_6'),
    slotsLevel7: integer('slots_level_7'),
    slotsLevel8: integer('slots_level_8'),
    slotsLevel9: integer('slots_level_9'),
    classSpecific: text('class_specific', { mode: 'json' }).$type<unknown>()
  },
  (t) => [unique('class_level_class_level_unique').on(t.classId, t.level)]
)

export const classLevelFeature = sqliteTable(
  'class_level_feature',
  {
    classLevelId: ownedBy('class_level_id', () => classLevel.id),
    featureId: entityRef('feature_id', () => feature.id)
  },
  (t) => [primaryKey({ columns: [t.classLevelId, t.featureId] })]
)

export const subclassLevel = sqliteTable(
  'subclass_level',
  {
    id: id(),
    subclassId: ownedBy('subclass_id', () => subclass.id),
    level: integer('level').notNull(),
    subclassSpecific: text('subclass_specific', { mode: 'json' }).$type<unknown>()
  },
  (t) => [unique('subclass_level_subclass_level_unique').on(t.subclassId, t.level)]
)

export const subclassLevelFeature = sqliteTable(
  'subclass_level_feature',
  {
    subclassLevelId: ownedBy('subclass_level_id', () => subclassLevel.id),
    featureId: entityRef('feature_id', () => feature.id)
  },
  (t) => [primaryKey({ columns: [t.subclassLevelId, t.featureId] })]
)

// --- Spells -------------------------------------------------------------------------------------

export const spell = sqliteTable(
  'spell',
  {
    id: id(),
    slug: slug(),
    name: text('name').notNull(),
    level: integer('level').notNull(),
    schoolId: entityRef('school_id', () => magicSchool.id),
    description: lines('description'),
    higherLevel: lines('higher_level'),
    range: text('range').notNull(),
    components: lines('components'),
    material: text('material'),
    ritual: bool('ritual').notNull(),
    concentration: bool('concentration').notNull(),
    duration: text('duration').notNull(),
    castingTime: text('casting_time').notNull(),
    attackType: text('attack_type'),
    dcAbilityId: optionalRef('dc_ability_id', () => ability.id),
    dcSuccess: text('dc_success'),
    dcDescription: text('dc_description'),
    areaType: text('area_type'),
    areaSize: integer('area_size'),
    damage: text('damage', { mode: 'json' }).$type<unknown>(),
    healAtSlotLevel: text('heal_at_slot_level', { mode: 'json' }).$type<unknown>()
  },
  (t) => [index('spell_level_idx').on(t.level)]
)

export const spellClass = sqliteTable(
  'spell_class',
  {
    spellId: ownedBy('spell_id', () => spell.id),
    classId: entityRef('class_id', () => classTable.id)
  },
  (t) => [
    primaryKey({ columns: [t.spellId, t.classId] }),
    index('spell_class_class_idx').on(t.classId)
  ]
)

/** Spells a subclass always has (domain spells) from `minClassLevel`. */
export const subclassSpell = sqliteTable(
  'subclass_spell',
  {
    subclassId: ownedBy('subclass_id', () => subclass.id),
    spellId: entityRef('spell_id', () => spell.id),
    minClassLevel: integer('min_class_level').notNull()
  },
  (t) => [primaryKey({ columns: [t.subclassId, t.spellId] })]
)

// --- Backgrounds --------------------------------------------------------------------------------

export const background = sqliteTable('background', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  appAuthored: bool('app_authored').notNull(),
  description: text('description'),
  featureName: text('feature_name'),
  featureDescription: text('feature_description', { mode: 'json' }).$type<string[]>(),
  startingGoldQuantity: real('starting_gold_quantity'),
  startingGoldUnit: text('starting_gold_unit')
})

export const backgroundProficiency = sqliteTable(
  'background_proficiency',
  {
    backgroundId: ownedBy('background_id', () => background.id),
    proficiencyId: entityRef('proficiency_id', () => proficiency.id)
  },
  (t) => [primaryKey({ columns: [t.backgroundId, t.proficiencyId] })]
)

export const backgroundEquipment = sqliteTable(
  'background_equipment',
  {
    backgroundId: ownedBy('background_id', () => background.id),
    itemId: entityRef('item_id', () => equipment.id),
    quantity: integer('quantity').notNull()
  },
  (t) => [primaryKey({ columns: [t.backgroundId, t.itemId] })]
)

/** The SRD personality trait, ideal, bond and flaw tables, in table order. */
export const backgroundOption = sqliteTable(
  'background_option',
  {
    id: id(),
    backgroundId: ownedBy('background_id', () => background.id),
    kind: text('kind', { enum: BACKGROUND_OPTION_KINDS }).notNull(),
    position: integer('position').notNull(),
    text: text('text').notNull()
  },
  (t) => [unique('background_option_position_unique').on(t.backgroundId, t.kind, t.position)]
)

export const backgroundOptionAlignment = sqliteTable(
  'background_option_alignment',
  {
    optionId: ownedBy('option_id', () => backgroundOption.id),
    alignmentId: entityRef('alignment_id', () => alignment.id)
  },
  (t) => [primaryKey({ columns: [t.optionId, t.alignmentId] })]
)

// --- App-authored rules -------------------------------------------------------------------------

export const abilityScoreMethod = sqliteTable('ability_score_method', {
  id: id(),
  slug: slug(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  appAuthored: bool('app_authored').notNull(),
  config: text('config', { mode: 'json' }).$type<AbilityScoreMethod['config']>().notNull()
})

// --- Choices ------------------------------------------------------------------------------------

/**
 * "Choose `choose` of these options" attached to a class, race, trait or background. The unique
 * `key` is `${ownerType}/${ownerSlug}/${group key}`, the stable handle a Character's saved
 * choices will use. Owners are soft references by slug: groups hang off four different tables.
 */
export const choiceGroup = sqliteTable(
  'choice_group',
  {
    id: id(),
    key: text('key').notNull().unique(),
    ownerType: text('owner_type', { enum: CHOICE_OWNER_TYPES }).notNull(),
    ownerSlug: text('owner_slug').notNull(),
    kind: text('kind', { enum: CHOICE_KINDS }).notNull(),
    choose: integer('choose').notNull(),
    description: text('description')
  },
  (t) => [index('choice_group_owner_idx').on(t.ownerType, t.ownerSlug)]
)

/** A selectable bundle of items, in upstream order. */
export const choiceOption = sqliteTable(
  'choice_option',
  {
    id: id(),
    groupId: ownedBy('group_id', () => choiceGroup.id),
    position: integer('position').notNull()
  },
  (t) => [unique('choice_option_position_unique').on(t.groupId, t.position)]
)

const ITEM_TYPES = [
  'proficiency',
  'language',
  'abilityBonus',
  'equipment',
  'equipmentCategory'
] as const

/**
 * One item of an option, with exactly one of the typed references set. `count` is the quantity
 * of an equipment item, or how many to pick for an equipment category wildcard.
 */
export const choiceOptionItem = sqliteTable(
  'choice_option_item',
  {
    id: id(),
    optionId: ownedBy('option_id', () => choiceOption.id),
    position: integer('position').notNull(),
    itemType: text('item_type', { enum: ITEM_TYPES }).notNull(),
    proficiencyId: optionalRef('proficiency_id', () => proficiency.id),
    languageId: optionalRef('language_id', () => language.id),
    abilityId: optionalRef('ability_id', () => ability.id),
    bonus: integer('bonus'),
    equipmentId: optionalRef('equipment_id', () => equipment.id),
    equipmentCategoryId: optionalRef('equipment_category_id', () => equipmentCategory.id),
    count: integer('count'),
    requiresProficiencyId: optionalRef('requires_proficiency_id', () => proficiency.id)
  },
  (t) => [
    unique('choice_option_item_position_unique').on(t.optionId, t.position),
    check('choice_option_item_type_check', inList('item_type', ITEM_TYPES))
  ]
)
