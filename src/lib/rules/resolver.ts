import { OVERLAY_GRANTS, OVERLAY_GROUPS, choiceKey, type OverlayGroup } from './overlay.ts'
import type { ChoiceGroup, RulesDataset } from './schema.ts'

/**
 * The feature resolver (#96, #104). One pure function turns a Character draft (the structural picks
 * plus every Feature choice) and plain Rules Data into a resolved feature set: fixed grants, choice
 * groups with their legal options and validity, and the active feature slugs the code registry
 * keys on. The wizard, derived stats (#105) and spell/equipment selection (#97) all consume it.
 * Pure: no database or server imports; it works on plain objects, so rows from the repository fit.
 */

/** The Rules Data collections the resolver reads. */
export type ResolverRules = Pick<
  RulesDataset,
  | 'races'
  | 'subraces'
  | 'classes'
  | 'classLevels'
  | 'subclasses'
  | 'subclassLevels'
  | 'traits'
  | 'features'
  | 'backgrounds'
  | 'languages'
  | 'proficiencies'
  | 'spells'
>

/** What the resolver needs from a Character draft. All slugs; `picks` is keyed by choice key. */
export interface ResolverDraft {
  race: string | null
  subrace: string | null
  class: string | null
  subclass: string | null
  background: string | null
  /**
   * Feature choices: full choice key to the picked option slugs. Skill picks use the group's
   * proficiency slugs (`skill-arcana`); the service maps them to `character_skill` by source.
   * The subclass chooser is not a pick: it is `subclass` above.
   */
  picks: Record<string, string[]>
}

/** Where a grant or group comes from, matching `character_skill.source` / `character_spell.source`. */
export type GrantSource = 'race' | 'class' | 'background'

export type GroupKind =
  | 'skill'
  | 'tool'
  | 'toolOrLanguage'
  | 'language'
  | 'abilityBonus'
  | 'feature'
  | 'creatureType'
  | 'terrain'
  | 'dragonType'
  | 'race'
  | 'spell'
  | 'expertise'
  | 'subclass'

export type OptionDisabled = 'granted' | 'chosen-elsewhere'

export interface ResolvedOption {
  /** What is stored as `character_choice.option_slug`. */
  slug: string
  name: string
  /** Set when the player may not pick it: already granted, or chosen in another group. */
  disabled: OptionDisabled | null
  /** Extra facts (dragon damage type, breath weapon). */
  data?: Record<string, string>
}

export type GroupIssue =
  | { type: 'unknown-option'; slug: string }
  | { type: 'duplicate'; slug: string }
  | { type: 'conflict'; slug: string; with: 'granted' | string }
  | { type: 'excess' }
  | { type: 'too-many-tools' }

export interface ResolvedGroup {
  /** The stable handle: `${ownerType}/${ownerSlug}/${groupKey}`. */
  key: string
  ownerType: 'class' | 'race' | 'trait' | 'background' | 'subclass'
  ownerSlug: string
  groupKey: string
  kind: GroupKind
  /** Which part of the Character this belongs to, for grouping and for storage. */
  source: GrantSource
  description: string | null
  /** SRD page for overlay groups. */
  citation: string | null
  choose: number
  options: ResolvedOption[]
  /** The picks as given. */
  picks: string[]
  /** The only option, when there is exactly one (subclass chooser). */
  autoSelect: string | null
  /** valid: complete and legal; incomplete: fewer picks than `choose`; attention: a pick is illegal. */
  status: 'valid' | 'incomplete' | 'attention'
  issues: GroupIssue[]
}

export interface ResolvedProficiency {
  slug: string
  name: string
  /** The Rules Data type: Armor, Weapons, Skills, Saving Throws, Artisan's Tools, ... */
  type: string
  source: GrantSource
  via: 'fixed' | 'choice'
  choiceKey: string | null
}

export interface ResolvedLanguage {
  slug: string
  name: string
  source: GrantSource
  via: 'fixed' | 'choice'
  choiceKey: string | null
}

export interface ResolvedSkill {
  /** Skill slug, e.g. `arcana`. */
  skill: string
  /** Proficiency slug, e.g. `skill-arcana`. */
  proficiency: string
  source: GrantSource
  expertise: boolean
}

export interface ResolvedAbilityBonus {
  ability: string
  bonus: number
  source: 'race' | 'subrace'
  via: 'fixed' | 'choice'
}

export interface ResolvedFeature {
  slug: string
  name: string
  source: 'race' | 'subrace' | 'class' | 'subclass' | 'background'
}

export interface GrantedSpell {
  spell: string
  level: number
  source: 'race' | 'subclass'
}

export interface StructuralIssue {
  field: 'race' | 'subrace' | 'class' | 'subclass' | 'background'
  type: 'missing' | 'unknown' | 'mismatch' | 'not-available'
}

export interface OrphanPick {
  key: string
  slugs: string[]
}

export interface ResolvedFeatures {
  /** True when the structure is complete and every group is valid. */
  valid: boolean
  structure: StructuralIssue[]
  groups: ResolvedGroup[]
  /** Picks whose group does not exist (anymore) for this draft. Never a crash: surface them. */
  orphanPicks: OrphanPick[]
  abilityBonuses: ResolvedAbilityBonus[]
  /** Racial bonus per ability slug, summed. */
  abilityBonusTotals: Record<string, number>
  speed: number | null
  hitDie: number | null
  /** Saving throw ability slugs from the class. */
  savingThrows: string[]
  proficiencies: ResolvedProficiency[]
  /** Proficiencies with Expertise (skills and tools): slugs. */
  expertise: string[]
  skills: ResolvedSkill[]
  languages: ResolvedLanguage[]
  /** Damage type slugs. */
  resistances: string[]
  /** Spells always known or prepared; read-only for the player. Picks live in `groups`. */
  grantedSpells: GrantedSpell[]
  features: ResolvedFeature[]
  /** Feature, trait and chosen-option slugs in effect; the code registry keys on these. */
  activeFeatureSlugs: string[]
}

const STRUCTURAL = ['race', 'subrace', 'class', 'subclass', 'background'] as const

/** Proficiency types that are not tools (everything else, vehicles and kits included, is). */
const NON_TOOL_TYPES = new Set(['Skills', 'Armor', 'Weapons', 'Saving Throws'])

const byKey = <T extends { slug: string }>(rows: readonly T[]) =>
  new Map(rows.map((r) => [r.slug, r]))

interface RawGroup {
  key: string
  ownerType: ResolvedGroup['ownerType']
  ownerSlug: string
  groupKey: string
  kind: GroupKind
  source: GrantSource
  description: string | null
  citation: string | null
  choose: number
  options: Omit<ResolvedOption, 'disabled'>[]
  requires?: { group: string; option: string }
}

export function resolveFeatures(rules: ResolverRules, draft: ResolverDraft): ResolvedFeatures {
  const races = byKey(rules.races)
  const subraces = byKey(rules.subraces)
  const classes = byKey(rules.classes)
  const subclasses = byKey(rules.subclasses)
  const backgrounds = byKey(rules.backgrounds)
  const traits = byKey(rules.traits)
  const features = byKey(rules.features)
  const languages = byKey(rules.languages)
  const proficiencies = byKey(rules.proficiencies)
  const spells = byKey(rules.spells)

  const race = draft.race ? races.get(draft.race) : undefined
  const subrace = draft.subrace ? subraces.get(draft.subrace) : undefined
  const cls = draft.class ? classes.get(draft.class) : undefined
  const subclass = draft.subclass ? subclasses.get(draft.subclass) : undefined
  const background = draft.background ? backgrounds.get(draft.background) : undefined

  // --- Structure ----------------------------------------------------------------------------
  const structure: StructuralIssue[] = []
  const known = { race, subrace, class: cls, subclass, background }
  for (const field of STRUCTURAL) {
    if (draft[field] && !known[field]) structure.push({ field, type: 'unknown' })
  }
  if (!draft.race) structure.push({ field: 'race', type: 'missing' })
  if (!draft.class) structure.push({ field: 'class', type: 'missing' })
  if (!draft.background) structure.push({ field: 'background', type: 'missing' })
  if (race && !subrace && !draft.subrace && rules.subraces.some((s) => s.race === race.slug)) {
    structure.push({ field: 'subrace', type: 'missing' })
  }
  if (subrace && race && subrace.race !== race.slug) {
    structure.push({ field: 'subrace', type: 'mismatch' })
  }
  const subclassGroup = cls
    ? OVERLAY_GROUPS.find(
        (g) => g.ownerType === 'class' && g.ownerSlug === cls.slug && g.kind === 'subclass'
      )
    : undefined
  if (subclass) {
    if (cls && subclass.class !== cls.slug) structure.push({ field: 'subclass', type: 'mismatch' })
    else if (cls && !subclassGroup) structure.push({ field: 'subclass', type: 'not-available' })
  } else if (subclassGroup && !draft.subclass) {
    structure.push({ field: 'subclass', type: 'missing' })
  }
  // A mismatched subrace or subclass grants nothing.
  const activeSubrace = subrace && race && subrace.race === race.slug ? subrace : undefined
  const activeSubclass =
    subclass && cls && subclass.class === cls.slug && subclassGroup ? subclass : undefined

  // --- Fixed grants -------------------------------------------------------------------------
  const abilityBonuses: ResolvedAbilityBonus[] = []
  const proficiencyList: ResolvedProficiency[] = []
  const languageList: ResolvedLanguage[] = []
  const resistances = new Set<string>()
  const grantedSpells: GrantedSpell[] = []
  const featureList: ResolvedFeature[] = []
  const active = new Set<string>()

  const addProficiency = (
    slug: string,
    source: GrantSource,
    via: 'fixed' | 'choice',
    key: string | null
  ) => {
    if (proficiencyList.some((p) => p.slug === slug)) return
    const p = proficiencies.get(slug)
    proficiencyList.push({
      slug,
      name: p?.name ?? slug,
      type: p?.type ?? 'Other',
      source,
      via,
      choiceKey: key
    })
  }
  const addLanguage = (
    slug: string,
    source: GrantSource,
    via: 'fixed' | 'choice',
    key: string | null
  ) => {
    if (languageList.some((l) => l.slug === slug)) return
    languageList.push({
      slug,
      name: languages.get(slug)?.name ?? slug,
      source,
      via,
      choiceKey: key
    })
  }
  const addSpell = (spell: string, source: GrantedSpell['source']) => {
    if (grantedSpells.some((s) => s.spell === spell)) return
    grantedSpells.push({ spell, level: spells.get(spell)?.level ?? 0, source })
  }
  const applyOverlayGrants = (
    ownerType: OverlayGroup['ownerType'],
    ownerSlug: string,
    source: GrantSource,
    spellSource: GrantedSpell['source']
  ) => {
    for (const g of OVERLAY_GRANTS) {
      if (g.ownerType !== ownerType || g.ownerSlug !== ownerSlug) continue
      g.proficiencies.forEach((p) => addProficiency(p, source, 'fixed', null))
      g.languages.forEach((l) => addLanguage(l, source, 'fixed', null))
      g.resistances.forEach((r) => resistances.add(r))
      g.spells.forEach((s) => addSpell(s, spellSource))
    }
  }

  const rawGroups: RawGroup[] = []
  const sourceOfTrait = new Map<string, GrantSource>()

  const dataGroups = (
    ownerType: 'class' | 'race' | 'trait' | 'background',
    ownerSlug: string,
    groups: ChoiceGroup[],
    source: GrantSource
  ) => {
    for (const g of groups) {
      if (g.kind === 'equipment') continue // Equipment choice groups belong to the equipment step (#97).
      const options = g.options.map((o, i) => {
        const item = o.items[0]
        if (o.items.length === 1 && item.type === 'proficiency') {
          return {
            slug: item.proficiency,
            name: proficiencies.get(item.proficiency)?.name ?? item.proficiency
          }
        }
        if (o.items.length === 1 && item.type === 'language') {
          return { slug: item.language, name: languages.get(item.language)?.name ?? item.language }
        }
        if (o.items.length === 1 && item.type === 'abilityBonus') {
          return { slug: item.ability, name: `${item.ability.toUpperCase()} +${item.bonus}` }
        }
        return { slug: `option-${i}`, name: `Option ${i + 1}` }
      })
      let kind: GroupKind
      let finalOptions = options
      if (g.kind === 'language') {
        kind = 'language'
        // Player picks are Standard languages only (#96).
        finalOptions = options.filter((o) => languages.get(o.slug)?.type === 'Standard')
      } else if (g.kind === 'abilityBonus') {
        kind = 'abilityBonus'
      } else {
        const allSkills = options.every((o) => proficiencies.get(o.slug)?.type === 'Skills')
        kind = allSkills ? 'skill' : 'tool'
      }
      rawGroups.push({
        key: choiceKey(ownerType, ownerSlug, g.key),
        ownerType,
        ownerSlug,
        groupKey: g.key,
        kind,
        source,
        description: g.description,
        citation: null,
        choose: g.choose,
        options: finalOptions
      })
    }
  }

  const overlayGroups = (
    ownerType: OverlayGroup['ownerType'],
    ownerSlug: string,
    source: GrantSource
  ) => {
    for (const g of OVERLAY_GROUPS) {
      if (g.ownerType !== ownerType || g.ownerSlug !== ownerSlug) continue
      let options: Omit<ResolvedOption, 'disabled'>[] = []
      switch (g.options.from) {
        case 'literal':
          options = g.options.options.map((o) => ({ slug: o.slug, name: o.name, data: o.data }))
          break
        case 'subclasses':
          options = rules.subclasses
            .filter((s) => s.class === ownerSlug)
            .map((s) => ({ slug: s.slug, name: s.name }))
          break
        case 'races':
          options = rules.races.map((r) => ({ slug: r.slug, name: r.name }))
          break
        case 'standardLanguages':
          options = rules.languages
            .filter((l) => l.type === 'Standard')
            .map((l) => ({ slug: l.slug, name: l.name }))
          break
        case 'wizardCantrips':
          options = rules.spells
            .filter((s) => s.level === 0 && s.classes.includes('wizard'))
            .map((s) => ({ slug: s.slug, name: s.name }))
          break
        case 'expertise':
          options = [] // Computed once every other group is resolved.
          break
        case 'skills':
          options = rules.proficiencies
            .filter((p) => p.type === 'Skills')
            .map((p) => ({ slug: p.slug, name: p.name }))
          break
        case 'toolsAndLanguages':
          options = [
            ...rules.proficiencies.filter((p) => !NON_TOOL_TYPES.has(p.type)),
            ...rules.languages.filter((l) => l.type === 'Standard')
          ].map((o) => ({ slug: o.slug, name: o.name }))
          break
      }
      rawGroups.push({
        key: choiceKey(g.ownerType, g.ownerSlug, g.key),
        ownerType: g.ownerType,
        ownerSlug: g.ownerSlug,
        groupKey: g.key,
        kind: g.kind === 'language' ? 'language' : (g.kind as GroupKind),
        source,
        description: g.description,
        citation: g.source,
        choose: g.choose,
        options,
        requires: g.requires
      })
    }
  }

  const applyTrait = (
    slug: string,
    source: GrantSource,
    featureSource: ResolvedFeature['source']
  ) => {
    const trait = traits.get(slug)
    if (!trait) return
    sourceOfTrait.set(slug, source)
    active.add(slug)
    featureList.push({ slug, name: trait.name, source: featureSource })
    trait.proficiencies.forEach((p) => addProficiency(p, source, 'fixed', null))
    applyOverlayGrants('trait', slug, source, 'race')
    dataGroups('trait', slug, trait.choiceGroups, source)
    overlayGroups('trait', slug, source)
  }

  if (race) {
    for (const a of race.abilityBonuses) {
      abilityBonuses.push({ ability: a.ability, bonus: a.bonus, source: 'race', via: 'fixed' })
    }
    race.languages.forEach((l) => addLanguage(l, 'race', 'fixed', null))
    dataGroups('race', race.slug, race.choiceGroups, 'race')
    race.traits.forEach((t) => applyTrait(t, 'race', 'race'))
  }
  if (activeSubrace) {
    for (const a of activeSubrace.abilityBonuses) {
      abilityBonuses.push({ ability: a.ability, bonus: a.bonus, source: 'subrace', via: 'fixed' })
    }
    activeSubrace.traits.forEach((t) => applyTrait(t, 'race', 'subrace'))
  }

  if (cls) {
    cls.proficiencies.forEach((p) => addProficiency(p, 'class', 'fixed', null))
    dataGroups('class', cls.slug, cls.choiceGroups, 'class')
    overlayGroups('class', cls.slug, 'class')
    const levelOne = rules.classLevels.find((l) => l.class === cls.slug && l.level === 1)
    for (const slug of levelOne?.features ?? []) {
      const f = features.get(slug)
      if (!f) continue
      active.add(slug)
      featureList.push({ slug, name: f.name, source: 'class' })
    }
  }
  if (activeSubclass) {
    applyOverlayGrants('subclass', activeSubclass.slug, 'class', 'subclass')
    overlayGroups('subclass', activeSubclass.slug, 'class')
    const levelOne = rules.subclassLevels.find(
      (l) => l.subclass === activeSubclass.slug && l.level === 1
    )
    for (const slug of levelOne?.features ?? []) {
      const f = features.get(slug)
      if (!f) continue
      active.add(slug)
      featureList.push({ slug, name: f.name, source: 'subclass' })
    }
    for (const s of activeSubclass.spells) {
      if (s.minClassLevel <= 1) addSpell(s.spell, 'subclass')
    }
  }
  if (background) {
    background.proficiencies.forEach((p) => addProficiency(p, 'background', 'fixed', null))
    dataGroups('background', background.slug, background.choiceGroups, 'background')
    overlayGroups('background', background.slug, 'background')
    if (background.feature) {
      featureList.push({
        slug: background.slug,
        name: background.feature.name,
        source: 'background'
      })
    }
  }

  // --- Choice groups ------------------------------------------------------------------------
  const picksOf = (key: string): string[] => draft.picks[key] ?? []
  const subclassKey = cls && subclassGroup ? choiceKey('class', cls.slug, subclassGroup.key) : null

  // A group is live unless its `requires` option is not picked.
  const live = rawGroups.filter(
    (g) => !g.requires || picksOf(g.requires.group).includes(g.requires.option)
  )
  const liveKeys = new Set(live.map((g) => g.key))

  const picksFor = (g: RawGroup): string[] =>
    g.key === subclassKey ? (draft.subclass ? [draft.subclass] : []) : picksOf(g.key)

  // Which group (other than itself) picked a namespaced thing, for conflicts and disabling.
  const isLanguage = (slug: string) => languages.has(slug) && !proficiencies.has(slug)
  /** The namespace a pick lives in; one pool group (tool or language) decides per option. */
  const spaceOf = (g: { kind: GroupKind }, slug: string) =>
    g.kind === 'language'
      ? 'language'
      : g.kind === 'toolOrLanguage'
        ? isLanguage(slug)
          ? 'language'
          : 'proficiency'
        : g.kind === 'skill' || g.kind === 'tool'
          ? 'proficiency'
          : null
  const fixedTaken = new Set<string>([
    ...proficiencyList.map((p) => `proficiency:${p.slug}`),
    ...languageList.map((l) => `language:${l.slug}`)
  ])
  const chosenBy = new Map<string, string[]>()
  for (const g of live) {
    const valid = new Set(g.options.map((o) => o.slug))
    for (const slug of new Set(picksFor(g))) {
      const space = spaceOf(g, slug)
      if (!space || !valid.has(slug)) continue
      const id = `${space}:${slug}`
      chosenBy.set(id, [...(chosenBy.get(id) ?? []), g.key])
    }
  }

  const resolveGroup = (
    g: RawGroup,
    options: Omit<ResolvedOption, 'disabled'>[]
  ): ResolvedGroup => {
    const picks = picksFor(g)
    const optionSlugs = new Set(options.map((o) => o.slug))
    const issues: GroupIssue[] = []
    const seen = new Set<string>()
    for (const slug of picks) {
      if (seen.has(slug)) {
        issues.push({ type: 'duplicate', slug })
        continue
      }
      seen.add(slug)
      if (!optionSlugs.has(slug)) {
        issues.push({ type: 'unknown-option', slug })
        continue
      }
      const space = spaceOf(g, slug)
      if (space) {
        const id = `${space}:${slug}`
        if (fixedTaken.has(id)) issues.push({ type: 'conflict', slug, with: 'granted' })
        else {
          const other = (chosenBy.get(id) ?? []).find((k) => k !== g.key)
          if (other) issues.push({ type: 'conflict', slug, with: other })
        }
      }
    }
    if (new Set(picks).size > g.choose) issues.push({ type: 'excess' })
    const resolved: ResolvedOption[] = options.map((o) => {
      let disabled: OptionDisabled | null = null
      const space = spaceOf(g, o.slug)
      if (space) {
        const id = `${space}:${o.slug}`
        if (fixedTaken.has(id)) disabled = 'granted'
        else if ((chosenBy.get(id) ?? []).some((k) => k !== g.key)) disabled = 'chosen-elsewhere'
      }
      return { ...o, disabled }
    })
    const distinct = new Set(picks).size
    return {
      key: g.key,
      ownerType: g.ownerType,
      ownerSlug: g.ownerSlug,
      groupKey: g.groupKey,
      kind: g.kind,
      source: g.source,
      description: g.description,
      citation: g.citation,
      choose: g.choose,
      options: resolved,
      picks,
      autoSelect: options.length === 1 ? options[0].slug : null,
      status: issues.length ? 'attention' : distinct < g.choose ? 'incomplete' : 'valid',
      issues
    }
  }

  // Skills picked so far (and fixed), the ground Expertise stands on.
  const skillProficiencies = new Set<string>()
  const noteSkill = (slug: string) => {
    if (proficiencies.get(slug)?.type === 'Skills') skillProficiencies.add(slug)
  }
  proficiencyList.forEach((p) => noteSkill(p.slug))
  for (const g of live) {
    if (g.kind !== 'skill') continue
    const valid = new Set(g.options.map((o) => o.slug))
    picksFor(g)
      .filter((s) => valid.has(s))
      .forEach(noteSkill)
  }
  const toolProficiencies = new Set<string>()
  proficiencyList
    .filter(
      (p) =>
        p.type !== 'Skills' &&
        p.type !== 'Armor' &&
        p.type !== 'Weapons' &&
        p.type !== 'Saving Throws'
    )
    .forEach((p) => toolProficiencies.add(p.slug))
  for (const g of live) {
    if (g.kind !== 'tool' && g.kind !== 'toolOrLanguage') continue
    const valid = new Set(g.options.map((o) => o.slug))
    picksFor(g)
      .filter((s) => valid.has(s) && !isLanguage(s))
      .forEach((s) => toolProficiencies.add(s))
  }

  const groups: ResolvedGroup[] = live.map((g) => {
    if (g.kind !== 'expertise') return resolveGroup(g, g.options)
    const options = [
      ...[...skillProficiencies].map((slug) => ({
        slug,
        name: proficiencies.get(slug)?.name ?? slug
      })),
      ...(toolProficiencies.has('thieves-tools')
        ? [
            {
              slug: 'thieves-tools',
              name: proficiencies.get('thieves-tools')?.name ?? 'Thieves’ tools'
            }
          ]
        : [])
    ]
    const resolved = resolveGroup(g, options)
    // At most one tool: "two skills, or one skill and thieves' tools".
    const tools = new Set(
      picksFor(g).filter((s) => !skillProficiencies.has(s) && options.some((o) => o.slug === s))
    )
    if (tools.size > 1) {
      resolved.issues.push({ type: 'too-many-tools' })
      resolved.status = 'attention'
    }
    return resolved
  })

  // --- Chosen picks become grants -----------------------------------------------------------
  const expertise: string[] = []
  for (const g of groups) {
    const legal = new Set(g.options.map((o) => o.slug))
    const picks = [...new Set(g.picks)].filter((s) => legal.has(s))
    switch (g.kind) {
      case 'skill':
      case 'tool':
        picks.forEach((s) => addProficiency(s, g.source, 'choice', g.key))
        break
      case 'toolOrLanguage':
        picks.forEach((s) =>
          isLanguage(s)
            ? addLanguage(s, g.source, 'choice', g.key)
            : addProficiency(s, g.source, 'choice', g.key)
        )
        break
      case 'language':
        picks.forEach((s) => addLanguage(s, g.source, 'choice', g.key))
        break
      case 'abilityBonus':
        for (const s of picks) {
          abilityBonuses.push({ ability: s, bonus: 1, source: 'race', via: 'choice' })
        }
        break
      case 'feature':
        picks.forEach((s) => {
          active.add(s)
          const f = features.get(s)
          if (f) featureList.push({ slug: s, name: f.name, source: 'class' })
        })
        break
      case 'dragonType':
        for (const o of g.options) {
          if (picks.includes(o.slug) && o.data?.damageType && g.ownerType === 'trait') {
            resistances.add(o.data.damageType)
          }
        }
        break
      case 'expertise':
        expertise.push(...picks)
        break
      default:
        break
    }
  }

  const skills: ResolvedSkill[] = proficiencyList
    .filter((p) => p.type === 'Skills')
    .map((p) => ({
      skill: proficiencies.get(p.slug)?.reference?.slug ?? p.slug.replace(/^skill-/, ''),
      proficiency: p.slug,
      source: p.source,
      expertise: expertise.includes(p.slug)
    }))

  const abilityBonusTotals: Record<string, number> = {}
  for (const a of abilityBonuses) {
    abilityBonusTotals[a.ability] = (abilityBonusTotals[a.ability] ?? 0) + a.bonus
  }

  // Picks that attach to no live group.
  const orphanPicks: OrphanPick[] = Object.entries(draft.picks)
    .filter(([key, slugs]) => slugs.length > 0 && !liveKeys.has(key))
    .map(([key, slugs]) => ({ key, slugs }))

  const valid = structure.length === 0 && groups.every((g) => g.status === 'valid')

  return {
    valid,
    structure,
    groups,
    orphanPicks,
    abilityBonuses,
    abilityBonusTotals,
    speed: race?.speed ?? null,
    hitDie: cls?.hitDie ?? null,
    savingThrows: cls?.savingThrows ?? [],
    proficiencies: proficiencyList,
    expertise,
    skills,
    languages: languageList,
    resistances: [...resistances],
    grantedSpells,
    features: featureList,
    activeFeatureSlugs: [...active]
  }
}
