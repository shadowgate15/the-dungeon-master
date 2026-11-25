import { describe, expect, it } from 'vitest'
import { actingCharacter, turnOf } from './combat'
import type { CombatView } from './scene'

const wren = { id: 'c-wren', name: 'Wren' }
const ash = { id: 'c-ash', name: 'Ash' }

const combat = (current: string | null): CombatView => ({
  round: current ? 1 : 0,
  waiting: [],
  order: [
    {
      key: 'w',
      name: 'Wren',
      kind: 'character',
      characterId: 'c-wren',
      initiative: 20,
      current: current === 'Wren',
      state: null
    },
    {
      key: 'g',
      name: 'Goblin 1',
      kind: 'creature',
      characterId: null,
      initiative: 12,
      current: current === 'Goblin 1',
      state: 'unhurt'
    },
    {
      key: 'a',
      name: 'Ash',
      kind: 'character',
      characterId: 'c-ash',
      initiative: 7,
      current: current === 'Ash',
      state: null
    }
  ]
})

describe('actingCharacter', () => {
  it('follows the pick, or the first who can act, outside Combat', () => {
    expect(actingCharacter([wren, ash], null, null)).toBe(wren)
    expect(actingCharacter([wren, ash], 'c-ash', undefined)).toBe(ash)
  })

  it('locks to the Character whose turn it is and ignores the pick', () => {
    expect(actingCharacter([wren, ash], 'c-wren', combat('Ash'))).toBe(ash)
  })

  it("leaves no Character acting on a foe's turn", () => {
    expect(actingCharacter([wren, ash], 'c-wren', combat('Goblin 1'))).toBeNull()
  })

  it('does not lock while the order waits on initiative', () => {
    expect(actingCharacter([wren, ash], 'c-ash', combat(null))).toBe(ash)
  })
})

describe('turnOf', () => {
  it('names whose turn it is, or null when no turn is running', () => {
    expect(turnOf(combat('Goblin 1'))?.name).toBe('Goblin 1')
    expect(turnOf(combat(null))).toBeNull()
    expect(turnOf(null)).toBeNull()
  })
})
