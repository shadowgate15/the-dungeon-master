import { describe, expect, it } from 'vitest'
import { resolveFeatures, type ResolvedFeatures, type ResolverDraft } from './resolver.ts'
import { loadDataset } from './test-dataset.ts'

const rules = loadDataset()

const draft = (over: Partial<ResolverDraft> = {}): ResolverDraft => ({
  race: 'human',
  subrace: null,
  class: 'fighter',
  subclass: null,
  background: 'custom',
  picks: {},
  ...over
})

const group = (r: ResolvedFeatures, key: string) => r.groups.find((g) => g.key === key)

const SKILLS = 'background/custom/skills-0'
const EXTRAS = 'background/custom/toolsOrLanguages-0'

describe('custom background (SRD p.60)', () => {
  it('offers two skills and two tools or languages, in the background source', () => {
    const r = resolveFeatures(rules, draft())
    expect(group(r, SKILLS)).toMatchObject({ kind: 'skill', source: 'background', choose: 2 })
    expect(group(r, EXTRAS)).toMatchObject({
      kind: 'toolOrLanguage',
      source: 'background',
      choose: 2
    })
    expect(group(r, SKILLS)!.options).toHaveLength(18)
    const extras = group(r, EXTRAS)!.options.map((o) => o.slug)
    expect(extras).toEqual(expect.arrayContaining(['thieves-tools', 'lute', 'dwarvish']))
    expect(extras).not.toContain('draconic')
    expect(extras).not.toContain('light-armor')
  })

  it('adds no groups for Acolyte', () => {
    const r = resolveFeatures(rules, draft({ background: 'acolyte' }))
    expect(group(r, SKILLS)).toBeUndefined()
    expect(group(r, EXTRAS)).toBeUndefined()
  })

  it('greys out a skill another group picked and flags the repeat', () => {
    const r = resolveFeatures(
      rules,
      draft({
        class: 'rogue',
        picks: {
          'class/rogue/proficiency-0': ['skill-stealth'],
          [SKILLS]: ['skill-stealth', 'skill-arcana']
        }
      })
    )
    expect(group(r, SKILLS)!.options.find((o) => o.slug === 'skill-stealth')?.disabled).toBe(
      'chosen-elsewhere'
    )
    expect(group(r, SKILLS)!.status).toBe('attention')
  })

  it('treats languages and tools as one pool, grants them, and blocks repeats', () => {
    const ok = resolveFeatures(
      rules,
      draft({
        picks: {
          [SKILLS]: ['skill-arcana', 'skill-history'],
          [EXTRAS]: ['thieves-tools', 'elvish']
        }
      })
    )
    expect(group(ok, EXTRAS)!.status).toBe('valid')
    expect(ok.languages.map((l) => l.slug)).toContain('elvish')
    expect(ok.proficiencies.map((p) => p.slug)).toEqual(
      expect.arrayContaining(['thieves-tools', 'skill-arcana', 'skill-history'])
    )

    // Humans already speak Common.
    const dup = resolveFeatures(rules, draft({ picks: { [EXTRAS]: ['common', 'elvish'] } }))
    expect(group(dup, EXTRAS)!.issues).toContainEqual({
      type: 'conflict',
      slug: 'common',
      with: 'granted'
    })
    expect(group(dup, EXTRAS)!.options.find((o) => o.slug === 'common')?.disabled).toBe('granted')
  })

  it('is incomplete until the exact counts are picked', () => {
    const r = resolveFeatures(rules, draft({ picks: { [SKILLS]: ['skill-arcana'] } }))
    expect(group(r, SKILLS)!.status).toBe('incomplete')
    expect(r.valid).toBe(false)
  })
})
