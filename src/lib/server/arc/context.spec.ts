import { describe, expect, it } from 'vitest'
import { ARC_DRIFT_TURNS, buildArcBlock, countQuietTurns, type ArcContextArc } from './context.ts'

type State = 'pending' | 'reached' | 'abandoned'
const beat = (title: string, state: State = 'pending') => ({
  title,
  description: `${title} happens.`,
  state,
  sourceSessionId: null as string | null,
  sourceTurnSeq: null as number | null
})

const arc = (states: State[][], status: 'draft' | 'accepted' = 'accepted'): ArcContextArc => ({
  status,
  title: 'The Drowned Crown',
  premise: 'A crown lies under the lake.',
  stakes: 'The village floods.',
  resolution: 'The crown is returned.',
  acts: states.map((beats, a) => ({
    name: `Act ${a + 1}`,
    purpose: `Purpose ${a + 1}`,
    beats: beats.map((s, b) => beat(`A${a + 1}B${b + 1}`, s))
  }))
})

describe('buildArcBlock', () => {
  it('is null for no Arc and for a draft', () => {
    expect(buildArcBlock(null, 0)).toBeNull()
    expect(buildArcBlock(arc([['pending']], 'draft'), 0)).toBeNull()
  })

  it('at the start shows the Arc, the first Act with open Beats and only the next Beat title', () => {
    const text = buildArcBlock(
      arc([['pending', 'pending'], ['pending', 'pending'], ['pending']]),
      0
    )!
    expect(text).toContain('The Drowned Crown')
    expect(text).toContain('A crown lies under the lake.')
    expect(text).toContain('The village floods.')
    expect(text).toContain('Act 1')
    expect(text).toContain('Purpose 1')
    expect(text).toContain('A1B1: A1B1 happens.')
    expect(text).toContain('A1B2: A1B2 happens.')
    expect(text).toContain('A2B1')
    expect(text).not.toContain('A2B1 happens')
    expect(text).not.toContain('A2B2')
    expect(text).not.toContain('Act 3')
    expect(text).not.toContain('The crown is returned.')
    expect(text).not.toMatch(/already happened/i)
  })

  it('mid-Arc moves to the Act of the first pending Beat and summarises reached Beats', () => {
    const text = buildArcBlock(
      arc([['reached', 'abandoned'], ['reached', 'pending'], ['pending']]),
      0
    )!
    expect(text).toContain('Act 2')
    expect(text).toContain('A2B2: A2B2 happens.')
    expect(text).not.toContain('Act 1')
    expect(text).not.toContain('A2B1 happens')
    expect(text).toMatch(/already happened.*A1B1.*A2B1/i)
    expect(text).not.toContain('A1B2')
    expect(text).toContain('A3B1')
    expect(text).not.toContain('The crown is returned.')
  })

  it('shows the resolution once the final Act is current', () => {
    const text = buildArcBlock(arc([['reached'], ['reached', 'pending']]), 0)!
    expect(text).toContain('The crown is returned.')
    expect(text).not.toContain('Act 1')
  })

  it('when complete drops the Beat list and shows the resolution as now in play', () => {
    const text = buildArcBlock(arc([['reached'], ['reached', 'abandoned']]), 99)!
    expect(text).toContain('The crown is returned.')
    expect(text).toMatch(/now in play/)
    expect(text).not.toContain('A2B1')
    expect(text).not.toContain('Act 2')
    expect(text).not.toMatch(/drift/i)
  })

  it('tells the DM never to announce Beats or mention the Arc', () => {
    const text = buildArcBlock(arc([['pending']]), 0)!
    expect(text).toMatch(/never announce/i)
    expect(text).toMatch(/natural/i)
  })

  it('adds one advisory drift hint only at the threshold', () => {
    const a = arc([['pending'], ['pending']])
    expect(buildArcBlock(a, ARC_DRIFT_TURNS - 1)).not.toMatch(/drift/i)
    const at = buildArcBlock(a, ARC_DRIFT_TURNS)!
    expect(at.match(/drift/gi)).toHaveLength(1)
    expect(at.length).toBeGreaterThan(buildArcBlock(a, 0)!.length)
  })
})

describe('countQuietTurns', () => {
  const sess = (id: string, ...authors: ('dm' | 'player')[]) => ({
    id,
    turns: authors.map((author, i) => ({ seq: i + 1, author }))
  })

  it('counts every DM turn when no Beat has progressed', () => {
    expect(countQuietTurns(arc([['pending']]), [sess('s1', 'dm', 'player', 'dm')])).toBe(2)
  })

  it('counts DM turns after the latest Beat progress, across Sessions', () => {
    const a = arc([['reached', 'pending']])
    a.acts[0].beats[0].sourceSessionId = 's1'
    a.acts[0].beats[0].sourceTurnSeq = 2
    expect(
      countQuietTurns(a, [sess('s1', 'dm', 'player', 'dm', 'dm'), sess('s2', 'dm', 'dm')])
    ).toBe(4)
  })
})
