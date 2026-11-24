import { describe, expect, it } from 'vitest'
import { journalQueryKey, staleQueries, timelineQueryKey } from './messages'

describe('staleQueries', () => {
  it('refreshes the Journal whenever the DM changes the game, since a Reveal is DM-only', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toEqual([
      timelineQueryKey('c1'),
      journalQueryKey('c1')
    ])
  })
})
