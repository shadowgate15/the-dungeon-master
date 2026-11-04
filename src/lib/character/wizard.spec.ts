import { describe, expect, it } from 'vitest'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = loadDataset()
const fresh = () => new CharacterWizard(rules)

describe('CharacterWizard', () => {
  it('starts on Concept with every later step locked', () => {
    const w = fresh()
    expect(w.current).toBe('concept')
    expect(w.step('abilities')?.status).toBe('locked')
    expect(w.go('abilities')).toBe(false)
    expect(w.current).toBe('concept')
  })

  it('opens the later steps in any order once Concept is valid', () => {
    const w = fresh()
    w.update({ name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' })
    expect(w.go('equipment')).toBe(true)
    expect(w.go('abilities')).toBe(true)
    expect(w.current).toBe('abilities')
  })

  it('relocks the later steps if Concept becomes invalid again', () => {
    const w = fresh()
    w.update({ name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' })
    w.update({ class: null })
    expect(w.step('abilities')?.status).toBe('locked')
  })

  it('walks back and next over the applicable steps only', () => {
    const w = fresh()
    w.update({ name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' })
    w.go('equipment')
    expect(w.next).toBe('review')
    expect(w.previous).toBe('skills')
  })

  it('fills the stats strip in progressively as the draft grows', () => {
    const w = fresh()
    expect(w.stats.hitPoints.status).toBe('pending')
    expect(w.stats.speed.status).toBe('pending')

    w.update({ race: 'dwarf', subrace: 'hill-dwarf' })
    expect(w.stats.speed).toEqual({ status: 'ok', value: 25 })
    expect(w.stats.hitPoints.status).toBe('pending')

    w.update({ class: 'fighter' })
    w.update({ baseScores: { ...w.draft.baseScores, con: 14 } })
    // d10 + CON mod (14 + 2 racial = 16, +3) + Dwarven Toughness (+1)
    expect(w.stats.hitPoints).toEqual({ status: 'ok', value: 14 })
  })

  it('reports cleared choices as notices and can dismiss them', () => {
    const w = fresh()
    w.update({ race: 'elf', subrace: 'high-elf' })
    w.update({ race: 'dwarf' })
    expect(w.draft.subrace).toBeNull()
    expect(w.notices).toHaveLength(1)
    w.dismissNotice(0)
    expect(w.notices).toEqual([])
  })

  it('is clean until something changes', () => {
    const w = fresh()
    expect(w.dirty).toBe(false)
    w.update({ name: 'B' })
    expect(w.dirty).toBe(true)
  })
})
