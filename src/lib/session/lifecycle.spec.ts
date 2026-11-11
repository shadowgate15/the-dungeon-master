import { describe, expect, it } from 'vitest'
import { deriveTurnState } from './lifecycle.ts'

const dm = (over = {}) => ({ author: 'dm' as const, kind: 'narration' as const, ...over })
const player = { author: 'player' as const, kind: 'action' as const }

describe('deriveTurnState', () => {
  it('needs the DM to open an empty transcript', () => {
    expect(deriveTurnState([])).toBe('unopened')
  })

  it('awaits the player after plain DM narration', () => {
    expect(deriveTurnState([dm()])).toBe('awaiting-action')
  })

  it('has a pending roll when the last Turn is a DM turn with a Roll request', () => {
    const rollRequest = { check: 'skill' as const, key: 'stealth', dc: 12, reason: 'Sneak' }
    expect(deriveTurnState([dm(), player, dm({ rollRequest })])).toBe('pending-roll')
  })

  it('has an unanswered player turn when the last Turn is the player', () => {
    expect(deriveTurnState([dm(), player])).toBe('unanswered')
  })
})
