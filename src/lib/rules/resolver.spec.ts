import { describe, expect, it } from 'vitest'
import { OVERLAY_GRANTS, OVERLAY_GROUPS, choiceKey } from './overlay.ts'
import { resolveFeatures, type ResolvedFeatures, type ResolverDraft } from './resolver.ts'
import { loadDataset } from './test-dataset.ts'

const rules = loadDataset()

const draft = (over: Partial<ResolverDraft> = {}): ResolverDraft => ({
  race: null,
  subrace: null,
  class: null,
  subclass: null,
  background: 'acolyte',
  picks: {},
  ...over
})

const group = (r: ResolvedFeatures, key: string) => r.groups.find((g) => g.key === key)
const enabled = (r: ResolvedFeatures, key: string) =>
  group(r, key)!
    .options.filter((o) => !o.disabled)
    .map((o) => o.slug)

describe('structure', () => {
  it('flags what Concept still lacks, and a subrace the race requires', () => {
    const r = resolveFeatures(rules, draft({ race: 'dwarf', background: null }))
    expect(r.valid).toBe(false)
    expect(r.structure).toEqual(
      expect.arrayContaining([
        { field: 'class', type: 'missing' },
        { field: 'background', type: 'missing' },
        { field: 'subrace', type: 'missing' }
      ])
    )
  })

  it('does not require a subrace for a race without one', () => {
    const r = resolveFeatures(rules, draft({ race: 'human', class: 'fighter' }))
    expect(r.structure).toEqual([])
  })

  it('requires the subclass for Cleric, Sorcerer and Warlock only, and auto-selects the single one', () => {
    const cleric = resolveFeatures(rules, draft({ race: 'human', class: 'cleric' }))
    expect(cleric.structure).toEqual([{ field: 'subclass', type: 'missing' }])
    expect(group(cleric, 'class/cleric/subclass-0')).toMatchObject({ autoSelect: 'life' })
    const fighter = resolveFeatures(rules, draft({ race: 'human', class: 'fighter' }))
    expect(group(fighter, 'class/fighter/subclass-0')).toBeUndefined()
  })

  it('reports a subclass from another class and unknown slugs instead of throwing', () => {
    const r = resolveFeatures(
      rules,
      draft({ race: 'nope', class: 'cleric', subclass: 'fiend', background: 'acolyte' })
    )
    expect(r.structure).toEqual(
      expect.arrayContaining([
        { field: 'race', type: 'unknown' },
        { field: 'subclass', type: 'mismatch' }
      ])
    )
  })
})

describe('fixed grants', () => {
  it('Hill Dwarf: racial bonuses, speed, poison resistance, Dwarven Toughness, tool pick', () => {
    const r = resolveFeatures(
      rules,
      draft({ race: 'dwarf', subrace: 'hill-dwarf', class: 'fighter' })
    )
    expect(r.abilityBonusTotals).toEqual({ con: 2, wis: 1 })
    expect(r.speed).toBe(25)
    expect(r.resistances).toEqual(['poison'])
    expect(r.activeFeatureSlugs).toContain('dwarven-toughness')
    expect(r.languages.map((l) => l.slug)).toEqual(['common', 'dwarvish'])
    expect(r.proficiencies.map((p) => p.slug)).toContain('warhammers')
    expect(enabled(r, 'trait/tool-proficiency/proficiency-0').sort()).toEqual([
      'brewers-supplies',
      'masons-tools',
      'smiths-tools'
    ])
  })

  it('Cleric of Life: heavy armor, domain spells at level 1, saves', () => {
    const r = resolveFeatures(rules, draft({ race: 'human', class: 'cleric', subclass: 'life' }))
    expect(r.proficiencies.find((p) => p.slug === 'heavy-armor')).toMatchObject({ source: 'class' })
    expect(r.grantedSpells.map((s) => s.spell).sort()).toEqual(['bless', 'cure-wounds'])
    expect(r.savingThrows).toEqual(['wis', 'cha'])
    expect(r.hitDie).toBe(8)
    expect(r.structure).toEqual([])
  })

  it('Tiefling: fire resistance and thaumaturgy as a derived grant', () => {
    const r = resolveFeatures(rules, draft({ race: 'tiefling', class: 'fighter' }))
    expect(r.resistances).toEqual(['fire'])
    expect(r.grantedSpells).toEqual([{ spell: 'thaumaturgy', level: 0, source: 'race' }])
  })

  it('background skills and racial skill traits become skills with their source', () => {
    const r = resolveFeatures(rules, draft({ race: 'elf', subrace: 'high-elf', class: 'fighter' }))
    expect(r.skills).toEqual(
      expect.arrayContaining([
        { skill: 'insight', proficiency: 'skill-insight', source: 'background', expertise: false },
        { skill: 'perception', proficiency: 'skill-perception', source: 'race', expertise: false }
      ])
    )
  })
})

describe('Half-Elf', () => {
  const key = (k: string) => `race/half-elf/${k}`
  it('picks two other abilities, one extra Standard language and two skills', () => {
    const picks = {
      [key('abilityBonus-0')]: ['str', 'dex'],
      [key('language-0')]: ['dwarvish'],
      'trait/skill-versatility/proficiency-0': ['skill-arcana', 'skill-stealth']
    }
    const r = resolveFeatures(rules, draft({ race: 'half-elf', class: 'wizard', picks }))
    expect(r.abilityBonusTotals).toEqual({ cha: 2, str: 1, dex: 1 })
    expect(r.languages.map((l) => l.slug)).toEqual(['common', 'elvish', 'dwarvish'])
    expect(group(r, key('language-0'))!.options.every((o) => o.slug !== 'abyssal')).toBe(true)
    expect(r.skills.filter((s) => s.source === 'race').map((s) => s.skill)).toEqual([
      'arcana',
      'stealth'
    ])
  })

  it('greys out what is already granted or chosen elsewhere and flags the conflict', () => {
    const picks = {
      [key('language-0')]: ['dwarvish'],
      'background/acolyte/language-0': ['dwarvish', 'giant'],
      'trait/skill-versatility/proficiency-0': ['skill-insight', 'skill-stealth']
    }
    const r = resolveFeatures(rules, draft({ race: 'half-elf', class: 'wizard', picks }))
    const lang = group(r, key('language-0'))!
    expect(lang.issues).toEqual([
      { type: 'conflict', slug: 'dwarvish', with: 'background/acolyte/language-0' }
    ])
    expect(lang.options.find((o) => o.slug === 'giant')!.disabled).toBe('chosen-elsewhere')
    expect(lang.status).toBe('attention')
    const skill = group(r, 'trait/skill-versatility/proficiency-0')!
    expect(skill.issues).toEqual([{ type: 'conflict', slug: 'skill-insight', with: 'granted' }])
    expect(skill.options.find((o) => o.slug === 'skill-insight')!.disabled).toBe('granted')
    expect(r.valid).toBe(false)
  })

  it('does not let a skill be picked from both the class and the race', () => {
    const picks = {
      'class/wizard/proficiency-0': ['skill-arcana', 'skill-history'],
      'trait/skill-versatility/proficiency-0': ['skill-arcana']
    }
    const r = resolveFeatures(rules, draft({ race: 'half-elf', class: 'wizard', picks }))
    expect(group(r, 'class/wizard/proficiency-0')!.issues).toEqual([
      { type: 'conflict', slug: 'skill-arcana', with: 'trait/skill-versatility/proficiency-0' }
    ])
    expect(
      group(r, 'trait/skill-versatility/proficiency-0')!.options.find(
        (o) => o.slug === 'skill-history'
      )!.disabled
    ).toBe('chosen-elsewhere')
  })

  it('marks incomplete picks incomplete, not invalid', () => {
    const r = resolveFeatures(rules, draft({ race: 'half-elf', class: 'wizard' }))
    expect(group(r, key('abilityBonus-0'))).toMatchObject({ status: 'incomplete', issues: [] })
  })
})

describe('Rogue expertise', () => {
  const rogue = (picks: Record<string, string[]>) =>
    resolveFeatures(
      rules,
      draft({
        race: 'human',
        class: 'rogue',
        picks: {
          'class/rogue/proficiency-0': [
            'skill-stealth',
            'skill-acrobatics',
            'skill-perception',
            'skill-deception'
          ],
          ...picks
        }
      })
    )
  const k = 'class/rogue/expertise-0'

  it('offers proficient skills (including the background) plus thieves tools', () => {
    const r = rogue({})
    expect(
      group(r, k)!
        .options.map((o) => o.slug)
        .sort()
    ).toEqual(
      [
        'skill-acrobatics',
        'skill-deception',
        'skill-insight',
        'skill-perception',
        'skill-religion',
        'skill-stealth',
        'thieves-tools'
      ].sort()
    )
  })

  it('accepts two skills, or one skill and thieves tools, and records expertise', () => {
    const two = rogue({ [k]: ['skill-stealth', 'skill-insight'] })
    expect(group(two, k)!.status).toBe('valid')
    expect(
      two.skills
        .filter((s) => s.expertise)
        .map((s) => s.skill)
        .sort()
    ).toEqual(['insight', 'stealth'])
    const tool = rogue({ [k]: ['skill-stealth', 'thieves-tools'] })
    expect(group(tool, k)!.status).toBe('valid')
    expect(tool.expertise).toContain('thieves-tools')
  })

  it('re-validates when a skill changes: expertise in a dropped skill is flagged', () => {
    const r = rogue({
      [k]: ['skill-stealth', 'skill-insight'],
      'class/rogue/proficiency-0': [
        'skill-acrobatics',
        'skill-perception',
        'skill-deception',
        'skill-athletics'
      ]
    })
    expect(group(r, k)!.issues).toEqual([{ type: 'unknown-option', slug: 'skill-stealth' }])
    expect(group(r, k)!.status).toBe('attention')
  })
})

describe('Ranger favored enemy and terrain', () => {
  const ranger = (picks: Record<string, string[]>) =>
    resolveFeatures(rules, draft({ race: 'human', class: 'ranger', picks }))
  const enemy = 'class/ranger/favoredEnemy-0'
  const races = 'class/ranger/favoredEnemyRaces-0'
  const lang = 'class/ranger/favoredEnemyLanguage-0'

  it('a creature type needs one pick and a Standard language, no races', () => {
    const r = ranger({ [enemy]: ['undead'] })
    expect(group(r, races)).toBeUndefined()
    expect(group(r, enemy)!.status).toBe('valid')
    expect(group(r, lang)).toMatchObject({ choose: 1, status: 'incomplete' })
    expect(group(r, lang)!.options.every((o) => o.slug !== 'draconic')).toBe(true)
    expect(group(r, lang)!.options.find((o) => o.slug === 'common')!.disabled).toBe('granted')
  })

  it('humanoids adds a sibling group of two race slugs', () => {
    const r = ranger({ [enemy]: ['humanoids'], [races]: ['half-orc', 'dwarf'] })
    expect(group(r, races)).toMatchObject({ choose: 2, status: 'valid', kind: 'race' })
  })

  it('races picked for humanoids are reported as orphans once another type is chosen', () => {
    const r = ranger({ [enemy]: ['undead'], [races]: ['half-orc', 'dwarf'] })
    expect(r.orphanPicks).toEqual([{ key: races, slugs: ['half-orc', 'dwarf'] }])
  })

  it('terrain is a single pick', () => {
    expect(group(ranger({}), 'class/ranger/favoredTerrain-0')).toMatchObject({
      kind: 'terrain',
      choose: 1,
      status: 'incomplete'
    })
  })
})

describe('Dragonborn ancestry and Sorcerer dragon ancestor', () => {
  it('Dragonborn ancestry grants the matching resistance', () => {
    const r = resolveFeatures(
      rules,
      draft({
        race: 'dragonborn',
        class: 'fighter',
        picks: { 'trait/draconic-ancestry/dragonType-0': ['green'] }
      })
    )
    expect(r.resistances).toEqual(['poison'])
    expect(group(r, 'trait/draconic-ancestry/dragonType-0')!.options).toHaveLength(10)
  })

  it('the Sorcerer ancestor is its own group, only with the Draconic subclass, and adds no resistance', () => {
    const none = resolveFeatures(rules, draft({ race: 'human', class: 'sorcerer' }))
    expect(group(none, 'subclass/draconic/dragonType-0')).toBeUndefined()
    const r = resolveFeatures(
      rules,
      draft({
        race: 'dragonborn',
        class: 'sorcerer',
        subclass: 'draconic',
        picks: {
          'trait/draconic-ancestry/dragonType-0': ['red'],
          'subclass/draconic/dragonType-0': ['silver']
        }
      })
    )
    expect(group(r, 'subclass/draconic/dragonType-0')).toMatchObject({ status: 'valid' })
    expect(r.resistances).toEqual(['fire'])
    expect(r.activeFeatureSlugs).toContain('draconic-resilience')
    expect(r.languages.filter((l) => l.slug === 'draconic')).toHaveLength(1)
  })
})

describe('Fighter fighting style', () => {
  it('a chosen style becomes an active feature the registry can key on', () => {
    const r = resolveFeatures(
      rules,
      draft({
        race: 'human',
        class: 'fighter',
        picks: { 'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'] }
      })
    )
    expect(r.activeFeatureSlugs).toContain('fighter-fighting-style-defense')
  })
})

describe('High Elf', () => {
  it('has a wizard cantrip pick and an extra language', () => {
    const r = resolveFeatures(rules, draft({ race: 'elf', subrace: 'high-elf', class: 'fighter' }))
    expect(group(r, 'trait/high-elf-cantrip/cantrip-0')).toMatchObject({ kind: 'spell', choose: 1 })
    expect(enabled(r, 'trait/high-elf-cantrip/cantrip-0')).toContain('fire-bolt')
    expect(group(r, 'trait/extra-language/language-0')).toBeDefined()
  })
})

describe('stale picks', () => {
  it('reports picks for a group the draft no longer has, without throwing', () => {
    const r = resolveFeatures(
      rules,
      draft({
        race: 'human',
        class: 'fighter',
        picks: { 'class/rogue/expertise-0': ['skill-stealth'] }
      })
    )
    expect(r.orphanPicks).toEqual([{ key: 'class/rogue/expertise-0', slugs: ['skill-stealth'] }])
  })

  it('flags an unknown option slug and excess picks', () => {
    const r = resolveFeatures(
      rules,
      draft({
        race: 'human',
        class: 'fighter',
        picks: { 'class/fighter/fightingStyle-0': ['gone', 'fighter-fighting-style-archery'] }
      })
    )
    const g = group(r, 'class/fighter/fightingStyle-0')!
    expect(g.issues).toEqual(
      expect.arrayContaining([{ type: 'unknown-option', slug: 'gone' }, { type: 'excess' }])
    )
  })
})

describe('coverage of the SRD level 1 inventory (research #88, sections 1 and 2.2)', () => {
  // Every player decision at level 1 the research found, with where it lives. Spell lists and
  // starting equipment are covered by their own tickets (#97) and checked separately below.
  const inventory: { what: string; draft: Partial<ResolverDraft>; key: string }[] = [
    {
      what: 'Dwarf tool',
      draft: { race: 'dwarf', subrace: 'hill-dwarf' },
      key: 'trait/tool-proficiency/proficiency-0'
    },
    {
      what: 'High Elf cantrip',
      draft: { race: 'elf', subrace: 'high-elf' },
      key: 'trait/high-elf-cantrip/cantrip-0'
    },
    {
      what: 'High Elf language',
      draft: { race: 'elf', subrace: 'high-elf' },
      key: 'trait/extra-language/language-0'
    },
    { what: 'Human language', draft: { race: 'human' }, key: 'race/human/language-0' },
    {
      what: 'Dragonborn ancestry',
      draft: { race: 'dragonborn' },
      key: 'trait/draconic-ancestry/dragonType-0'
    },
    {
      what: 'Half-Elf abilities',
      draft: { race: 'half-elf' },
      key: 'race/half-elf/abilityBonus-0'
    },
    {
      what: 'Half-Elf skills',
      draft: { race: 'half-elf' },
      key: 'trait/skill-versatility/proficiency-0'
    },
    { what: 'Half-Elf language', draft: { race: 'half-elf' }, key: 'race/half-elf/language-0' },
    { what: 'Acolyte languages', draft: { race: 'human' }, key: 'background/acolyte/language-0' },
    { what: 'Bard instruments', draft: { class: 'bard' }, key: 'class/bard/proficiency-1' },
    { what: 'Monk tool or instrument', draft: { class: 'monk' }, key: 'class/monk/proficiency-1' },
    {
      what: 'Fighter fighting style',
      draft: { class: 'fighter' },
      key: 'class/fighter/fightingStyle-0'
    },
    { what: 'Rogue expertise', draft: { class: 'rogue' }, key: 'class/rogue/expertise-0' },
    {
      what: 'Ranger favored enemy',
      draft: { class: 'ranger' },
      key: 'class/ranger/favoredEnemy-0'
    },
    {
      what: 'Ranger enemy language',
      draft: { class: 'ranger' },
      key: 'class/ranger/favoredEnemyLanguage-0'
    },
    {
      what: 'Ranger favored terrain',
      draft: { class: 'ranger' },
      key: 'class/ranger/favoredTerrain-0'
    },
    { what: 'Cleric domain', draft: { class: 'cleric' }, key: 'class/cleric/subclass-0' },
    { what: 'Sorcerer origin', draft: { class: 'sorcerer' }, key: 'class/sorcerer/subclass-0' },
    { what: 'Warlock patron', draft: { class: 'warlock' }, key: 'class/warlock/subclass-0' },
    {
      what: 'Sorcerer dragon ancestor',
      draft: { class: 'sorcerer', subclass: 'draconic' },
      key: 'subclass/draconic/dragonType-0'
    },
    ...rules.classes.map((c) => ({
      what: `${c.name} class skills`,
      draft: { class: c.slug },
      key: `class/${c.slug}/proficiency-0`
    }))
  ]

  it.each(inventory)('$what has a choice group', ({ draft: d, key }) => {
    const r = resolveFeatures(rules, draft({ race: 'human', ...d }))
    expect(group(r, key), key).toBeDefined()
  })

  it('every class has its starting-equipment choice groups in the Rules Data', () => {
    for (const c of rules.classes) {
      expect(
        c.choiceGroups.some((g) => g.kind === 'equipment'),
        c.slug
      ).toBe(true)
    }
  })
})

describe('overlay integrity', () => {
  const has = (rows: { slug: string }[], slug: string) => rows.some((r) => r.slug === slug)

  it('every overlay group cites an SRD page and has a unique key per owner', () => {
    const keys = OVERLAY_GROUPS.map((g) => choiceKey(g.ownerType, g.ownerSlug, g.key))
    expect(new Set(keys).size).toBe(keys.length)
    expect(OVERLAY_GROUPS.length).toBeGreaterThanOrEqual(12)
  })

  it('every slug an overlay refers to exists in the Rules Data', () => {
    const owners = {
      class: rules.classes,
      race: rules.races,
      trait: rules.traits,
      subclass: rules.subclasses
    }
    for (const g of [...OVERLAY_GROUPS, ...OVERLAY_GRANTS]) {
      expect(has(owners[g.ownerType], g.ownerSlug), `${g.ownerType}/${g.ownerSlug}`).toBe(true)
    }
    for (const g of OVERLAY_GROUPS) {
      if (g.kind === 'feature' && g.options.from === 'literal') {
        for (const o of g.options.options) expect(has(rules.features, o.slug), o.slug).toBe(true)
      }
    }
    for (const g of OVERLAY_GRANTS) {
      g.proficiencies.forEach((s) => expect(has(rules.proficiencies, s), s).toBe(true))
      g.languages.forEach((s) => expect(has(rules.languages, s), s).toBe(true))
      g.resistances.forEach((s) => expect(has(rules.damageTypes, s), s).toBe(true))
      g.spells.forEach((s) => expect(has(rules.spells, s), s).toBe(true))
    }
  })
})

describe('every race x class combination', () => {
  /** Fill each unfinished group with its first legal options until nothing is left to pick. */
  function complete(base: ResolverDraft): ResolvedFeatures {
    let d = base
    for (let i = 0; i < 40; i++) {
      const r = resolveFeatures(rules, d)
      const todo = r.groups.find((g) => g.status !== 'valid' && g.kind !== 'subclass')
      if (!todo) return r
      const need = todo.choose - new Set(todo.picks).size
      const add = todo.options
        .filter((o) => !o.disabled && !todo.picks.includes(o.slug))
        .slice(0, need)
        .map((o) => o.slug)
      d = { ...d, picks: { ...d.picks, [todo.key]: [...todo.picks, ...add] } }
    }
    throw new Error('did not converge')
  }

  const combos = rules.races.flatMap((race) => {
    const subs = rules.subraces.filter((s) => s.race === race.slug)
    return rules.classes.map((cls) => ({
      race: race.slug,
      subrace: subs[0]?.slug ?? null,
      class: cls.slug,
      subclass: rules.subclasses.find((s) => s.class === cls.slug && s.slug)?.slug ?? null
    }))
  })

  it('resolves to a valid feature set with nothing thrown', () => {
    for (const c of combos) {
      const needsSubclass = ['cleric', 'sorcerer', 'warlock'].includes(c.class)
      const r = complete(draft({ ...c, subclass: needsSubclass ? c.subclass : null }))
      expect(r.valid, `${c.race}/${c.subrace}/${c.class}: ${JSON.stringify(r.structure)}`).toBe(
        true
      )
      expect(r.orphanPicks).toEqual([])
    }
  })
})
