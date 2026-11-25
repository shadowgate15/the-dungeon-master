import { describe, expect, it } from 'vitest'
import { handleKind } from './entity-types'

describe('handleKind', () => {
  it('names what a handle refers to by its prefix', () => {
    expect(handleKind('char:wren')).toBe('char')
    expect(handleKind('npc:vizier-maul')).toBe('npc')
    expect(handleKind('place:the-docks')).toBe('place')
    expect(handleKind('creature:goblin-2')).toBe('creature')
    expect(handleKind('monster:goblin')).toBe('monster')
  })

  it('is null for a name or an unknown prefix', () => {
    expect(handleKind('Wren')).toBeNull()
    expect(handleKind('spell:fireball')).toBeNull()
    expect(handleKind('npc:')).toBeNull()
  })
})
