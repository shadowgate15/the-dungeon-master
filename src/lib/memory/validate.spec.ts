import { describe, expect, it } from 'vitest'
import { MEMORY_MAX } from './enums'
import {
  normalizeName,
  validateBeatTransition,
  validateDisposition,
  validateExitName,
  validateFact,
  validateFactChange,
  validateNpc,
  validateNpcStatusChange,
  validatePlace,
  validateSummary
} from './validate'

const reason = (r: { ok: boolean }) => (r.ok ? null : (r as { ok: false; reason: string }).reason)

describe('normalizeName', () => {
  it('folds case, accents, punctuation and whitespace', () => {
    expect(normalizeName('  Élara   "the Bold" ')).toBe('elara the bold')
    expect(normalizeName("Old Tom's")).toBe(normalizeName('old toms'))
  })
})

describe('validateNpc', () => {
  const ok = { name: 'Brenna', description: 'A stern smith.', role: 'blacksmith' }
  it('accepts a valid NPC and returns trimmed values with a name key', () => {
    const r = validateNpc({ ...ok, name: '  Brenna  ' }, { takenKeys: new Set() })
    expect(r).toEqual({ ok: true, value: { ...ok, nameKey: 'brenna' } })
  })
  it('rejects a name already taken once normalized', () => {
    const r = validateNpc({ ...ok, name: 'BRENNA!' }, { takenKeys: new Set(['brenna']) })
    expect(reason(r)).toMatch(/already/)
  })
  it('rejects empty, over-cap and digit-bearing text', () => {
    expect(reason(validateNpc({ ...ok, name: ' ' }, { takenKeys: new Set() }))).toMatch(/name/)
    expect(
      reason(
        validateNpc(
          { ...ok, description: 'x'.repeat(MEMORY_MAX.npcDescription + 1) },
          { takenKeys: new Set() }
        )
      )
    ).toMatch(/description/)
    expect(
      reason(validateNpc({ ...ok, role: 'guard of 3 gates' }, { takenKeys: new Set() }))
    ).toMatch(/digit/)
  })
})

describe('validateNpcStatusChange', () => {
  it('allows ordinary changes between living statuses', () => {
    expect(validateNpcStatusChange('alive', 'missing').ok).toBe(true)
    expect(validateNpcStatusChange('departed', 'alive').ok).toBe(true)
    expect(validateNpcStatusChange('dead', 'dead').ok).toBe(true)
  })
  it('keeps the dead dead unless revived with a reason', () => {
    expect(reason(validateNpcStatusChange('dead', 'alive'))).toMatch(/dead/)
    expect(reason(validateNpcStatusChange('dead', 'missing', { revivedReason: ' ' }))).toMatch(
      /dead/
    )
    expect(
      validateNpcStatusChange('dead', 'alive', { revivedReason: 'Raised by a cleric.' }).ok
    ).toBe(true)
  })
  it('rejects unknown statuses', () => {
    expect(validateNpcStatusChange('alive', 'sleeping' as never).ok).toBe(false)
  })
})

describe('validateDisposition', () => {
  it('accepts the five stances with a short note', () => {
    for (const stance of ['hostile', 'wary', 'neutral', 'friendly', 'allied'])
      expect(validateDisposition({ stance, note: 'Owes a favor.' }).ok).toBe(true)
  })
  it('rejects unknown stances, long notes and digits', () => {
    expect(validateDisposition({ stance: 'smitten', note: '' }).ok).toBe(false)
    expect(
      validateDisposition({ stance: 'wary', note: 'x'.repeat(MEMORY_MAX.dispositionNote + 1) }).ok
    ).toBe(false)
    expect(validateDisposition({ stance: 'wary', note: 'paid 5 gold' }).ok).toBe(false)
  })
})

describe('validateFact', () => {
  it('accepts a fact and defaults worldChanging to false', () => {
    const r = validateFact({ title: 'Patron', detail: 'The vizier funds the cult.' })
    expect(r).toEqual({
      ok: true,
      value: { title: 'Patron', detail: 'The vizier funds the cult.', worldChanging: false }
    })
  })
  it('rejects empty, over-cap and digit text', () => {
    expect(validateFact({ title: '', detail: 'd' }).ok).toBe(false)
    expect(validateFact({ title: 't', detail: 'x'.repeat(MEMORY_MAX.factDetail + 1) }).ok).toBe(
      false
    )
    expect(validateFact({ title: 't', detail: 'Found 40 coins' }).ok).toBe(false)
  })
})

describe('validateFactChange', () => {
  it('allows only supersede or retire', () => {
    expect(validateFactChange({ supersededById: 'f2' }).ok).toBe(true)
    expect(validateFactChange({ retiredReason: 'Mistaken.' }).ok).toBe(true)
  })
  it('rejects edits to the text or the flag, and empty changes', () => {
    expect(validateFactChange({ detail: 'new' }).ok).toBe(false)
    expect(validateFactChange({ title: 'new' }).ok).toBe(false)
    expect(validateFactChange({ worldChanging: true }).ok).toBe(false)
    expect(validateFactChange({}).ok).toBe(false)
    expect(validateFactChange({ retiredReason: ' ' }).ok).toBe(false)
  })
})

describe('validatePlace and validateExitName', () => {
  it('validates place text', () => {
    expect(validatePlace({ name: 'The Gilded Stag', description: 'A busy inn.' }).ok).toBe(true)
    expect(validatePlace({ name: '', description: 'x' }).ok).toBe(false)
    expect(
      validatePlace({ name: 'n', description: 'x'.repeat(MEMORY_MAX.placeDescription + 1) }).ok
    ).toBe(false)
  })
  it('validates exit names', () => {
    expect(validateExitName('Cellar door')).toEqual({ ok: true, value: 'Cellar door' })
    expect(validateExitName(' ').ok).toBe(false)
    expect(validateExitName('x'.repeat(MEMORY_MAX.exitName + 1)).ok).toBe(false)
  })
})

describe('validateSummary', () => {
  it('accepts prose and trims it', () => {
    expect(validateSummary('  The party fled the inn.  ')).toEqual({
      ok: true,
      value: 'The party fled the inn.'
    })
  })
  it('rejects digits, empty and over-cap text', () => {
    expect(reason(validateSummary('They found 3 keys.'))).toMatch(/digit/)
    expect(validateSummary('   ').ok).toBe(false)
    expect(validateSummary('x'.repeat(MEMORY_MAX.summary + 1)).ok).toBe(false)
  })
})

describe('validateBeatTransition', () => {
  it('lets a pending Beat become reached or abandoned', () => {
    expect(validateBeatTransition('pending', 'reached').ok).toBe(true)
    expect(validateBeatTransition('pending', 'abandoned').ok).toBe(true)
  })
  it('never lets a Beat leave a settled state or stay pending', () => {
    expect(validateBeatTransition('reached', 'abandoned').ok).toBe(false)
    expect(validateBeatTransition('abandoned', 'reached').ok).toBe(false)
    expect(validateBeatTransition('pending', 'pending').ok).toBe(false)
  })
})
