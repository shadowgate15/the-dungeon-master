import { describe, expect, it } from 'vitest'
import { journalQueryKey, sessionHistoryQueryKey, staleQueries, timelineQueryKey } from './messages'

describe('staleQueries', () => {
  it('refreshes the Journal and Session history whenever the DM changes the game', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toEqual([
      timelineQueryKey('c1'),
      journalQueryKey('c1'),
      sessionHistoryQueryKey('c1')
    ])
  })
})
