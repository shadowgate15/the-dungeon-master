import { describe, expect, it } from 'vitest'
import {
  floorQueryKey,
  journalQueryKey,
  sceneQueryKey,
  staleQueries,
  timelineQueryKey
} from './messages'

describe('staleQueries', () => {
  it('refreshes the Journal whenever the DM changes the game, since a Reveal is DM-only', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toContainEqual(journalQueryKey('c1'))
  })

  it('refreshes the Scene and the open Floor whenever the DM changes the game', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toEqual([
      timelineQueryKey('c1'),
      sceneQueryKey('c1'),
      floorQueryKey('c1'),
      journalQueryKey('c1')
    ])
  })
})
