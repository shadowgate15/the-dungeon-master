import { describe, expect, it } from 'vitest'
import {
  ARC_SIZES,
  actProblems,
  arcProblems,
  planArc,
  skeletonProblems,
  type ArcDraft
} from './arc.ts'

const beat = (n: number) => ({ title: `Beat ${n}`, description: `Something happens ${n}.` })
const arc = (acts: number, beatsPerAct: number): ArcDraft => ({
  title: 'The Ember Crown',
  premise: 'A relic wakes.',
  stakes: 'The valley burns.',
  acts: Array.from({ length: acts }, (_, a) => ({
    name: `Act ${a}`,
    purpose: 'Things escalate.',
    beats: Array.from({ length: beatsPerAct }, (_, b) => beat(a * 10 + b))
  })),
  resolution: 'The relic is destroyed.'
})

describe('Arc size ranges by Length', () => {
  it('names the ranges from the spec', () => {
    expect(ARC_SIZES).toEqual({
      'one-shot': { acts: [1, 1], beats: [3, 4] },
      short: { acts: [3, 3], beats: [5, 8] },
      medium: { acts: [3, 4], beats: [9, 14] },
      long: { acts: [4, 5], beats: [14, 20] }
    })
  })

  it('accepts an Arc inside its Length ranges', () => {
    expect(arcProblems(arc(1, 3), 'one-shot')).toEqual([])
    expect(arcProblems(arc(3, 2), 'short')).toEqual([])
    expect(arcProblems(arc(4, 3), 'medium')).toEqual([])
    expect(arcProblems(arc(5, 3), 'long')).toEqual([])
  })

  it('rejects too many or too few Acts', () => {
    expect(arcProblems(arc(2, 3), 'short').join()).toMatch(/Acts/)
    expect(arcProblems(arc(2, 3), 'one-shot').join()).toMatch(/Acts/)
  })

  it('rejects a total Beat count outside the range', () => {
    expect(arcProblems(arc(1, 5), 'one-shot').join()).toMatch(/Beats/)
    expect(arcProblems(arc(3, 1), 'short').join()).toMatch(/Beats/)
  })

  it('requires at least one Beat in every Act, and non-blank text', () => {
    const a = arc(3, 2)
    a.acts[1].beats = []
    expect(arcProblems(a, 'short').join()).toMatch(/at least one Beat/)
    const b = arc(3, 2)
    b.title = '  '
    expect(arcProblems(b, 'short').join()).toMatch(/title/i)
  })

  it('rejects over-long text', () => {
    const a = arc(3, 2)
    a.acts[0].beats[0].description = 'x'.repeat(2000)
    expect(arcProblems(a, 'short').join()).toMatch(/too long/)
  })

  it('in generated mode, wants 2 to 4 Beats per Act', () => {
    expect(arcProblems(arc(3, 1), 'short', { generated: true }).join()).toMatch(/2 to 4/)
    expect(arcProblems(arc(3, 2), 'short', { generated: true })).toEqual([])
  })
})

describe('planArc', () => {
  it('plans the Act count and exact Beats per Act for every Length', () => {
    expect(planArc('one-shot')).toEqual({ acts: 1, beats: [3] })
    expect(planArc('short')).toEqual({ acts: 3, beats: [2, 2, 2] })
    expect(planArc('medium')).toEqual({ acts: 4, beats: [3, 3, 3, 3] })
  })

  it('gives the remainder to the middle Acts', () => {
    const long = planArc('long')
    expect(long.acts).toBe(5)
    expect(long.beats).toEqual([3, 4, 4, 3, 3])
    expect(long.beats.reduce((a, b) => a + b)).toBe(17)
  })

  it('keeps every Act within 2 to 4 Beats and the total in range', () => {
    for (const length of Object.keys(ARC_SIZES) as (keyof typeof ARC_SIZES)[]) {
      const { acts, beats } = planArc(length)
      expect(beats).toHaveLength(acts)
      for (const n of beats) expect(n >= 2 && n <= 4).toBe(true)
      const total = beats.reduce((a, b) => a + b)
      expect(total >= ARC_SIZES[length].beats[0] && total <= ARC_SIZES[length].beats[1]).toBe(true)
    }
  })
})

describe('skeletonProblems', () => {
  const skeleton = (acts = 3) => ({
    title: 'T',
    premise: 'P',
    stakes: 'S',
    resolution: 'R',
    acts: Array.from({ length: acts }, (_, i) => ({ name: `A${i}`, purpose: 'x' }))
  })

  it('accepts a valid skeleton', () => {
    expect(skeletonProblems(skeleton(3), 3)).toEqual([])
  })
  it('rejects a wrong Act count', () => {
    expect(skeletonProblems(skeleton(2), 3).join()).toMatch(/exactly 3 Acts/)
  })
  it('rejects missing and over-long text', () => {
    const s = skeleton(3)
    s.title = ' '
    s.acts[1].purpose = 'x'.repeat(500)
    const text = skeletonProblems(s, 3).join()
    expect(text).toMatch(/title is required/)
    expect(text).toMatch(/Act 2's purpose is too long/)
  })
  it('rejects the wrong shape', () => {
    expect(skeletonProblems(null, 3)).not.toEqual([])
    expect(skeletonProblems({ ...skeleton(3), acts: 'no' }, 3)).not.toEqual([])
  })
})

describe('actProblems', () => {
  const act = (n: number) => ({ beats: Array.from({ length: n }, (_, i) => beat(i)) })

  it('accepts the exact Beat count', () => {
    expect(actProblems(act(3), 3, 2)).toEqual([])
  })
  it('rejects a different Beat count', () => {
    expect(actProblems(act(2), 3, 2).join()).toMatch(/Act 2 needs exactly 3 Beats/)
    expect(actProblems(act(4), 3, 2).join()).toMatch(/exactly 3 Beats/)
  })
  it('rejects blank and over-long Beat text', () => {
    const a = act(3)
    a.beats[0].title = ''
    a.beats[2].description = 'x'.repeat(900)
    const text = actProblems(a, 3, 1).join()
    expect(text).toMatch(/Act 1 Beat 1's title is required/)
    expect(text).toMatch(/Act 1 Beat 3's description is too long/)
  })
  it('rejects the wrong shape', () => {
    expect(actProblems({ beats: 'x' }, 3, 1)).not.toEqual([])
    expect(actProblems({ beats: [null] }, 1, 1)).not.toEqual([])
  })
})
