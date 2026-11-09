import { describe, expect, it } from 'vitest'
import spells from '#lib/rules/data/spells.json'
import { parseSpellLine, spellLevelLabel } from './spell-text.ts'

const command = spells.find((s) => s.slug === 'command')!

describe('parseSpellLine', () => {
  it('splits a leading run-in heading from the rest of the line (Command)', () => {
    expect(parseSpellLine(command.description[2])).toEqual({
      heading: 'Approach.',
      text: 'The target moves toward you by the shortest and most direct route, ending its turn if it moves within 5 feet of you.'
    })
  })

  it('leaves a plain paragraph untouched', () => {
    expect(parseSpellLine(command.description[0])).toEqual({
      heading: null,
      text: command.description[0]
    })
  })

  it('does not treat markers in the middle of a line as a heading', () => {
    expect(parseSpellLine('You see ***this*** here.')).toEqual({
      heading: null,
      text: 'You see ***this*** here.'
    })
  })
})

describe('spellLevelLabel', () => {
  it('names cantrips and numbers the rest', () => {
    expect(spellLevelLabel(0)).toBe('cantrip')
    expect(spellLevelLabel(3)).toBe('level 3')
  })
})
