import type { DatasetMeta } from '../schema.ts'

/** The pinned upstream release. Bump it with the vendored files under `vendor/5e-database`. */
export const PINNED_TAG = 'v5.12.0'

export const DATASET_META: DatasetMeta = {
  datasetVersion: PINNED_TAG.replace(/^v/, ''),
  sourceTag: PINNED_TAG,
  sourceRepository: 'https://github.com/5e-bits/5e-database',
  sourcePath: 'src/2014/en',
  sourceLicense: 'MIT',
  srdVersion: '5.1',
  srdLicense: 'CC-BY-4.0'
}

/** The vendored upstream files the normalizer reads, by the name the normalizer uses. */
export const UPSTREAM_FILES = {
  abilities: '5e-SRD-Ability-Scores.json',
  alignments: '5e-SRD-Alignments.json',
  backgrounds: '5e-SRD-Backgrounds.json',
  classes: '5e-SRD-Classes.json',
  damageTypes: '5e-SRD-Damage-Types.json',
  equipmentCategories: '5e-SRD-Equipment-Categories.json',
  equipment: '5e-SRD-Equipment.json',
  features: '5e-SRD-Features.json',
  languages: '5e-SRD-Languages.json',
  levels: '5e-SRD-Levels.json',
  magicSchools: '5e-SRD-Magic-Schools.json',
  proficiencies: '5e-SRD-Proficiencies.json',
  races: '5e-SRD-Races.json',
  skills: '5e-SRD-Skills.json',
  spells: '5e-SRD-Spells.json',
  subclasses: '5e-SRD-Subclasses.json',
  subraces: '5e-SRD-Subraces.json',
  traits: '5e-SRD-Traits.json',
  weaponProperties: '5e-SRD-Weapon-Properties.json'
} as const
