import { z } from 'zod'

/**
 * The normalized Rules Data format: what the build-time normalizer writes to
 * `src/lib/rules/data/*.json`, what the seed reads, and what the app's own data (ability score
 * methods, the custom background) is authored in. Everything is keyed by a stable slug (the
 * upstream `index`); cross-references are slugs, never URLs. Pure: no database or server imports.
 */

export const slug = z.string().regex(/^[a-z0-9]+(?:-+[a-z0-9]+)*$/, 'must be a slug')
const text = z.string()
const lines = z.array(z.string())
const int = z.number().int()
const nullableText = z.string().nullable()
const nullableInt = int.nullable()

/** Arbitrary upstream JSON kept as-is where no rule has needed it as columns yet. */
export const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue)
  ])
)
const nullableJson = jsonValue.nullable()

// --- Choices ------------------------------------------------------------------------------------

/** What a choice group picks: the kind decides which `OptionItem` types its options hold. */
export const CHOICE_KINDS = ['proficiency', 'language', 'abilityBonus', 'equipment'] as const
/** Entities that own choice groups. */
export const CHOICE_OWNER_TYPES = ['class', 'race', 'trait', 'background'] as const

/**
 * One thing an option hands out. A wildcard such as "any martial melee weapon" is an
 * `equipmentCategory` item: the player picks `count` items out of the category.
 */
export const optionItem = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('proficiency'), proficiency: slug }),
  z.strictObject({ type: z.literal('language'), language: slug }),
  z.strictObject({ type: z.literal('abilityBonus'), ability: slug, bonus: int }),
  z.strictObject({
    type: z.literal('equipment'),
    equipment: slug,
    count: int,
    /** The option is only usable while proficient with this (Cleric "if proficient"). */
    requiresProficiency: slug.nullable()
  }),
  z.strictObject({
    type: z.literal('equipmentCategory'),
    category: slug,
    count: int
  })
])
export type OptionItem = z.infer<typeof optionItem>

/** A selectable bundle: choosing the option grants all of its items. */
export const choiceOption = z.strictObject({ items: z.array(optionItem).min(1) })

/** "Choose `choose` of these options". Flat: nested upstream choices are folded in. */
export const choiceGroup = z.strictObject({
  /** Unique within its owner; the full key is `${ownerType}/${ownerSlug}/${key}`. */
  key: z.string().regex(/^[a-zA-Z]+-\d+$/),
  kind: z.enum(CHOICE_KINDS),
  choose: int.positive(),
  description: nullableText,
  options: z.array(choiceOption).min(1)
})
export type ChoiceGroup = z.infer<typeof choiceGroup>

const withChoices = { choiceGroups: z.array(choiceGroup) }

// --- Reference tables ---------------------------------------------------------------------------

export const ability = z.strictObject({
  slug,
  name: text,
  fullName: text,
  description: lines
})
export const skill = z.strictObject({ slug, name: text, ability: slug, description: lines })
export const language = z.strictObject({
  slug,
  name: text,
  type: text,
  script: nullableText,
  typicalSpeakers: lines,
  description: nullableText
})
export const alignment = z.strictObject({
  slug,
  name: text,
  abbreviation: text,
  description: text
})
export const damageType = z.strictObject({ slug, name: text, description: lines })
export const magicSchool = z.strictObject({ slug, name: text, description: text })
export const weaponProperty = z.strictObject({ slug, name: text, description: lines })

export const PROFICIENCY_REFERENCE_TYPES = [
  'equipment',
  'equipment-category',
  'skill',
  'ability'
] as const
export const proficiency = z.strictObject({
  slug,
  name: text,
  type: text,
  reference: z.strictObject({ type: z.enum(PROFICIENCY_REFERENCE_TYPES), slug }).nullable()
})

// --- Equipment ----------------------------------------------------------------------------------

export const equipmentCategory = z.strictObject({
  slug,
  name: text,
  /** Member item slugs, sorted. */
  items: z.array(slug)
})

const damage = z.strictObject({ dice: text, type: slug })
const range = z.strictObject({ normal: int, long: nullableInt })

export const equipment = z.strictObject({
  slug,
  name: text,
  category: slug,
  gearCategory: slug.nullable(),
  description: lines,
  costQuantity: z.number(),
  costUnit: text,
  weight: z.number().nullable(),
  // Weapons
  weaponCategory: nullableText,
  weaponRange: nullableText,
  categoryRange: nullableText,
  damage: damage.nullable(),
  twoHandedDamage: damage.nullable(),
  range: range.nullable(),
  throwRange: range.nullable(),
  properties: z.array(slug),
  special: lines,
  // Armor
  armorCategory: nullableText,
  armorClassBase: nullableInt,
  armorClassDexBonus: z.boolean().nullable(),
  armorClassMaxBonus: nullableInt,
  strMinimum: nullableInt,
  stealthDisadvantage: z.boolean().nullable(),
  // Tools, vehicles, packs
  toolCategory: nullableText,
  vehicleCategory: nullableText,
  speedQuantity: z.number().nullable(),
  speedUnit: nullableText,
  capacity: nullableText,
  /** Items bundled into a pack. */
  contents: z.array(z.strictObject({ item: slug, quantity: int })),
  /** Units per purchase (arrows come 20 to a quiver). */
  quantity: nullableInt
})

// --- Races, subraces, traits --------------------------------------------------------------------

const abilityBonus = z.strictObject({ ability: slug, bonus: int })

export const trait = z.strictObject({
  slug,
  name: text,
  description: lines,
  parent: slug.nullable(),
  /** Proficiencies the trait grants outright. */
  proficiencies: z.array(slug),
  /** Upstream `trait_specific` (spell options, ancestry, breath weapon...) kept as JSON. */
  specific: nullableJson,
  ...withChoices
})

export const race = z.strictObject({
  slug,
  name: text,
  speed: int,
  size: text,
  sizeDescription: text,
  age: text,
  alignment: text,
  languageDescription: text,
  abilityBonuses: z.array(abilityBonus),
  languages: z.array(slug),
  traits: z.array(slug),
  ...withChoices
})

export const subrace = z.strictObject({
  slug,
  name: text,
  race: slug,
  description: text,
  abilityBonuses: z.array(abilityBonus),
  traits: z.array(slug)
})

// --- Classes ------------------------------------------------------------------------------------

export const classSpellcasting = z.strictObject({
  level: int,
  ability: slug,
  info: z.array(z.strictObject({ name: text, description: lines }))
})

export const classEntity = z.strictObject({
  slug,
  name: text,
  hitDie: int,
  savingThrows: z.array(slug),
  proficiencies: z.array(slug),
  startingEquipment: z.array(z.strictObject({ item: slug, quantity: int })),
  spellcasting: classSpellcasting.nullable(),
  ...withChoices
})

/** Spell slots by spell level 1 to 9, as `[level1, ..., level9]`. */
const levelSpellcasting = z.strictObject({
  cantripsKnown: nullableInt,
  spellsKnown: nullableInt,
  slots: z.array(int).length(9)
})

export const classLevel = z.strictObject({
  class: slug,
  level: int.min(1).max(20),
  abilityScoreBonuses: int,
  proficiencyBonus: int,
  features: z.array(slug),
  spellcasting: levelSpellcasting.nullable(),
  classSpecific: nullableJson
})

export const subclass = z.strictObject({
  slug,
  name: text,
  class: slug,
  flavor: text,
  description: lines,
  /** Spells the subclass always has (domain spells), from `minClassLevel`. */
  spells: z.array(z.strictObject({ spell: slug, minClassLevel: int }))
})

export const subclassLevel = z.strictObject({
  subclass: slug,
  level: int.min(1).max(20),
  features: z.array(slug),
  subclassSpecific: nullableJson
})

export const feature = z.strictObject({
  slug,
  name: text,
  class: slug,
  subclass: slug.nullable(),
  level: int.min(1).max(20),
  description: lines,
  parent: slug.nullable(),
  /** Upstream `reference` (e.g. a class's spellcasting path), kept as-is. */
  reference: nullableText,
  /** Upstream `feature_specific` (expertise options, invocations...) kept as JSON. */
  specific: nullableJson
})

// --- Spells -------------------------------------------------------------------------------------

export const spell = z.strictObject({
  slug,
  name: text,
  level: int.min(0).max(9),
  school: slug,
  description: lines,
  higherLevel: lines,
  range: text,
  components: z.array(text),
  material: nullableText,
  ritual: z.boolean(),
  concentration: z.boolean(),
  duration: text,
  castingTime: text,
  attackType: nullableText,
  dc: z.strictObject({ ability: slug, success: text, description: nullableText }).nullable(),
  areaOfEffect: z.strictObject({ type: text, size: int }).nullable(),
  /** Damage by slot or character level, upstream shape kept as JSON. */
  damage: nullableJson,
  healAtSlotLevel: nullableJson,
  classes: z.array(slug)
})

// --- Backgrounds --------------------------------------------------------------------------------

export const BACKGROUND_OPTION_KINDS = ['personalityTrait', 'ideal', 'bond', 'flaw'] as const

export const background = z.strictObject({
  slug,
  name: text,
  /** True for rules the app defines itself because the SRD is silent. */
  appAuthored: z.boolean(),
  description: nullableText,
  feature: z.strictObject({ name: text, description: lines }).nullable(),
  proficiencies: z.array(slug),
  startingEquipment: z.array(z.strictObject({ item: slug, quantity: int })),
  startingGoldQuantity: z.number().nullable(),
  startingGoldUnit: nullableText,
  /** The SRD personality, ideal, bond and flaw tables. */
  options: z.array(
    z.strictObject({
      kind: z.enum(BACKGROUND_OPTION_KINDS),
      text,
      alignments: z.array(slug)
    })
  ),
  ...withChoices
})

// --- App-authored rules -------------------------------------------------------------------------

/**
 * Ability score methods are PHB mechanics the SRD leaves out, so they are defined here, not
 * imported. Their configuration is data: the repository returns it and code reads the numbers.
 */
export const abilityScoreMethod = z.strictObject({
  slug,
  name: text,
  description: text,
  appAuthored: z.literal(true),
  config: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('standardArray'), values: z.array(int).length(6) }),
    z.strictObject({
      type: z.literal('pointBuy'),
      budget: int,
      min: int,
      max: int,
      /** Point cost by base score, e.g. `{ "8": 0, "15": 9 }`. */
      costs: z.record(z.string(), int)
    }),
    z.strictObject({
      type: z.literal('roll'),
      count: int,
      dice: int,
      sides: int,
      dropLowest: int
    })
  ])
})

// --- The dataset --------------------------------------------------------------------------------

export const datasetMeta = z.strictObject({
  /** The pinned 5e-bits release, without the leading "v": the dataset version shown in credits. */
  datasetVersion: text,
  sourceTag: text,
  sourceRepository: text,
  sourcePath: text,
  sourceLicense: z.literal('MIT'),
  srdVersion: z.literal('5.1'),
  srdLicense: z.literal('CC-BY-4.0')
})

export const rulesDataset = z.strictObject({
  meta: datasetMeta,
  abilities: z.array(ability),
  skills: z.array(skill),
  languages: z.array(language),
  alignments: z.array(alignment),
  damageTypes: z.array(damageType),
  magicSchools: z.array(magicSchool),
  weaponProperties: z.array(weaponProperty),
  proficiencies: z.array(proficiency),
  equipmentCategories: z.array(equipmentCategory),
  equipment: z.array(equipment),
  traits: z.array(trait),
  races: z.array(race),
  subraces: z.array(subrace),
  classes: z.array(classEntity),
  classLevels: z.array(classLevel),
  subclasses: z.array(subclass),
  subclassLevels: z.array(subclassLevel),
  features: z.array(feature),
  spells: z.array(spell),
  backgrounds: z.array(background),
  abilityScoreMethods: z.array(abilityScoreMethod)
})

export type RulesDataset = z.infer<typeof rulesDataset>
export type DatasetMeta = z.infer<typeof datasetMeta>
export type Ability = z.infer<typeof ability>
export type Skill = z.infer<typeof skill>
export type Language = z.infer<typeof language>
export type Alignment = z.infer<typeof alignment>
export type Proficiency = z.infer<typeof proficiency>
export type EquipmentCategory = z.infer<typeof equipmentCategory>
export type Equipment = z.infer<typeof equipment>
export type Trait = z.infer<typeof trait>
export type Race = z.infer<typeof race>
export type Subrace = z.infer<typeof subrace>
export type ClassEntity = z.infer<typeof classEntity>
export type ClassLevel = z.infer<typeof classLevel>
export type Subclass = z.infer<typeof subclass>
export type SubclassLevel = z.infer<typeof subclassLevel>
export type Feature = z.infer<typeof feature>
export type Spell = z.infer<typeof spell>
export type Background = z.infer<typeof background>
export type AbilityScoreMethod = z.infer<typeof abilityScoreMethod>

/** Dataset collections other than `meta`, each one a committed JSON file `data/<name>.json`. */
export const COLLECTIONS = [
  'abilities',
  'skills',
  'languages',
  'alignments',
  'damageTypes',
  'magicSchools',
  'weaponProperties',
  'proficiencies',
  'equipmentCategories',
  'equipment',
  'traits',
  'races',
  'subraces',
  'classes',
  'classLevels',
  'subclasses',
  'subclassLevels',
  'features',
  'spells',
  'backgrounds',
  'abilityScoreMethods'
] as const satisfies readonly (keyof RulesDataset)[]
