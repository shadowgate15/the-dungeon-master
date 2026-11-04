import { z } from 'zod'
import { slug } from './schema.ts'

/**
 * The hand-written overlay (#96): choice groups and fixed grants the upstream dataset leaves as
 * prose or buries in free-form JSON. Every entry cites the SRD 5.1 page it comes from. It is
 * committed code, validated by zod when this module loads, and the resolver merges it with the
 * choice groups carried by the Rules Data. Pure: no database or server imports.
 *
 * A group's full key is `${ownerType}/${ownerSlug}/${key}`, the stable handle stored as
 * `character_choice.choice_key`.
 */

export const OVERLAY_OWNER_TYPES = ['class', 'race', 'trait', 'subclass', 'background'] as const

const overlayOption = z.strictObject({
  slug,
  name: z.string(),
  /** Extra facts about the option, for the resolver and derived stats (dragon damage type). */
  data: z.record(z.string(), z.string()).optional()
})
export type OverlayOption = z.infer<typeof overlayOption>

/** Where a group's options come from. Computed sources are resolved against the Rules Data. */
const overlayOptions = z.discriminatedUnion('from', [
  z.strictObject({ from: z.literal('literal'), options: z.array(overlayOption).min(1) }),
  /** The subclasses of the owning class. */
  z.strictObject({ from: z.literal('subclasses') }),
  /** Every race, for Ranger favored enemy "humanoids". */
  z.strictObject({ from: z.literal('races') }),
  /** Standard languages the Character does not already have. */
  z.strictObject({ from: z.literal('standardLanguages') }),
  /** Wizard cantrips (High Elf). */
  z.strictObject({ from: z.literal('wizardCantrips') }),
  /** The Character's proficient skills, plus thieves' tools (Rogue expertise). */
  z.strictObject({ from: z.literal('expertise') }),
  /** Every skill proficiency (Custom background). */
  z.strictObject({ from: z.literal('skills') }),
  /** Tool proficiencies plus Standard languages, one pool (Custom background). */
  z.strictObject({ from: z.literal('toolsAndLanguages') })
])

export const OVERLAY_KINDS = [
  'skill',
  'toolOrLanguage',
  'feature',
  'creatureType',
  'terrain',
  'dragonType',
  'race',
  'language',
  'spell',
  'expertise',
  'subclass'
] as const

export const overlayGroup = z.strictObject({
  ownerType: z.enum(OVERLAY_OWNER_TYPES),
  ownerSlug: slug,
  key: z.string().regex(/^[a-zA-Z]+-\d+$/),
  kind: z.enum(OVERLAY_KINDS),
  choose: z.number().int().positive(),
  description: z.string(),
  /** SRD 5.1 page citation. */
  source: z.string().regex(/^SRD p\.\d+(-\d+)?$/),
  options: overlayOptions,
  /** The group only exists while another group has this option picked. */
  requires: z.strictObject({ group: z.string(), option: slug }).optional()
})
export type OverlayGroup = z.infer<typeof overlayGroup>

/** Fixed grants the dataset does not encode as data. */
export const overlayGrant = z.strictObject({
  ownerType: z.enum(OVERLAY_OWNER_TYPES),
  ownerSlug: slug,
  source: z.string().regex(/^SRD p\.\d+(-\d+)?$/),
  proficiencies: z.array(slug).default([]),
  languages: z.array(slug).default([]),
  /** Damage type slugs. */
  resistances: z.array(slug).default([]),
  /** Spell slugs the Character always has. */
  spells: z.array(slug).default([])
})
export type OverlayGrant = z.infer<typeof overlayGrant>

/** SRD p.5-6 Draconic Ancestry table (also the Sorcerer Dragon Ancestor table, p.45). */
export const DRAGON_TYPES = [
  { slug: 'black', name: 'Black', damageType: 'acid', breath: 'line 5 by 30 ft', save: 'dex' },
  { slug: 'blue', name: 'Blue', damageType: 'lightning', breath: 'line 5 by 30 ft', save: 'dex' },
  { slug: 'brass', name: 'Brass', damageType: 'fire', breath: 'line 5 by 30 ft', save: 'dex' },
  {
    slug: 'bronze',
    name: 'Bronze',
    damageType: 'lightning',
    breath: 'line 5 by 30 ft',
    save: 'dex'
  },
  { slug: 'copper', name: 'Copper', damageType: 'acid', breath: 'line 5 by 30 ft', save: 'dex' },
  { slug: 'gold', name: 'Gold', damageType: 'fire', breath: 'cone 15 ft', save: 'dex' },
  { slug: 'green', name: 'Green', damageType: 'poison', breath: 'cone 15 ft', save: 'con' },
  { slug: 'red', name: 'Red', damageType: 'fire', breath: 'cone 15 ft', save: 'dex' },
  { slug: 'silver', name: 'Silver', damageType: 'cold', breath: 'cone 15 ft', save: 'con' },
  { slug: 'white', name: 'White', damageType: 'cold', breath: 'cone 15 ft', save: 'con' }
] as const

const dragonOptions = DRAGON_TYPES.map((d) => ({
  slug: d.slug,
  name: d.name,
  data: { damageType: d.damageType, breath: d.breath, save: d.save }
}))

const literal = (options: OverlayOption[]) => ({ from: 'literal' as const, options })

const FAVORED_ENEMY = 'class/ranger/favoredEnemy-0'

const rawGroups: OverlayGroup[] = [
  // Subclass choosers at level 1 (SRD pp.15, 42, 46). One option each, so Concept auto-selects.
  {
    ownerType: 'class',
    ownerSlug: 'cleric',
    key: 'subclass-0',
    kind: 'subclass',
    choose: 1,
    description: 'Divine Domain',
    source: 'SRD p.15',
    options: { from: 'subclasses' }
  },
  {
    ownerType: 'class',
    ownerSlug: 'sorcerer',
    key: 'subclass-0',
    kind: 'subclass',
    choose: 1,
    description: 'Sorcerous Origin',
    source: 'SRD p.42',
    options: { from: 'subclasses' }
  },
  {
    ownerType: 'class',
    ownerSlug: 'warlock',
    key: 'subclass-0',
    kind: 'subclass',
    choose: 1,
    description: 'Otherworldly Patron',
    source: 'SRD p.46',
    options: { from: 'subclasses' }
  },
  // Custom background (SRD p.60): two skills and two tools or languages. The Rules Data row has no
  // choice groups of its own, so they live here.
  {
    ownerType: 'background',
    ownerSlug: 'custom',
    key: 'skills-0',
    kind: 'skill',
    choose: 2,
    description: 'Custom background: two skill proficiencies',
    source: 'SRD p.60',
    options: { from: 'skills' }
  },
  {
    ownerType: 'background',
    ownerSlug: 'custom',
    key: 'toolsOrLanguages-0',
    kind: 'toolOrLanguage',
    choose: 2,
    description: 'Custom background: two tool proficiencies or languages',
    source: 'SRD p.60',
    options: { from: 'toolsAndLanguages' }
  },
  // Fighter (SRD p.24).
  {
    ownerType: 'class',
    ownerSlug: 'fighter',
    key: 'fightingStyle-0',
    kind: 'feature',
    choose: 1,
    description: 'Fighting Style',
    source: 'SRD p.24',
    options: literal([
      { slug: 'fighter-fighting-style-archery', name: 'Archery' },
      { slug: 'fighter-fighting-style-defense', name: 'Defense' },
      { slug: 'fighter-fighting-style-dueling', name: 'Dueling' },
      { slug: 'fighter-fighting-style-great-weapon-fighting', name: 'Great Weapon Fighting' },
      { slug: 'fighter-fighting-style-protection', name: 'Protection' },
      { slug: 'fighter-fighting-style-two-weapon-fighting', name: 'Two-Weapon Fighting' }
    ])
  },
  // Rogue (SRD p.39): two skills, or one skill and thieves' tools. Options are computed.
  {
    ownerType: 'class',
    ownerSlug: 'rogue',
    key: 'expertise-0',
    kind: 'expertise',
    choose: 2,
    description: "Expertise: two proficient skills, or one skill and thieves' tools",
    source: 'SRD p.39',
    options: { from: 'expertise' }
  },
  // Ranger (SRD pp.35-36).
  {
    ownerType: 'class',
    ownerSlug: 'ranger',
    key: 'favoredEnemy-0',
    kind: 'creatureType',
    choose: 1,
    description: 'Favored Enemy: a creature type, or humanoids (then two races)',
    source: 'SRD p.35',
    options: literal(
      [
        'aberrations',
        'beasts',
        'celestials',
        'constructs',
        'dragons',
        'elementals',
        'fey',
        'fiends',
        'giants',
        'monstrosities',
        'oozes',
        'plants',
        'undead',
        'humanoids'
      ].map((s) => ({ slug: s, name: s[0].toUpperCase() + s.slice(1) }))
    )
  },
  {
    ownerType: 'class',
    ownerSlug: 'ranger',
    key: 'favoredEnemyRaces-0',
    kind: 'race',
    choose: 2,
    description: 'Favored Enemy: the two humanoid races',
    source: 'SRD p.35',
    options: { from: 'races' },
    requires: { group: FAVORED_ENEMY, option: 'humanoids' }
  },
  {
    ownerType: 'class',
    ownerSlug: 'ranger',
    key: 'favoredEnemyLanguage-0',
    kind: 'language',
    choose: 1,
    description: 'Favored Enemy: one language spoken by your favored enemies',
    source: 'SRD p.35',
    options: { from: 'standardLanguages' }
  },
  {
    ownerType: 'class',
    ownerSlug: 'ranger',
    key: 'favoredTerrain-0',
    kind: 'terrain',
    choose: 1,
    description: 'Natural Explorer: favored terrain',
    source: 'SRD p.35',
    options: literal(
      ['arctic', 'coast', 'desert', 'forest', 'grassland', 'mountain', 'swamp'].map((s) => ({
        slug: s,
        name: s[0].toUpperCase() + s.slice(1)
      }))
    )
  },
  // Dragonborn (SRD pp.5-6) and the Draconic Sorcerer (SRD p.45): same list, separate groups.
  {
    ownerType: 'trait',
    ownerSlug: 'draconic-ancestry',
    key: 'dragonType-0',
    kind: 'dragonType',
    choose: 1,
    description: 'Draconic Ancestry',
    source: 'SRD p.5-6',
    options: literal(dragonOptions)
  },
  {
    ownerType: 'subclass',
    ownerSlug: 'draconic',
    key: 'dragonType-0',
    kind: 'dragonType',
    choose: 1,
    description: 'Dragon Ancestor',
    source: 'SRD p.45',
    options: literal(dragonOptions)
  },
  // High Elf (SRD p.4): a wizard cantrip. Counted and stored by the spell step (#97).
  {
    ownerType: 'trait',
    ownerSlug: 'high-elf-cantrip',
    key: 'cantrip-0',
    kind: 'spell',
    choose: 1,
    description: 'One wizard cantrip',
    source: 'SRD p.4',
    options: { from: 'wizardCantrips' }
  }
]

export const OVERLAY_GROUPS: readonly OverlayGroup[] = z.array(overlayGroup).parse(rawGroups)

export const OVERLAY_GRANTS: readonly OverlayGrant[] = z.array(overlayGrant).parse([
  {
    ownerType: 'trait',
    ownerSlug: 'dwarven-resilience',
    source: 'SRD p.3',
    resistances: ['poison']
  },
  { ownerType: 'trait', ownerSlug: 'hellish-resistance', source: 'SRD p.7', resistances: ['fire'] },
  { ownerType: 'trait', ownerSlug: 'infernal-legacy', source: 'SRD p.7', spells: ['thaumaturgy'] },
  { ownerType: 'subclass', ownerSlug: 'life', source: 'SRD p.17', proficiencies: ['heavy-armor'] },
  { ownerType: 'subclass', ownerSlug: 'draconic', source: 'SRD p.45', languages: ['draconic'] }
])

/** The stable handle for a choice group: `${ownerType}/${ownerSlug}/${key}`. */
export const choiceKey = (ownerType: string, ownerSlug: string, key: string) =>
  `${ownerType}/${ownerSlug}/${key}`
