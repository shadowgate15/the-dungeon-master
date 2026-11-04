/* eslint-disable @typescript-eslint/no-explicit-any --
   Upstream JSON is untyped and polymorphic. The zod schema is the contract: `normalize` output is
   parsed against it (see run.ts and the normalizer tests), so loose input types stop here. */
import { ABILITY_SCORE_METHODS, CUSTOM_BACKGROUND } from '../app-authored.ts'
import type { Background, ChoiceGroup, OptionItem, RulesDataset, Spell, Trait } from '../schema.ts'
import { DATASET_META, type UPSTREAM_FILES } from './source.ts'

export type Upstream = Record<keyof typeof UPSTREAM_FILES, any[]>

/** Upstream cross-reference `{ index, name, url }` to its slug. */
const ref = (r: any): string => r.index
const uniqueBy = <T>(rows: T[], key: (row: T) => string): T[] => [
  ...new Map(rows.map((r) => [key(r), r])).values()
]
const refs = (list: any[] | undefined): string[] => (list ?? []).map(ref)
const lines = (v: string[] | undefined): string[] => v ?? []
const bySlug = <T extends { slug: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))

/** Upstream JSON kept as data: `{index,name,url}` references collapse to their index. */
function cleanJson(value: any): any {
  if (Array.isArray(value)) return value.map(cleanJson)
  if (value && typeof value === 'object') {
    if (typeof value.index === 'string' && typeof value.url === 'string') return value.index
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanJson(v)]))
  }
  return value
}
const json = (v: any) => (v === undefined ? null : cleanJson(v))

// --- Choices ------------------------------------------------------------------------------------

type Kind = ChoiceGroup['kind']

function equipmentItem(o: any): OptionItem {
  return {
    type: 'equipment',
    equipment: ref(o.of),
    count: o.count,
    requiresProficiency: o.prerequisites?.length
      ? ref(o.prerequisites.find((p: any) => p.type === 'proficiency').proficiency)
      : null
  }
}

/** One upstream option becomes one or more flat options. */
function convertOption(o: any, kind: Kind, parentChoose: number, languages: string[]) {
  switch (o.option_type) {
    case 'reference':
      return [
        {
          items: [
            kind === 'language'
              ? ({ type: 'language', language: ref(o.item) } as const)
              : ({ type: 'proficiency', proficiency: ref(o.item) } as const)
          ]
        }
      ]
    case 'ability_bonus':
      return [
        {
          items: [{ type: 'abilityBonus', ability: ref(o.ability_score), bonus: o.bonus } as const]
        }
      ]
    case 'counted_reference':
      return [{ items: [equipmentItem(o)] }]
    case 'multiple':
      return [
        {
          items: o.items.map((i: any): OptionItem => {
            if (i.option_type === 'counted_reference') return equipmentItem(i)
            return categoryItem(i.choice)
          })
        }
      ]
    case 'choice': {
      const c = o.choice
      if (c.from.option_set_type === 'equipment_category') return [{ items: [categoryItem(c)] }]
      // A nested list of proficiencies (Monk: artisan's tools or a musical instrument) is the
      // same pick as taking those proficiencies directly, so fold it into the parent.
      if (parentChoose !== 1 || c.choose !== 1) throw new Error('Unexpected nested choice')
      return c.from.options.flatMap((n: any) => convertOption(n, kind, 1, languages))
    }
    default:
      throw new Error(`Unknown option type: ${o.option_type}`)
  }
}

function categoryItem(c: any): OptionItem {
  return { type: 'equipmentCategory', category: ref(c.from.equipment_category), count: c.choose }
}

function convertGroup(raw: any, kind: Kind, n: number, languages: string[]): ChoiceGroup {
  const set = raw.from.option_set_type
  if (set === 'equipment_category') {
    return {
      key: `${kind}-${n}`,
      kind,
      choose: 1,
      description: raw.desc ?? null,
      options: [{ items: [categoryItem(raw)] }]
    }
  }
  if (set === 'resource_list') {
    if (raw.from.resource_list_url !== '/api/2014/languages')
      throw new Error('Unknown resource list')
    return {
      key: `${kind}-${n}`,
      kind,
      choose: raw.choose,
      description: raw.desc ?? null,
      options: languages.map((language) => ({ items: [{ type: 'language', language }] }))
    }
  }
  return {
    key: `${kind}-${n}`,
    kind,
    choose: raw.choose,
    description: raw.desc ?? null,
    options: raw.from.options.flatMap((o: any) => convertOption(o, kind, raw.choose, languages))
  }
}

/** Converts several upstream sources into one owner's groups, numbered per kind. */
function groupsFor(sources: [Kind, any[] | undefined][], languages: string[]): ChoiceGroup[] {
  return sources.flatMap(([kind, list]) =>
    (list ?? []).map((raw, n) => convertGroup(raw, kind, n, languages))
  )
}

// --- Normalizers --------------------------------------------------------------------------------

const referenceType: Record<string, 'equipment' | 'equipment-category' | 'skill' | 'ability'> = {
  equipment: 'equipment',
  'equipment-categories': 'equipment-category',
  skills: 'skill',
  'ability-scores': 'ability'
}

function proficiencyReference(r: any) {
  if (!r) return null
  const [, , , collection, index] = r.url.split('/')
  const type = referenceType[collection]
  if (!type) throw new Error(`Unknown proficiency reference: ${r.url}`)
  return { type, slug: index as string }
}

function cost(e: any) {
  return { costQuantity: e.cost.quantity, costUnit: e.cost.unit }
}

const damage = (d: any) => (d ? { dice: d.damage_dice, type: ref(d.damage_type) } : null)
const range = (r: any) => (r ? { normal: r.normal, long: r.long ?? null } : null)

function backgroundOptions(b: any): Background['options'] {
  const out: Background['options'] = []
  const add = (kind: Background['options'][number]['kind'], table: any) => {
    for (const o of table.from.options) {
      out.push({
        kind,
        text: o.option_type === 'ideal' ? o.desc : o.string,
        alignments: refs(o.alignments)
      })
    }
  }
  add('personalityTrait', b.personality_traits)
  add('ideal', b.ideals)
  add('bond', b.bonds)
  add('flaw', b.flaws)
  return out
}

function spellcastingByLevel(l: any) {
  const s = l.spellcasting
  if (!s) return null
  return {
    cantripsKnown: s.cantrips_known ?? null,
    spellsKnown: s.spells_known ?? null,
    slots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => s[`spell_slots_level_${n}`] ?? 0)
  }
}

export function normalize(up: Upstream): RulesDataset {
  const languageSlugs = up.languages.map(ref)
  const equipmentSlugs = new Set(up.equipment.map(ref))

  const traits: Trait[] = up.traits.map((t) => ({
    slug: t.index,
    name: t.name,
    description: lines(t.desc),
    parent: t.parent ? ref(t.parent) : null,
    proficiencies: refs(t.proficiencies),
    specific: json(t.trait_specific),
    choiceGroups: groupsFor(
      [
        ['proficiency', t.proficiency_choices && [t.proficiency_choices]],
        ['language', t.language_options && [t.language_options]]
      ],
      languageSlugs
    )
  }))

  const spells: Spell[] = up.spells.map((s) => ({
    slug: s.index,
    name: s.name,
    level: s.level,
    school: ref(s.school),
    description: lines(s.desc),
    higherLevel: lines(s.higher_level),
    range: s.range,
    components: s.components,
    material: s.material ?? null,
    ritual: s.ritual,
    concentration: s.concentration,
    duration: s.duration,
    castingTime: s.casting_time,
    attackType: s.attack_type ?? null,
    dc: s.dc
      ? { ability: ref(s.dc.dc_type), success: s.dc.dc_success, description: s.dc.desc ?? null }
      : null,
    areaOfEffect: s.area_of_effect
      ? { type: s.area_of_effect.type, size: s.area_of_effect.size }
      : null,
    damage: json(s.damage),
    healAtSlotLevel: json(s.heal_at_slot_level),
    classes: refs(s.classes).sort()
  }))

  const acolyte: Background[] = up.backgrounds.map((b) => ({
    slug: b.index,
    name: b.name,
    appAuthored: false,
    description: null,
    feature: { name: b.feature.name, description: lines(b.feature.desc) },
    proficiencies: refs(b.starting_proficiencies),
    startingEquipment: b.starting_equipment.map((e: any) => ({
      item: ref(e.equipment),
      quantity: e.quantity
    })),
    startingGoldQuantity: b.starting_gold?.quantity ?? null,
    startingGoldUnit: b.starting_gold?.unit ?? null,
    options: backgroundOptions(b),
    choiceGroups: groupsFor(
      [
        ['language', b.language_options && [b.language_options]],
        ['equipment', b.starting_equipment_options]
      ],
      languageSlugs
    )
  }))

  // Subclass levels carry a `subclass`; the rest are class levels. A level's spellcasting is only
  // present for casters.
  const classLevels = up.levels
    .filter((l) => !l.subclass)
    .map((l) => ({
      class: ref(l.class),
      level: l.level,
      abilityScoreBonuses: l.ability_score_bonuses ?? 0,
      proficiencyBonus: l.prof_bonus ?? 0,
      features: refs(l.features),
      spellcasting: spellcastingByLevel(l),
      classSpecific: json(l.class_specific)
    }))
    .sort((a, b) => (a.class === b.class ? a.level - b.level : a.class < b.class ? -1 : 1))

  const subclassLevels = up.levels
    .filter((l) => l.subclass)
    .map((l) => ({
      subclass: ref(l.subclass),
      level: l.level,
      features: refs(l.features),
      subclassSpecific: json(l.subclass_specific)
    }))
    .sort((a, b) =>
      a.subclass === b.subclass ? a.level - b.level : a.subclass < b.subclass ? -1 : 1
    )

  return {
    meta: DATASET_META,
    abilities: bySlug(
      up.abilities.map((a) => ({
        slug: a.index,
        name: a.name,
        fullName: a.full_name,
        description: lines(a.desc)
      }))
    ),
    skills: bySlug(
      up.skills.map((s) => ({
        slug: s.index,
        name: s.name,
        ability: ref(s.ability_score),
        description: lines(s.desc)
      }))
    ),
    languages: bySlug(
      up.languages.map((l) => ({
        slug: l.index,
        name: l.name,
        type: l.type,
        script: l.script ?? null,
        typicalSpeakers: lines(l.typical_speakers),
        description: l.desc ?? null
      }))
    ),
    alignments: bySlug(
      up.alignments.map((a) => ({
        slug: a.index,
        name: a.name,
        abbreviation: a.abbreviation,
        description: a.desc
      }))
    ),
    damageTypes: bySlug(
      up.damageTypes.map((d) => ({ slug: d.index, name: d.name, description: lines(d.desc) }))
    ),
    magicSchools: bySlug(
      up.magicSchools.map((m) => ({ slug: m.index, name: m.name, description: m.desc }))
    ),
    weaponProperties: bySlug(
      up.weaponProperties.map((w) => ({ slug: w.index, name: w.name, description: lines(w.desc) }))
    ),
    proficiencies: bySlug(
      up.proficiencies.map((p) => ({
        slug: p.index,
        name: p.name,
        type: p.type,
        reference: proficiencyReference(p.reference)
      }))
    ),
    equipmentCategories: bySlug(
      up.equipmentCategories.map((c) => ({
        slug: c.index,
        name: c.name,
        // Upstream categories also list magic items, which are not part of this dataset yet.
        items: [...new Set(refs(c.equipment).filter((i) => equipmentSlugs.has(i)))].sort()
      }))
    ),
    equipment: bySlug(
      up.equipment.map((e) => ({
        slug: e.index,
        name: e.name,
        category: ref(e.equipment_category),
        gearCategory: e.gear_category ? ref(e.gear_category) : null,
        description: lines(e.desc),
        ...cost(e),
        weight: e.weight ?? null,
        weaponCategory: e.weapon_category ?? null,
        weaponRange: e.weapon_range ?? null,
        categoryRange: e.category_range ?? null,
        damage: damage(e.damage),
        twoHandedDamage: damage(e.two_handed_damage),
        range: range(e.range),
        throwRange: range(e.throw_range),
        properties: refs(e.properties),
        special: lines(e.special),
        armorCategory: e.armor_category ?? null,
        armorClassBase: e.armor_class?.base ?? null,
        armorClassDexBonus: e.armor_class?.dex_bonus ?? null,
        armorClassMaxBonus: e.armor_class?.max_bonus ?? null,
        strMinimum: e.str_minimum ?? null,
        stealthDisadvantage: e.stealth_disadvantage ?? null,
        toolCategory: e.tool_category ?? null,
        vehicleCategory: e.vehicle_category ?? null,
        speedQuantity: e.speed?.quantity ?? null,
        speedUnit: e.speed?.unit ?? null,
        capacity: e.capacity ?? null,
        contents: (e.contents ?? []).map((c: any) => ({ item: ref(c.item), quantity: c.quantity })),
        quantity: e.quantity ?? null
      }))
    ),
    traits: bySlug(traits),
    races: bySlug(
      up.races.map((r) => ({
        slug: r.index,
        name: r.name,
        speed: r.speed,
        size: r.size,
        sizeDescription: r.size_description,
        age: r.age,
        alignment: r.alignment,
        languageDescription: r.language_desc,
        abilityBonuses: r.ability_bonuses.map((b: any) => ({
          ability: ref(b.ability_score),
          bonus: b.bonus
        })),
        languages: refs(r.languages),
        traits: refs(r.traits),
        choiceGroups: groupsFor(
          [
            ['language', r.language_options && [r.language_options]],
            ['abilityBonus', r.ability_bonus_options && [r.ability_bonus_options]]
          ],
          languageSlugs
        )
      }))
    ),
    subraces: bySlug(
      up.subraces.map((s) => ({
        slug: s.index,
        name: s.name,
        race: ref(s.race),
        description: s.desc,
        abilityBonuses: s.ability_bonuses.map((b: any) => ({
          ability: ref(b.ability_score),
          bonus: b.bonus
        })),
        traits: refs(s.racial_traits)
      }))
    ),
    classes: bySlug(
      up.classes.map((c) => ({
        slug: c.index,
        name: c.name,
        hitDie: c.hit_die,
        savingThrows: refs(c.saving_throws),
        proficiencies: refs(c.proficiencies),
        startingEquipment: c.starting_equipment.map((e: any) => ({
          item: ref(e.equipment),
          quantity: e.quantity
        })),
        spellcasting: c.spellcasting
          ? {
              level: c.spellcasting.level,
              ability: ref(c.spellcasting.spellcasting_ability),
              info: c.spellcasting.info.map((i: any) => ({
                name: i.name,
                description: lines(i.desc)
              }))
            }
          : null,
        choiceGroups: groupsFor(
          [
            ['proficiency', c.proficiency_choices],
            ['equipment', c.starting_equipment_options]
          ],
          languageSlugs
        )
      }))
    ),
    classLevels,
    subclasses: bySlug(
      up.subclasses.map((s) => ({
        slug: s.index,
        name: s.name,
        class: ref(s.class),
        flavor: s.subclass_flavor,
        description: lines(s.desc),
        // Upstream repeats a Circle of the Land spell once for each terrain that grants it.
        spells: uniqueBy(
          (s.spells ?? []).map((x: any) => {
            const level = x.prerequisites.find((p: any) => p.type === 'level')
            if (!level)
              throw new Error(`Subclass spell without a level: ${s.index}/${ref(x.spell)}`)
            return { spell: ref(x.spell), minClassLevel: Number(level.index.split('-').pop()) }
          }),
          (x) => `${x.spell}@${x.minClassLevel}`
        )
      }))
    ),
    subclassLevels,
    features: bySlug(
      up.features.map((f) => ({
        slug: f.index,
        name: f.name,
        class: ref(f.class),
        subclass: f.subclass ? ref(f.subclass) : null,
        level: f.level,
        description: lines(f.desc),
        parent: f.parent ? ref(f.parent) : null,
        reference: f.reference ?? null,
        specific: json(f.feature_specific)
      }))
    ),
    spells: bySlug(spells),
    backgrounds: bySlug([...acolyte, CUSTOM_BACKGROUND]),
    abilityScoreMethods: ABILITY_SCORE_METHODS
  }
}
