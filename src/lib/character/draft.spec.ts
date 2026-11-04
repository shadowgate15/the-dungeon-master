import { describe, expect, it } from 'vitest'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { emptyDraft, reconcile, type CharacterDraft } from './draft.ts'

const rules = loadDataset()
const draftWith = (patch: Partial<CharacterDraft>): CharacterDraft => ({
  ...emptyDraft(),
  ...patch
})

describe('reconcile', () => {
  it('auto-selects the only subclass option', () => {
    const { draft } = reconcile(rules, draftWith({ class: 'cleric' }))
    expect(draft.subclass).toBe('life')
  })

  it('leaves the subclass empty for a class without one', () => {
    const { draft } = reconcile(rules, draftWith({ class: 'fighter' }))
    expect(draft.subclass).toBeNull()
  })

  it('clears a subrace that does not belong to the new race and says so', () => {
    const { draft, notices } = reconcile(rules, draftWith({ race: 'dwarf', subrace: 'high-elf' }))
    expect(draft.subrace).toBeNull()
    expect(notices.join(' ')).toMatch(/High Elf/)
  })

  it('clears a subclass that does not belong to the new class and says so', () => {
    const { draft, notices } = reconcile(rules, draftWith({ class: 'fighter', subclass: 'life' }))
    expect(draft.subclass).toBeNull()
    expect(notices.join(' ')).toMatch(/Life/)
  })

  it('keeps picks that still have a group to attach to', () => {
    const key = 'class/fighter/fightingStyle-0'
    const before = draftWith({ class: 'fighter', picks: { [key]: ['fighting-style-defense'] } })
    const { draft, notices } = reconcile(rules, before)
    expect(draft.picks[key]).toEqual(['fighting-style-defense'])
    expect(notices).toEqual([])
  })

  it('starts without custom background text, and drops it when the background is not custom', () => {
    expect(emptyDraft()).toMatchObject({ customBackgroundName: '', customBackgroundFeature: '' })
    const kept = reconcile(
      rules,
      draftWith({
        background: 'custom',
        customBackgroundName: 'Wanderer',
        customBackgroundFeature: 'x'
      })
    )
    expect(kept.draft.customBackgroundName).toBe('Wanderer')
    const { draft } = reconcile(
      rules,
      draftWith({
        background: 'acolyte',
        customBackgroundName: 'Wanderer',
        customBackgroundFeature: 'x'
      })
    )
    expect(draft).toMatchObject({ customBackgroundName: '', customBackgroundFeature: '' })
  })

  it('clears picks whose choice no longer exists and says so', () => {
    const key = 'class/fighter/fightingStyle-0'
    const before = draftWith({ class: 'wizard', picks: { [key]: ['fighting-style-defense'] } })
    const { draft, notices } = reconcile(rules, before)
    expect(draft.picks[key]).toBeUndefined()
    expect(notices.join(' ')).toMatch(/Fighter/)
  })
})
