import { describe, expect, it } from 'vitest'
import {
  type LiveMessage,
  claimsQueryKey,
  floorQueryKey,
  journalQueryKey,
  sceneQueryKey,
  sessionHistoryQueryKey,
  staleQueries,
  sheetsQueryKey,
  timelineQueryKey
} from './messages'

describe('staleQueries', () => {
  it('refreshes the Journal whenever the DM changes the game, since a Reveal is DM-only', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toContainEqual(journalQueryKey('c1'))
  })

  it('refreshes the Session history whenever the DM changes the game (close_session)', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toContainEqual(
      sessionHistoryQueryKey('c1')
    )
  })

  it('refreshes the Scene and the open Floor whenever the DM changes the game', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toEqual([
      timelineQueryKey('c1'),
      sceneQueryKey('c1'),
      floorQueryKey('c1'),
      journalQueryKey('c1'),
      sessionHistoryQueryKey('c1'),
      sheetsQueryKey('c1')
    ])
  })

  it('refreshes the sheets whenever the DM changes the game, so rests and items show live', () => {
    expect(staleQueries({ type: 'timeline', campaign: 'c1' })).toContainEqual(sheetsQueryKey('c1'))
  })

  it('makes every per-Player query and the Claims listing refetch on a content-free claims message', () => {
    const message = { type: 'claims', campaign: 'c1' } as const

    expect(Object.keys(message)).toEqual(['type', 'campaign'])
    expect(staleQueries(message)).toEqual([
      claimsQueryKey('c1'),
      floorQueryKey('c1'),
      timelineQueryKey('c1'),
      sceneQueryKey('c1'),
      journalQueryKey('c1'),
      sessionHistoryQueryKey('c1'),
      sheetsQueryKey('c1')
    ])
  })

  it('carries no text in any LiveMessage variant, only ids and flags', () => {
    // One value per variant: `satisfies` makes a new variant a type error until it is listed here.
    const variants = {
      session: { type: 'session', campaign: 'c1', attached: true },
      floor: { type: 'floor', campaign: 'c1' },
      timeline: { type: 'timeline', campaign: 'c1' },
      seed: { type: 'seed', campaign: 'c1' },
      draft: { type: 'draft', campaign: 'c1', draft: 'd1' },
      conversation: { type: 'conversation', campaign: 'c1' },
      permission: { type: 'permission', campaign: 'c1' },
      claims: { type: 'claims', campaign: 'c1' }
    } satisfies { [T in LiveMessage['type']]: Extract<LiveMessage, { type: T }> }

    for (const message of Object.values(variants)) {
      const { type, campaign, ...rest } = message as Record<string, unknown>
      expect(type).toMatch(/^[a-z]+$/)
      expect(campaign).toBe('c1')
      for (const value of Object.values(rest)) {
        expect(['boolean', 'string']).toContain(typeof value)
        if (typeof value === 'string') expect(value).toMatch(/^[a-z]\d+$/)
      }
    }
  })
})
