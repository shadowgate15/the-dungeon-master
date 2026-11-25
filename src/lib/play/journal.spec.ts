import { describe, expect, it } from 'vitest'
import { knownBy } from './journal'
import { journalEntries } from './play-fixtures'

describe('what a Character knows', () => {
  it('is their own Beliefs first, then what the rest of the Party believes', () => {
    const kael = knownBy({ entries: journalEntries }, 'kael')
    expect(kael.map((e) => e.text)).toEqual([
      'Mira owes the harbourmaster money',
      'Saltgate',
      'Mira sailed for the Isles'
    ])
  })
})
